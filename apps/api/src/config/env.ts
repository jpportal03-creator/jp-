import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const requiredInProduction = (name: string, fallback: string) => {
  const value = process.env[name]?.trim() ?? '';
  if (isProduction && (!value || value === fallback)) throw new Error(`${name} must be configured in production`);
  return value || fallback;
};

export function resolveWebOrigins(webOrigins: string | undefined, appUrl: string) {
  const value = webOrigins?.trim() || appUrl;
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);

  if (isProduction && origins.length === 0) throw new Error('WEB_ORIGINS must be configured in production');

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid origin');
    } catch {
      throw new Error(`WEB_ORIGINS contains an invalid origin: ${origin}`);
    }
  }

  return origins.join(',');
}

const appUrl = requiredInProduction('APP_URL', 'http://localhost:3000');

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: requiredInProduction('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/project_name?schema=public'),
  JWT_SECRET: requiredInProduction('JWT_SECRET', 'development-secret'),
  AUTH_SECRET: requiredInProduction('AUTH_SECRET', 'development-secret'),
  APP_URL: appUrl,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? 'admin@localhost',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? 'change-me',
  WEB_ORIGINS: resolveWebOrigins(process.env.WEB_ORIGINS, appUrl),
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? 'sandbox',
  PAYMENT_KEY_ID: process.env.PAYMENT_KEY_ID ?? '',
  PAYMENT_KEY_SECRET: process.env.PAYMENT_KEY_SECRET ?? '',
  PAYMENT_WEBHOOK_SECRET: requiredInProduction('PAYMENT_WEBHOOK_SECRET', 'development-payment-webhook-secret'),
  BOOST_PRICE_IN_PAISE: Number(process.env.BOOST_PRICE_IN_PAISE ?? 4900),
  BOOST_DURATION_HOURS: Number(process.env.BOOST_DURATION_HOURS ?? 24),
};
