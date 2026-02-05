# Managing Cal.com (Paw Pointers) on Railway

Your **Cal.com (template) Paw Pointers** project is deployed on Railway with:
- **Cal.com Web App** (Online)
- **Postgres** (Online)
- **postgres-volume** (persistent storage)

To manage and deploy from this repo, use one of the flows below.

---

## Local copy only: same code, your env & DB (production untouched)

You want to use the **Cal.com template** (maintained by Cal.com via Railway) but have a **local copy** in this repo so you can change env variables and database configuration **without affecting** the app running on Railway.

**Idea:** Use this repo only on your machine with your own `.env` and DB. Do **not** connect this repo to Railway — so the “official release” on Railway keeps running as-is from the template.

### 1. Use your own env and database locally

- Copy the env layout from **`.env.example`** (or from Railway’s service **Variables** if you want to mirror production).
- Create a **local** `.env` in this directory and set:
  - `DATABASE_URL` and `DATABASE_DIRECT_URL` → your **local** Postgres (e.g. `postgresql://postgres:@localhost:5450/calendso` if using the repo’s Docker Postgres). Do **not** use the production Railway Postgres URL here.
  - `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`, and `NEXT_PUBLIC_WEBAPP_URL` (see [DATABASE_AND_RAILWAY_SETUP.md](./DATABASE_AND_RAILWAY_SETUP.md) for the full list and DB/user setup).
- Add `.env` to `.gitignore` (Cal.com already does this) so you never commit secrets.

Production on Railway continues to use the **Variables** set in the Railway dashboard and the **Postgres** service there; this local `.env` is only for your machine.

### 2. Run locally

From this directory (repo root):

```bash
yarn install
yarn workspace @calcom/prisma db-up      # start Postgres (Docker), then:
yarn workspace @calcom/prisma db-deploy  # apply migrations
yarn dev
```

See [DATABASE_AND_RAILWAY_SETUP.md](./DATABASE_AND_RAILWAY_SETUP.md) for full database and user setup.

You can change env vars and database config in `.env` and in the app as needed. The release on Railway is unchanged.

### 3. (Optional) Later: deploy from this repo

When you eventually want Railway to deploy from **this** code (e.g. after customizations), you would:

- Push this repo to your own GitHub (new repo or fork).
- In Railway: **Cal.com Web App** → **Settings** → **Source** → disconnect the template, then connect your GitHub repo and branch.

Until you do that, this copy stays “local only” and does not touch the official release on Railway.

---

## Eject vs upstream Cal.com: what they mean

