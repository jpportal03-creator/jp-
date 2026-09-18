import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

export function hashVerificationCode(code: string) {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

export function isVerificationCodeSingleUse(record: { verifiedAt: Date | null } | null) {
  return !record || record.verifiedAt === null;
}

export async function createEmailVerification(email: string) {
  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = hashVerificationCode(code);

  await prisma.emailVerification.deleteMany({ where: { email } });

  await prisma.emailVerification.create({
    data: {
      email,
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return { code };
}

export async function verifyEmailCode(email: string, code: string) {
  const hash = hashVerificationCode(code);

  const verification = await prisma.emailVerification.findFirst({
    where: {
      email,
      codeHash: hash,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification || !isVerificationCodeSingleUse(verification)) {
    return false;
  }

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { verifiedAt: new Date() },
  });

  return true;
}
