import 'dotenv/config';

type EnvSource = NodeJS.ProcessEnv;

const requiredInProduction = (source: EnvSource, name: string, fallback: string, isProduction: boolean) => {
  const value = source[name]?.trim() ?? '';
  if (isProduction && (!value || value === fallback)) throw new Error(`${name} must be configured in production`);
  return value || fallback;
};

export function resolveWebOrigins(webOrigins: string | undefined, appUrl: string, isProduction = false) {
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

export function createEnv(source: EnvSource = process.env) {
  const isProduction = source.NODE_ENV === 'production';
  const appUrl = requiredInProduction(source, 'APP_URL', 'http://localhost:3000', isProduction);

  return {
    NODE_ENV: source.NODE_ENV ?? 'development',
    PORT: Number(source.PORT ?? 4000),
    DATABASE_URL: requiredInProduction(source, 'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/project_name?schema=public', isProduction),
    JWT_SECRET: requiredInProduction(source, 'JWT_SECRET', 'development-secret', isProduction),
    AUTH_SECRET: requiredInProduction(source, 'AUTH_SECRET', 'development-secret', isProduction),
    APP_URL: appUrl,
    REDIS_URL: source.REDIS_URL ?? 'redis://localhost:6379',
    ADMIN_EMAIL: source.ADMIN_EMAIL ?? 'admin@localhost',
    ADMIN_PASSWORD: source.ADMIN_PASSWORD ?? 'change-me',
    WEB_ORIGINS: resolveWebOrigins(source.WEB_ORIGINS, appUrl, isProduction),
    PAYMENT_PROVIDER: source.PAYMENT_PROVIDER ?? 'sandbox',
    PAYMENT_KEY_ID: source.PAYMENT_KEY_ID ?? '',
    PAYMENT_KEY_SECRET: source.PAYMENT_KEY_SECRET ?? '',
    PAYMENT_WEBHOOK_SECRET: requiredInProduction(source, 'PAYMENT_WEBHOOK_SECRET', 'development-payment-webhook-secret', isProduction),
    BOOST_PRICE_IN_PAISE: Number(source.BOOST_PRICE_IN_PAISE ?? 4900),
    BOOST_DURATION_HOURS: Number(source.BOOST_DURATION_HOURS ?? 24),
  };
}

export const env = createEnv();