| | **Eject (template copy)** | **Upstream Cal.com (fork)** |
|--|---------------------------|-----------------------------|
| **What it is** | Railway creates a **one-time copy** of their Cal.com *template* repo in your GitHub. You own that repo; it’s a snapshot of whatever the template was at eject time. | You **fork or clone** the official [calcom/cal.com](https://github.com/calcom/cal.com) repo. You keep `upstream` → `calcom/cal.com` and merge when you want. |
| **Source of truth** | Railway’s template (a specific, possibly pinned Cal.com version). | The official Cal.com repo (`calcom/cal.com`). |
| **How you get updates** | Railway may offer “updatable templates”: they create a **branch or PR** in your ejected repo when the *template* is updated. You merge that PR to get template updates. You do **not** directly pull from `calcom/cal.com`. | You run `git fetch upstream && git merge upstream/main` (or use a PR from upstream). You get **every** change from the main Cal.com repo on your schedule. |
| **Customization** | Full control; no upstream Cal.com merge conflicts. | You can customize; merging upstream may create conflicts you must resolve. |

### Advantages and disadvantages

**Eject (template copy)**

- **Pros:** Simple. No merge conflicts with Cal.com. Railway may send you update PRs when the *template* changes. Clear ownership of “your” copy.
- **Cons:** Updates are tied to **Railway’s template**, not necessarily to the latest Cal.com main. If the template lags behind calcom/cal.com, you don’t get those changes until the template is updated. Less direct control over “constant modification” from the main Cal.com repo.

**Upstream Cal.com (fork)**

- **Pros:** Direct access to **constant modification** in the Cal.com repo. You decide when to pull/merge (e.g. `upstream/main`). You can stay close to latest features and fixes.
- **Cons:** You must maintain the fork: merge upstream, run migrations, fix conflicts if you have customizations. Slightly more ops and discipline.

**If your goal is “take advantage of constant modification of the cal.com repo”**  
→ Use a **fork of upstream Cal.com** and periodically merge from `calcom/cal.com`. Eject is better when you want minimal maintenance and are okay with updates only when the Railway template is updated.

---

## API usage and Turborepo

### You don’t need Cal.com in the same repo to use the API

- Cal.com exposes a **REST API** ([API v1](https://cal.com/docs/api-reference/v1/introduction), [API v2](https://cal.com/docs/api-reference/v2/introduction)). Any app (Next.js, Node, etc.) can call it with HTTP + API keys.
- **Same repo vs different repo** doesn’t change how the API works: you call `https://your-calcom.railway.app/api/...` (or your Cal.com URL) from wherever your app runs. So API connections are **not** inherently easier just because Cal.com lives in the same repo.

### When putting Cal.com inside a Turborepo *does* help

- **Shared TypeScript types** for API request/response between your app and Cal.com (e.g. a shared `packages/types` or generated client from OpenAPI).
- **Single repo** for issues, PRs, and versioning.
- **Local dev:** run Cal.com and your app together (`turbo run dev`), so your app can point at `http://localhost:3000` for Cal.com and avoid hitting production.
- **Customizations inside Cal.com** that call your own backend: if you add code *inside* the Cal.com codebase that talks to your services, a monorepo makes it easier to share code and refactor.

### When keeping Cal.com *outside* the Turborepo is simpler

- **Cal.com is large** (big Next.js app, its own dependency tree and build). Fitting it into a Turborepo as `apps/calcom` is possible but can be fiddly (paths, env, deploy config).
- If you only need to **call Cal.com’s public API** from your own app (bookings, availability, users), the clean approach is:
  - **Turborepo** = your apps (e.g. `apps/web`, `apps/api`) + shared packages (e.g. `packages/calcom-client` with typed API calls).
  - **Cal.com** = separate repo (your fork of calcom/cal.com), deployed on Railway (or elsewhere). You get “constant modification” by merging from upstream in that fork.
- Your Turborepo then only needs an API client (or fetch wrapper) that uses the same base URL and API keys; no need to embed Cal.com.

### Recommended layout for “upstream updates + API + Turborepo”

- **Cal.com:** Fork of **upstream Cal.com** in its **own repo**. Deploy that fork (e.g. Railway). Merge from `calcom/cal.com` when you want the latest changes. Use it as the “booking engine” and manage it via the **public API**.
- **Turborepo:** Contains your product (e.g. Paw Pointers): apps + shared packages. One of those packages (e.g. `packages/calcom-client` or `apps/api`) holds the logic that calls Cal.com’s API (create booking, list events, etc.). Shared types can live in a small `packages/types` or be generated from Cal.com’s API spec if they publish one.
- **Result:** You get constant modification from the Cal.com repo (in the Cal.com fork), easy API-based management from your Turborepo (via the client package), and you avoid the complexity of embedding Cal.com inside the Turborepo unless you really need in-repo customizations.

If later you need to **patch Cal.com itself** (e.g. custom event types or deep integration), you can still add it as `apps/calcom` in the Turborepo and point Railway at that app; you can do that when the need arises.

---

## Option 1: Eject from template

This gives you a GitHub repo owned by you that Railway deploys from. You then clone it and work there.

### 1. Eject in Railway

1. Open [Railway](https://railway.app) → **Cal.com (template) Paw Pointers** → **Cal.com Web App**.
2. Go to **Settings** → **Source**.
3. Find **Upstream Repo** and click **Eject**.
4. Select your GitHub user or organization.
5. Click **Eject service**. Railway creates a new repo in your GitHub (a copy of the Cal.com template).

> **If you don’t see Eject:** Check [Railway feature flags](https://railway.app/account/feature-flags) and enable **Template Service Eject**.

### 2. Clone and work

After the repo is created, clone it (replace with your repo URL):

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_CALCOM_REPO.git
cd YOUR_CALCOM_REPO
```

### 3. Work and deploy

- Edit code locally and push to the default branch (e.g. `main`).
- Railway will auto-deploy on push (see **Settings → Source** for the connected branch).
- Optional: **Settings → Wait for CI** to wait for GitHub Actions before deploying.

---

## Option 2: Use official Cal.com repo (this repo as fork)

If you prefer to base off upstream Cal.com and connect Railway to your own fork:

### 1. Push this repo to your GitHub

Create a new repo on GitHub (e.g. `paw-pointers-calcom`), then:

```bash
git remote rename origin upstream   # if origin is calcom/cal.com
git remote add origin https://github.com/YOUR_USERNAME/paw-pointers-calcom.git
git push -u origin main
```

### 2. Connect Railway to your repo

1. In Railway: **Cal.com Web App** → **Settings** → **Source**.
2. **Disconnect** the current template source.
3. **Connect** your GitHub repo and select the branch to deploy from.

### 3. Match template env and build

Copy environment variables and build/start commands from the current Railway service (Settings → Variables, and build/deploy logs) so your fork runs the same way as the template.

---

## After you have code in this repo

- **Env vars:** Keep `.env` out of git; set secrets in Railway **Variables**. Match production to local: `DATABASE_URL`, `DATABASE_DIRECT_URL`, `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`, and (if needed) `NEXT_PUBLIC_WEBAPP_URL`. See [DATABASE_AND_RAILWAY_SETUP.md](./DATABASE_AND_RAILWAY_SETUP.md) for the full list and how to set up the database and create users both **locally** and on **Railway**.
- **Migrations:** Run Cal.com DB migrations when upgrading: `yarn workspace @calcom/prisma db-deploy` (from repo root). See [Cal.com docs](https://cal.com/docs/self-hosting/database-migrations) and [DATABASE_AND_RAILWAY_SETUP.md](./DATABASE_AND_RAILWAY_SETUP.md).
- **Upgrades:** If you used Eject, you may get upstream update branches/PRs from Railway; merge to deploy.

---

## Quick reference

| Goal                    | Where |
|-------------------------|--------|
| Change deploy branch    | Railway → Service → Settings → Source |
| Turn off auto-deploy    | Settings → Source → Disconnect |
| Deploy latest commit    | Railway: `CMD + K` → “Deploy Latest Commit” |
| Cal.com Railway docs    | https://cal.com/docs/self-hosting/deployments/railway |
| Railway template deploy | https://docs.railway.com/guides/deploy |
