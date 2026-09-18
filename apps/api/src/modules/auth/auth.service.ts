import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';

type AuthSessionRequest = {
  cookies?: Record<string, string | undefined>;
};

export async function ensureDomainMatchesCollege(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();

  if (!domain) {
    return false;
  }

  const collegeDomain = await prisma.collegeDomain.findUnique({
    where: { domain },
    include: { college: true },
  });

  return Boolean(collegeDomain?.active && collegeDomain.college.active);
}

export async function createUserWithEmail(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      status: 'pending_verification',
    },
  });

  return user;
}

export async function verifyPassword(candidate: string, passwordHash: string) {
  return bcrypt.compare(candidate, passwordHash);
}

export function createSessionToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function getSessionUserIdFromRequest(request: AuthSessionRequest) {
  const token = request.cookies?.sessionToken;
  if (!token || typeof token !== 'string') {
    return null;
  }

  const userId = verifySessionToken(token);
  if (!userId) return null;
  const session = await prisma.session.findFirst({ where: { userId, refreshToken: hashSessionToken(token), revokedAt: null, expiresAt: { gt: new Date() } }, select: { userId: true } });
  return session?.userId ?? null;
}

export async function setSessionCookie(reply: { setCookie: (name: string, value: string, options: Record<string, unknown>) => void }, userId: string) {
  const token = createSessionToken(userId);
  await prisma.session.create({ data: { userId, refreshToken: hashSessionToken(token), expiresAt: new Date(Date.now() + 7 * 86400000) } });

  reply.setCookie('sessionToken', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });

  return token;
}

export async function clearSessionCookie(request: AuthSessionRequest, reply: { clearCookie: (name: string, options: Record<string, unknown>) => void }) {
  const token = request.cookies?.sessionToken;
  if (token) await prisma.session.updateMany({ where: { refreshToken: hashSessionToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  reply.clearCookie('sessionToken', {
    path: '/',
  });
}
