# WhatsApp Marketing Tool

Full-stack WhatsApp Cloud API marketing application for US (+1) phone numbers: contacts, templates, bulk campaigns (BullMQ + Redis), webhooks, inbox, automations, and analytics.

## Troubleshooting: “Registration failed”

The browser calls `POST http://localhost:5000/api/auth/register`. If that fails:

1. **Start the backend** from `backend` with `npm run dev` and watch the terminal for errors.
2. **Use local SQLite + no Redis** (default in the sample `.env`): `TURSO_DATABASE_URL=file:./data/local.db` and `REDIS_URL=disable`. Registration does not require Redis; Redis is only needed for campaign queues.
3. If `.env` still has a placeholder Turso URL (`libsql://your-db...`), the API will error — either use `file:./data/local.db` or real Turso credentials.
4. Ensure nothing else is using **port 5000** (or change `PORT` in `.env`).

## Prerequisites

- Node.js 18+
- A [Turso](https://turso.tech/) SQLite database
- Redis (local or hosted) for BullMQ
- A Meta Developer app with WhatsApp product and Cloud API enabled

## Backend setup

1. Open a terminal:

```bash
cd backend
npm install
```

2. Copy the environment template and fill in real values:

```bash
cp backend/.env.example backend/.env
```

On Windows PowerShell: `Copy-Item backend\.env.example backend\.env`

Then edit `backend/.env`:

- **Turso**: create a database in the Turso dashboard, copy `libsql://...` URL and create an auth token.
- **Redis**: default `redis://localhost:6379` if Redis runs locally.
- **JWT_SECRET**: use a long random string (32+ characters).
- **Meta**: from Meta App Dashboard → WhatsApp → API Setup, copy Phone Number ID, WhatsApp Business Account ID, and a permanent access token with `whatsapp_business_messaging` (and template management as needed). Set `META_WEBHOOK_VERIFY_TOKEN` to any secret string you will use in the Meta webhook configuration.

3. **Redis (free, via Docker)** — if Docker is installed:

```bash
docker run -d -p 6379:6379 --name redis-wa redis:alpine
```

Then in `backend/.env` set:

```env
REDIS_URL=redis://localhost:6379
```

(Remove `REDIS_URL=disable` if you were using that.) Stop/remove the container when done: `docker stop redis-wa` / `docker rm redis-wa`.

4. Run the API:

```bash
npm run dev
```

The server listens on `PORT` (default `5000`). On startup it:

- Runs SQL migrations (Turso)
- Starts the BullMQ worker (`whatsapp-messages` queue, concurrency 5, 80 jobs/second limiter)
- Registers cron jobs (scheduled campaigns, inactivity automations, schedule-type automations)

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies `/api` to `http://localhost:5000`.

For production, build the frontend (`npm run build`) and serve `frontend/dist` behind your web server, or point `FRONTEND_URL` and CORS to your deployed origin.

## First-time use

1. Register an admin user: open `http://localhost:5173/register`, then sign in.
2. In Meta, **sync templates** from the Templates page (or create and submit new templates; approval is on Meta’s side).
3. Add US contacts (+1) on the Contacts page or import CSV (`phone`, `name`, `email`, `tags`).
4. Create a campaign, map template variables, and send or schedule.

## Meta webhook configuration

1. Expose your backend publicly (e.g. ngrok, Cloudflare Tunnel, or a deployed URL).
2. In Meta Developer Portal → WhatsApp → Configuration, set:
   - **Callback URL**: `https://your-domain.com/api/webhook`
   - **Verify token**: same value as `META_WEBHOOK_VERIFY_TOKEN` in `.env`
3. Subscribe to `messages` and `message_status` (or equivalent) so delivery/read updates and inbound messages reach your app.

The app responds `200` immediately on `POST /api/webhook` and processes events asynchronously.

## Turso credentials

1. Install the [Turso CLI](https://docs.turso.tech/cli/introduction) or use the web dashboard.
2. Create a database and note the **URL** (`libsql://...`).
3. Create an **auth token** with access to that database and set `TURSO_AUTH_TOKEN`.

## Project layout

- `backend/src` — Express API, LibSQL, BullMQ worker, cron scheduler, Meta integration
- `frontend/src` — React 18 + Vite + Tailwind UI

## Scripts

| Location   | Command       | Description        |
|-----------|---------------|--------------------|
| `backend` | `npm run dev` | nodemon API        |
| `backend` | `npm start`   | production `node`  |
| `frontend`| `npm run dev` | Vite dev server    |
| `frontend`| `npm run build` | production build |

## Compliance (US)

The app validates `+1` numbers, honors opt-in/out, processes `STOP` / `UNSUBSCRIBE` and `START` via webhook, and checks opt-in before each queued send. Free-text replies use Meta’s 24-hour customer care window; the Inbox UI warns when that window has expired.
