# JP Dating

Production-ready, independent multi-college student social and dating platform foundation.

## Stack

- Next.js web app
- Fastify API
- PostgreSQL
- Redis
- Prisma
- TypeScript

## Local development

1. Copy `.env.example` to `.env.local` and adjust values.
2. Start Postgres and Redis:
   `docker compose up -d`
3. Run migrations:
   `cd apps/api && npm run prisma:migrate`
4. Start the API and web app:
   `npm run dev`

## Security notes

- Keep all real credentials in environment variables.
- Never trust frontend user claims for auth, role, subscription, or college.
- All payment verification must happen on the backend.

## Production configuration

Set `NODE_ENV=production`, strong `JWT_SECRET` and `AUTH_SECRET`, `APP_URL`, `WEB_ORIGINS`, `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_API_URL`. Configure the payment provider and webhook secret before accepting payments.

Apply migrations with `npm run prisma:deploy --workspace apps/api`, then start the API with `npm run start --workspace apps/api` and the web app with `npm run start --workspace apps/web`.

The payment implementation currently includes a sandbox provider. A real Razorpay or Stripe adapter and provider sandbox verification are still required before production billing.

JP Dating is independently operated and is not affiliated with or endorsed by any university unless explicitly stated.
