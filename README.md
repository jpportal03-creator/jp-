# JP Dating

Production-ready, independent multi-college student social and dating platform foundation.

## Stack

- **Frontend**: Next.js 15 (App Router, React 18, TypeScript)
- **Backend API**: Fastify 5 (TypeScript, WebSockets, Rate Limiting, Helmet)
- **Database & ORM**: PostgreSQL with Prisma ORM
- **Cache & Realtime**: Redis & WebSocket

---

## Deployment Options

Because JP Dating uses persistent WebSockets (`@fastify/websocket`) for real-time messaging, the API server must run on a persistent Node.js environment like **Render**.

### Option 1: 1-Click Deployment on Render (Recommended for full-stack)

You can deploy the database, API server, and Web frontend together using the included [render.yaml](render.yaml) blueprint:

1. Push your repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect this GitHub repository.
5. Render will automatically detect `render.yaml` and provision:
   - **PostgreSQL Database** (`jp-dating-db`)
   - **Fastify API Service** (`jp-dating-api`)
   - Build: `npm ci && npm run build:api`
   - Pre-deploy: `npm run db:deploy && npm run db:seed`
     - Start: `npm run start:api`
     - Auto-generates `JWT_SECRET`, `AUTH_SECRET`, and `PAYMENT_WEBHOOK_SECRET`
   - **Next.js Web Service** (`jp-dating-web`)
   - Build: `npm ci && npm run build:web`
     - Start: `npm run start:web`
6. Fill in the pending environment variables:
   - For `jp-dating-api`:
     - `APP_URL`: Set to your web service URL (e.g. `https://jp-dating-web.onrender.com`)
     - `WEB_ORIGINS`: Set to your web service URL (e.g. `https://jp-dating-web.onrender.com`)
   - For `jp-dating-web`:
     - `NEXT_PUBLIC_API_URL`: Set to your API service URL (e.g. `https://jp-dating-api.onrender.com`)
7. Click **Apply**.

---

---

## Production Environment Variables Reference

| Variable | Required in Production | Description | Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | App runtime mode | `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Yes | Secret for signing user tokens | `min-32-char-random-secret` |
| `AUTH_SECRET` | Yes | Secret for session validation | `min-32-char-random-secret` |
| `APP_URL` | Yes | Public URL of web frontend | `https://jp-dating-web.onrender.com` |
| `WEB_ORIGINS` | Yes | Allowed CORS origin(s) | `https://jp-dating-web.onrender.com` |
| `PAYMENT_WEBHOOK_SECRET` | Yes | Secret for validating webhook callbacks | `min-32-char-random-secret` |
| `PAYMENT_PROVIDER` | No | Payment processor (`sandbox`, `razorpay`, `stripe`) | `sandbox` |
| `NEXT_PUBLIC_API_URL` | Yes (Frontend) | Public API base URL used by browser | `https://jp-dating-api.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | Yes (Frontend) | Canonical web domain | `https://jp-dating-web.onrender.com` |

---

## Database Commands

- **Deploy Migrations**: `npm run db:deploy`
- **Seed Initial Data**: `npm run db:seed` (creates default college, domains, courses, semesters, and plans)
- **Push Schema directly**: `npm run db:push`
- **Generate Prisma Client**: `npm run db:generate`

---

## Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start Postgres and Redis:
   ```bash
   docker compose up -d
   ```
3. Generate client & push schema:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```
4. Start both API and Web in development:
   ```bash
   npm run dev
   ```
