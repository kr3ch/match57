# MATCH 57 — Deployment Guide

Production architecture is a clean two-tier split:

```
┌─────────────────────────────────────┐         ┌──────────────────────────┐
│  Frontend  (static files)           │  HTTPS  │  Backend  (FastAPI + WS)│
│  https://kr3ch.github.io/match57    │ ──────▶ │  https://<api-host>      │
│  GitHub Pages                       │   WS    │  Fly.io / Render / etc.  │
│  Next.js → static export → /out     │ ──────▶ │  SQLite on a volume      │
└─────────────────────────────────────┘         └──────────────────────────┘
```

The frontend is a Next.js app exported to **static HTML** and served by GitHub
Pages. The backend is a FastAPI service that owns the database and the
WebSocket endpoint; it must live on a host that supports persistent storage and
WebSockets (GitHub Pages does **not** support either, that's why the backend
must be deployed elsewhere).

---

## 1. Local development

### Backend (FastAPI + SQLite)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
# generate a session secret and paste into .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
uvicorn app.main:app --reload --port 8000
```

The first request creates `data/match57.db` automatically.

### Frontend (Next.js dev server)

```bash
cd frontend
cp .env.local.example .env.local
# leave NEXT_PUBLIC_API_BASE empty in dev — the next.config.js rewrite proxies
# /api/* to NEXT_PUBLIC_API_URL (default http://localhost:8000)
npm install
npm run dev
```

Open <http://localhost:3000>. Email-verification links are printed to the
backend stdout (no SMTP config needed).

### Quality gates

```bash
# backend
cd backend && source .venv/bin/activate
pytest && ruff check app && ruff format --check app && mypy app

# frontend
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

## 2. Backend — Deploy to Fly.io

Fly.io has a generous free tier, native Docker, persistent volumes (we need
those for SQLite + uploaded media), and automatic HTTPS. The exact same
Dockerfile also runs on Render, Railway, Koyeb, fly's auto-deploys from CI,
etc.

### One-time setup

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
flyctl auth signup     # or: flyctl auth login

cd backend
flyctl launch --no-deploy --copy-config --name match57-api --region fra
```

`flyctl launch` will:
- create the app `match57-api`
- read `fly.toml` (already in the repo)
- prompt to attach a 1 GB persistent volume named `match57_data` mounted at
  `/data` (this is where `match57.db` and `uploads/` live)

### Set production secrets

```bash
# Required
flyctl secrets set SESSION_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')"

# Whitelist your frontend origin (GH Pages root is the cookie origin —
# basePath /match57 does NOT change the origin)
flyctl secrets set FRONTEND_ORIGINS="https://kr3ch.github.io"

# Public URL of the frontend (used in email-verify links)
flyctl secrets set PUBLIC_BASE_URL="https://kr3ch.github.io/match57"

# Cookies must be SameSite=None+Secure for cross-origin auth from GH Pages
flyctl secrets set COOKIE_SAMESITE="none" COOKIE_SECURE="1"

# (optional) admin auto-flag on first register
flyctl secrets set ADMIN_EMAILS="you@example.com"

# (optional) real email delivery — leave unset to log links to stdout
flyctl secrets set \
  SMTP_HOST="smtp.gmail.com" \
  SMTP_PORT="587" \
  SMTP_USER="you@gmail.com" \
  SMTP_PASS="<app password>" \
  SMTP_FROM="MATCH 57 <noreply@match57.app>"
