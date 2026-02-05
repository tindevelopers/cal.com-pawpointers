# Database and User Setup (Local + Railway)

This doc matches your **local repo** to the **Railway deploy** and covers database setup and user creation in both environments.

All commands below are run from the **repo root** (this directory).

---

## 1. Environment variables: match Railway

Railway’s Cal.com template provides some variables automatically; others you set in the dashboard or in local `.env`.

### Variables Railway provides (when using their Postgres template)

- **`DATABASE_URL`** – Set via **Variables** by referencing the Postgres service, e.g. `${{Postgres.DATABASE_URL}}` (or the equivalent your project uses). Railway’s Postgres plugin exposes this.
- **`DATABASE_DIRECT_URL`** – Same as `DATABASE_URL` unless you use PgBouncer; if not, set it to the same value (e.g. `${{Postgres.DATABASE_PRIVATE_URL}}` or same as `DATABASE_URL`).
- **`RAILWAY_STATIC_URL`** – Set by Railway for the deployed app (e.g. `yourapp.up.railway.app`). Cal.com uses this when `NEXT_PUBLIC_WEBAPP_URL` is not set.

### Variables you must set (Railway and local)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXTAUTH_SECRET` | Yes | e.g. `openssl rand -base64 32` |
| `CALENDSO_ENCRYPTION_KEY` | Yes | 24 chars, e.g. `openssl rand -base64 24` |
| `NEXT_PUBLIC_WEBAPP_URL` | Yes (if not Railway) | Local: `http://localhost:3000`. Railway: your app URL (optional if `RAILWAY_STATIC_URL` is set). |

### Optional but recommended

- `NEXT_PUBLIC_WEBSITE_URL` – Same as webapp URL for self‑hosted.
- `NEXTAUTH_URL` – Same as `NEXT_PUBLIC_WEBAPP_URL`.
- `EMAIL_*` – If you want real email (e.g. SMTP or Resend).

Copy the full list from **`.env.example`** and fill the same variables in:

- **Local:** `.env` (in this directory)
- **Railway:** Project → Cal.com Web App → **Variables**

---

## 2. Local database setup

### Option A: Docker Postgres (recommended)

1. **Start Postgres** (from repo root):

   ```bash
   yarn workspace @calcom/prisma db-up
   ```

   This uses `packages/prisma/docker-compose.yml` and creates a database named **`calendso`** on port **5450**.

2. **Create `.env`** (if not already):

   ```bash
   cp .env.example .env
   ```

3. **Set in `.env`** (must match the Postgres container):

   ```env
   DATABASE_URL="postgresql://postgres:@localhost:5450/calendso"
   DATABASE_DIRECT_URL="postgresql://postgres:@localhost:5450/calendso"
   NEXTAUTH_SECRET=<from openssl rand -base64 32>
   CALENDSO_ENCRYPTION_KEY=<from openssl rand -base64 24>
   NEXT_PUBLIC_WEBAPP_URL='http://localhost:3000'
   NEXTAUTH_URL='http://localhost:3000'
   ```

4. **Install and run migrations:**

   ```bash
   yarn install
   yarn workspace @calcom/prisma db-deploy
   ```

