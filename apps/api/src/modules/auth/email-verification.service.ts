import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export function hashVerificationCode(code: string) {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

export function isVerificationCodeSingleUse(record: { verifiedAt: Date | null } | null) {
  return !record || record.verifiedAt === null;
}

export async function sendVerificationEmail(email: string, code: string) {
  logger.info({ event: 'verification_email_send_attempt', provider: 'resend' }, 'Attempting verification email delivery');

  if (!env.EMAIL_PROVIDER_API_KEY || !env.EMAIL_FROM) {
    throw new Error('Email provider is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Verify your JP Dating email',
      text: `Your JP Dating verification code is ${code}. It expires in 10 minutes.`,
    }),
  });

  if (!response.ok) {
    const providerMessage = (await response.text()).slice(0, 500);
    logger.error({ event: 'verification_email_send_failed', provider: 'resend', statusCode: response.status, providerMessage }, 'Verification email delivery failed');
    throw new Error(`Email provider rejected the message with status ${response.status}`);
  }

  logger.info({ event: 'verification_email_send_succeeded', provider: 'resend', statusCode: response.status }, 'Verification email delivered');
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