```

### Deploy

```bash
flyctl deploy
flyctl status
flyctl logs       # follow logs
flyctl open       # open https://match57-api.fly.dev/health in browser
```

`/health` should return `{"status":"ok","version":"2.0.0"}`.

### Updating

```bash
git push origin trunk
cd backend && flyctl deploy
```

Fly's volumes survive redeploys; SQLite + uploads persist.

> **Database backups.** SQLite lives at `/data/match57.db`. Snapshot via:
> ```
> flyctl ssh sftp get /data/match57.db ./backup-$(date +%F).db
> ```

---

## 3. Frontend — Deploy to GitHub Pages

GitHub Pages serves static files from the `gh-pages` branch (or the
`actions/deploy-pages` artifact). We use the latter — it's wired up in
`.github/workflows/pages.yml` and runs on every push to `trunk`.

### One-time repo setup

1. **Settings → Pages** → *Source* = "GitHub Actions".
2. **Settings → Environments → `github-pages`** is auto-created on the first
   workflow run; no manual config needed.
3. **Settings → Secrets and variables → Actions → Variables** add:
   - `NEXT_PUBLIC_API_BASE` = `https://match57-api.fly.dev`  (your Fly.io URL)
   - `NEXT_PUBLIC_BASE_PATH` = `/match57`  (omit if your repo is named
     `<user>.github.io`)

The workflow will read these at build time. They are **public** — anything in
`NEXT_PUBLIC_*` is baked into the bundle. That's fine: the API URL is not
secret, only the cookies are.

### Trigger a deploy

```bash
git push origin trunk
# or run "Deploy frontend to GitHub Pages" from Actions tab manually
```

The workflow runs `npm run lint`, `npm run typecheck`, then
`STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/match57 npm run build`, and uploads
`frontend/out` to the Pages environment.

When green, the site is live at:

```
https://kr3ch.github.io/match57/
```

### SPA routing (refresh-on-deep-link)

Next.js with `output: 'export'` and `trailingSlash: true` produces a separate
HTML file for every route, so refreshing on `/chat/?id=42` works out of the
box. The workflow also copies `index.html` to `404.html` as a soft fallback,
so any unknown path still hydrates the React app.

### Build locally (sanity check)

```bash
cd frontend
STATIC_EXPORT=1 \
NEXT_PUBLIC_BASE_PATH=/match57 \
NEXT_PUBLIC_API_BASE=https://match57-api.fly.dev \
  npm run build

# Result is in ./out — try it under a static server:
npx serve out -p 4000 -l tcp://0.0.0.0:4000
```

---

## 4. Production architecture summary

| Concern         | Where                                          |
|-----------------|------------------------------------------------|
| HTML / JS / CSS | GitHub Pages (`kr3ch.github.io/match57`)       |
| HTTP API        | Fly.io (`match57-api.fly.dev`)                 |
| WebSocket       | Fly.io same host (`wss://match57-api.fly.dev/api/ws`) |
| SQLite DB       | Fly.io persistent volume mounted at `/data`    |
| Uploads (media) | Fly.io persistent volume `/data/uploads`       |
| CORS            | `FRONTEND_ORIGINS=https://kr3ch.github.io`     |
| Cookies         | `SameSite=None; Secure; HttpOnly`              |
| Email           | stdout (default) / SMTP if `SMTP_HOST` set     |

### Things to remember when deploying changes

- Backend changes → `cd backend && flyctl deploy`
- Frontend changes → push to `trunk`; GH Actions auto-deploys
- Schema changes → backend `lifespan` calls `Base.metadata.create_all`, which
  is idempotent for **new** tables only. For ALTER TABLE migrations, generate
  an Alembic migration:
  ```bash
  cd backend
  alembic revision --autogenerate -m "your message"
  alembic upgrade head
  ```
- Rotating cookies → `flyctl secrets set SESSION_SECRET=…` will invalidate all
  active sessions (users will need to log in again).

---

## 5. Self-hosting somewhere other than Fly.io

The Dockerfile is host-agnostic. Anywhere that supports Docker + a persistent
volume + WebSockets will work. Examples:

- **Render** — connect repo, set Dockerfile path to `backend/Dockerfile`,
  attach a 1 GB disk at `/data`, set the env vars listed above.
- **Railway** — `railway up` from `backend/`, attach a volume at `/data`.
- **Self-hosted VPS** — `docker run -p 8080:8080 -v match57_data:/data ...` and
  put nginx in front for HTTPS.

In all cases, point the frontend's `NEXT_PUBLIC_API_BASE` at the public URL
of your backend.