5. **Create first user** – see [Section 4](#4-creating-users) below.

6. **Run the app:**

   ```bash
   yarn dev
   ```

### Option B: System Postgres

1. Create a database, e.g.:

   ```bash
   createdb calendso
   ```

2. In `.env` set:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/calendso"
   DATABASE_DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/calendso"
   ```

3. Then:

   ```bash
   yarn install
   yarn workspace @calcom/prisma db-deploy
   yarn dev
   ```

---

## 3. Railway database setup

On Railway, the **database** is already created by the Postgres template. You only need to ensure **migrations** run and **variables** are set.

### Ensure variables are set

1. Railway dashboard → your project → **Cal.com Web App** → **Variables**.
2. Ensure:
   - `DATABASE_URL` and `DATABASE_DIRECT_URL` point to the Postgres service (e.g. `${{Postgres.DATABASE_URL}}` and same or `${{Postgres.DATABASE_PRIVATE_URL}}`).
   - `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY` are set (same as in [Section 1](#1-environment-variables-match-railway)).
   - If your app URL is not using Railway’s default, set `NEXT_PUBLIC_WEBAPP_URL` to your public URL.

### Run migrations on Railway

Migrations are **not** always run automatically. To run them:

**Option 1 – Deploy hook / start command**  
If your Railway service runs something like:

```bash
yarn install && yarn workspace @calcom/prisma db-deploy && yarn build && yarn start
```

then migrations run on each deploy. Check **Settings → Build** / **Deploy** for the actual build and start commands.

**Option 2 – One-off from your machine**  
Install [Railway CLI](https://docs.railway.app/develop/cli), link the project, then from the repo root (with the same code as deployed):

```bash
railway link
railway run yarn workspace @calcom/prisma db-deploy
```

**Option 3 – From Railway dashboard**  
Use **Settings → Deploy** and set a custom start command that runs `db-deploy` before starting the app (e.g. in a small script), or run the same command via a one-off job if your plan supports it.

After migrations have run once, the Railway DB is ready for users.

---

## 4. Creating users

### Local

**Option A – Setup wizard (easiest)**  
1. Run the app: `yarn dev`.  
2. Open `http://localhost:3000`.  
3. The first visit shows the **setup wizard** – create your first user there.

**Option B – Seed (dummy users)**  
From repo root:

```bash
yarn workspace @calcom/prisma db-seed
```

Then log in with one of the seeded users (see console output or seed script).

**Option C – Prisma Studio (manual)**  
1. `yarn db-studio` (from repo root).  
2. Open the **User** model, add a record: set `email`, `username`, and **BCrypt**-hashed `password` (e.g. from [bcrypt-generator.com](https://bcrypt-generator.com/)), `metadata` = `{}`.  
3. Save, then log in at `http://localhost:3000`.

### Railway (remote)

**Option A – Setup wizard (recommended)**  
1. Open your Railway app URL (e.g. `https://yourapp.up.railway.app`).  
2. On first load, the **setup wizard** runs – create your first user there.

**Option B – Prisma Studio against Railway DB**  
1. In Railway, copy the **Postgres** service `DATABASE_URL` (or `DATABASE_PRIVATE_URL`).  
2. Locally, in a **separate** terminal, set that URL and run Studio:

   ```bash
   DATABASE_URL="<paste Railway Postgres URL>" yarn db-studio
   ```

3. Add a **User** with BCrypt password and `metadata` = `{}`, then log in on the Railway app URL.

Never put the production `DATABASE_URL` in a committed `.env` file; use Railway’s Variables only for production.

---

## 5. Quick reference: commands (from repo root)

| Goal | Command |
|------|--------|
| Start local Postgres (Docker) | `yarn workspace @calcom/prisma db-up` |
| Apply migrations (local or via `railway run`) | `yarn workspace @calcom/prisma db-deploy` |
| Create migration (after schema change) | `yarn workspace @calcom/prisma db-migrate` |
| Seed local DB (dummy users) | `yarn workspace @calcom/prisma db-seed` or `yarn db-seed` |
| Open Prisma Studio | `yarn db-studio` |
| Full local dev (Postgres + migrate + seed + dev) | `yarn dx` |
| Run app | `yarn dev` |

---

## 6. Dependencies and tooling

- **Node:** 18+ (see `package.json` engines).  
- **Package manager:** **Yarn 4** (`packageManager: "yarn@4.12.0"` in `package.json`). Use `yarn` in this repo, not `pnpm`/`npm` for scripts.  
- **Install:** From repo root run `yarn` (or `yarn install`).  
- **DB:** PostgreSQL; Prisma in `packages/prisma` with `db-deploy` / `db-migrate` / `db-seed`.

The repo is aligned with the **Railway deploy** when:

1. The same env vars (above) are set locally and on Railway.  
2. Migrations are run after schema changes and on first deploy (`db-deploy`).  
3. The first user is created via the setup wizard or Prisma Studio/seed as above.

---

## 7. Email with Resend (Railway)

To send Cal.com emails (booking confirmations, invites, password reset, etc.) via [Resend](https://resend.com) from your Railway instance:

### 1. Resend setup

1. Sign up at [resend.com](https://resend.com) and create an **API Key** (API Keys → Create API Key).
2. In Resend, add and **verify your domain** (e.g. `pawpointers.com` or the domain used for `booking.pawpointers.com`). Resend will give you DNS records to add; after verification you can send from addresses like `notifications@pawpointers.com` or `booking@pawpointers.com`.
3. For testing you can use Resend’s sandbox domain: `onboarding@resend.dev` (no domain verification needed, but only for testing).

### 2. Railway variables

In Railway: open your project → **Cal.com Web App** → **Variables**, then add:

| Variable | Value |
|----------|--------|
| `RESEND_API_KEY` | Your Resend API key (starts with `re_`). |
| `EMAIL_FROM` | Sender address, e.g. `notifications@pawpointers.com` or `booking@pawpointers.com`. Must be from a domain you verified in Resend (or `onboarding@resend.dev` for testing). |
| `EMAIL_FROM_NAME` | Display name in the “From” header, e.g. `Paw Pointers` or `Cal.com`. |

When `RESEND_API_KEY` is set, Cal.com uses Resend’s SMTP automatically; you do **not** set `EMAIL_SERVER_HOST` or `EMAIL_SERVER_PORT`.

### 3. Redeploy

After saving the variables, trigger a new deployment (e.g. **Deployments** → **Redeploy** or push a commit) so the app restarts with the new env. Then test by booking a meeting or using “Forgot password” to confirm emails are sent from Resend.
