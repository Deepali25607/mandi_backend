# Mandi ERP — AWS EC2 Deployment (sub-path `https://nexussoftlab.com/mandi`)

Serves the app at **`https://nexussoftlab.com/mandi`** on a single EC2 box, alongside
your other apps on the same domain.

```
Browser ──HTTPS──> nginx (443, nexussoftlab.com)
                     ├── /mandi/api/*  → NestJS API   (127.0.0.1:3002, prefix /api)
                     └── /mandi/*       → React SPA    (static files /var/www/mandi)
NestJS ──> PostgreSQL (Supabase/RDS, or local on the EC2)
```

Only the **API** uses port **3002**; the frontend is static files served by nginx.
Frontend and API share the origin, so there are no cross-origin/CORS problems.

---

## 0. Prerequisites
- EC2 (Ubuntu) with nginx already terminating TLS for `nexussoftlab.com`.
- Node.js 20+ and `npm`, plus `pm2` (`sudo npm i -g pm2`).
- A PostgreSQL database (keep your Supabase one, or an RDS instance, or install
  Postgres on the EC2 box).
- Both repos cloned on the server, e.g. `/home/ubuntu/mandi-backend` and
  `/home/ubuntu/Mandi-frontend`.

---

## 1. Backend (NestJS API on port 3002)

```bash
cd /home/ubuntu/mandi-backend
# Install ALL deps (build needs the Nest CLI, a devDependency).
# Do NOT export NODE_ENV=production in this shell or npm skips devDependencies.
npm install
npm run build                       # emits dist/, incl. dist/database/seed.js

cp .env.example .env
nano .env                           # set DATABASE_URL, DB_SSL, CORS_ORIGIN
```

`.env` (see `.env.example`): `PORT=3002`, `DATABASE_URL=...`, `DB_SSL=true`
(managed PG) or `false` (local PG), `DB_SYNC=true`, `CORS_ORIGIN=https://nexussoftlab.com`.

Seed the database once (creates demo accounts, all password `Mandi@123`):
```bash
npm run seed:prod
```

Start under PM2 (keeps it running + restarts on reboot):
```bash
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # run the command it prints
```
Check it: `curl http://127.0.0.1:3002/api/plans/public` should return JSON.

---

## 2. Frontend (React SPA, built for the `/mandi` sub-path)

Build with the sub-path base and the same-origin API path baked in:
```bash
cd /home/ubuntu/Mandi-frontend
npm install
VITE_BASE_PATH=/mandi/ VITE_API_URL=/mandi/api npm run build
```
- `VITE_BASE_PATH=/mandi/` → assets + router live under `/mandi`.
- `VITE_API_URL=/mandi/api` → API calls go to `https://nexussoftlab.com/mandi/api`.

Publish the build to where nginx serves it:
```bash
sudo mkdir -p /var/www/mandi
sudo rm -rf /var/www/mandi/*
sudo cp -r dist/* /var/www/mandi/
```

---

## 3. nginx

Add the two location blocks from [`deploy/nginx-mandi.conf`](deploy/nginx-mandi.conf)
**inside your existing `server {}` block** for `nexussoftlab.com` (the 443 one).
Then:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

Those blocks map:
- `/mandi/api/…` → `http://127.0.0.1:3002/api/…`
- `/mandi/…`     → static SPA, with a `try_files … /mandi/index.html` fallback so
  refreshing a deep link (e.g. `/mandi/dashboard`) works.

---

## 4. Verify
1. `https://nexussoftlab.com/mandi` loads the login screen (themed background).
2. DevTools → Network: the `login` request is `…/mandi/api/auth/login` → **200**.
3. Refresh on `/mandi/dashboard` — stays on the page (no 404).
4. Log in: **owner** (Super Admin) or **admin** (Org Admin), password `Mandi@123`.

---

## 5. Redeploying later
- **Backend:** `git pull && npm install && npm run build && pm2 restart mandi-api`
- **Frontend:** `git pull && VITE_BASE_PATH=/mandi/ VITE_API_URL=/mandi/api npm run build && sudo cp -r dist/* /var/www/mandi/`

---

## Notes
- **Local dev is unchanged.** With no `VITE_BASE_PATH`/`VITE_API_URL`, the base is
  `/` and the Vite dev proxy handles `/api` — run `npm run dev` as before.
- **Sub-domain instead of sub-path?** If you later use `mandi.nexussoftlab.com`,
  build with **no** `VITE_BASE_PATH` (base `/`) and `VITE_API_URL=/api`, point a
  server block for that host at `/var/www/mandi` + proxy `/api` to `:3002`.
- **Body size:** the API accepts up to 10 MB (image uploads / backup restore);
  nginx is set to `client_max_body_size 12m` to match.
- **PWA manifest:** installing as a PWA under a sub-path may need `start_url`
  adjusted in `public/manifest.webmanifest`; the web app itself works regardless.
- **DB schema** auto-creates via `DB_SYNC=true` (no migrations). Turn it off only
  if you switch to managed migrations.
