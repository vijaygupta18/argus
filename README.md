# Argus — Production Issue Dashboard

Real-time dashboard for tracking, triaging, and resolving production issues — with Slack integration, AI-powered RCA, and team management.

**Production URL**: https://argus.internal.nammayatri.in
**Deployment**: EKS `monitoring` namespace, single-container pod on SPOT nodes
**Deploy reference**: [`prodk8s/DEPLOY.md`](prodk8s/DEPLOY.md)

---

## What it does

- **Slack-first reporting** — Issues reported in Slack threads are automatically captured; bot posts updates back in the same thread
- **AI Root Cause Analysis** — Streams live investigation via Vishwakarma (SSE), renders full markdown RCA in the dashboard
- **Smart assignment** — Issues assigned to workers (not leaders); assignees get DM'd; leaders get notified on every assignment/reassignment
- **Team roles** — Each team has workers (get assigned) and leaders (oversee, never assigned, always notified)
- **Configurable reminders** — Per-team Slack reminders on unresolved issues with custom frequency and start hour
- **Google OAuth** — Login with `@nammayatri.in` Google accounts; admin access controlled via `ADMIN_EMAILS`
- **Full audit trail** — Every status change, assignment, and resolution reason is recorded in issue history

---

## Architecture

```
Slack Workspace
      │ Socket Mode (bolt)
      ▼
┌─────────────────────────────────────────┐
│           FastAPI Backend (port 8000)    │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  Slack Bot  │  │   REST API       │  │
│  │  (bolt)     │  │  /api/*          │  │
│  └──────┬──────┘  └────────┬─────────┘  │
│         └────────┬─────────┘            │
│         ┌────────▼─────────┐            │
│         │  Service Layer   │            │
│         │  - Issues CRUD   │            │
│         │  - Assignment    │            │
│         │  - AI / RCA      │            │
│         │  - Reminders     │            │
│         │  - Notifications │            │
│         └────────┬─────────┘            │
│                  │ asyncpg              │
│         ┌────────▼─────────┐            │
│         │   PostgreSQL     │            │
│         │ schema: argus    │            │
│         │ db: atlas_driver │            │
│         │     _offer_bpp   │            │
│         └──────────────────┘            │
│                                         │
│  /assets, /  → React SPA (static)       │
└─────────────────────────────────────────┘
```

Single container — FastAPI serves the React SPA from `/app/static` and proxies nothing. No nginx.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async, asyncpg |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, react-query |
| Database | PostgreSQL (shared `atlas_driver_offer_bpp`, schema `argus`) |
| AI / RCA | Vishwakarma via SSE streaming |
| Slack | slack-bolt, Socket Mode (no public URL needed) |
| Auth | Google OAuth 2.0 + JWT |
| Scheduler | APScheduler (reminder service) |
| Container | Single Docker image, EKS SPOT nodes |

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in secrets

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # runs on :5173, proxies /api → localhost:8000
```

> The frontend dev server proxies `/api/*` to `http://localhost:8000` via `vite.config.ts`.

### Database

Schema is **not managed by Alembic migrations** — it's set up once manually:

```bash
psql "postgresql://cloud_admin:...@<host>:5432/atlas_driver_offer_bpp" \
  -f prodk8s/init.sql
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db` |
| `DB_SCHEMA` | PostgreSQL schema (default: `argus`) |
| `DB_USER` | DB user (for reference only) |
| `DB_NAME` | DB name (for reference only) |
| `SLACK_BOT_TOKEN` | `xoxb-...` bot OAuth token |
| `SLACK_APP_TOKEN` | `xapp-...` app-level token (Socket Mode) |
| `SLACK_SIGNING_SECRET` | From Slack app Basic Information page |
| `AI_PROVIDER` | `openai` (uses LiteLLM routing) |
| `AI_MODEL` | e.g. `openai/open-large` |
| `AI_FAST_MODEL` | Fast model for quick operations |
| `AI_API_BASE` | Custom AI API base URL (e.g. internal grid) |
| `AI_API_KEY` | API key for AI provider |
| `AI_MAX_TOKENS` | Max tokens per AI response |
| `AI_TEMPERATURE` | AI temperature (default: `0.1`) |
| `VISHWAKARMA_URL` | RCA service URL |
| `VISHWAKARMA_API_KEY` | RCA service API key |
| `VISHWAKARMA_TIMEOUT` | SSE stream timeout in seconds |
| `APP_BASE_URL` | Public URL used in Slack deep-links |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `ADMIN_EMAILS` | Comma-separated emails with admin access |
| `ALLOWED_EMAIL_DOMAIN` | Restrict login to this domain (e.g. `nammayatri.in`) |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `JWT_SECRET` | Secret for signing JWTs — **rotate before production** |
| `JWT_EXPIRY_HOURS` | JWT lifetime (default: `720` = 30 days) |
| `DEFAULT_REMINDER_FREQUENCY_MINUTES` | Default reminder interval per team |

---

## API Reference

### Issues
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/issues` | List issues (filter: status, team, assignee, priority) |
| `POST` | `/api/issues` | Create issue |
| `GET` | `/api/issues/{id}` | Issue detail with history |
| `PATCH` | `/api/issues/{id}` | Update (status, assignment, priority, etc.) |
| `DELETE` | `/api/issues/{id}` | Delete issue |
| `POST` | `/api/issues/{id}/resolve` | Resolve with reason |
| `GET` | `/api/issues/{id}/rca/stream` | Stream AI RCA (SSE) |

### Teams
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teams` | List teams |
| `POST` | `/api/teams` | Create team (admin only) |
| `GET` | `/api/teams/{id}` | Team with members |
| `PATCH` | `/api/teams/{id}` | Update settings |
| `DELETE` | `/api/teams/{id}` | Delete team (admin only) |

### Members
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teams/{id}/members` | List members |
| `POST` | `/api/teams/{id}/members` | Add member |
| `PATCH` | `/api/members/{id}` | Update member (role, active, mute) |
| `DELETE` | `/api/members/{id}` | Remove member |

### Auth
| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/login` | Redirect to Google OAuth |
| `GET` | `/auth/callback` | OAuth callback → JWT |
| `GET` | `/api/auth/me` | Current user info |

### Other
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (DB ping) |
| `GET` | `/api/dashboard/stats` | Aggregate stats |
| `GET` | `/api/dashboard/team-stats` | Per-team stats |

---

## Team Roles

| Role | Assigned issues | Slack DMs |
|---|---|---|
| `worker` | ✓ Can be assigned | On assignment to them |
| `leader` | ✗ Never assigned | On every assignment/reassignment in the team |

Toggle via the team member card in the dashboard (admin only).

---

## Deployment

See **[`prodk8s/DEPLOY.md`](prodk8s/DEPLOY.md)** for the full production deployment guide including:
- Building and pushing Docker images
- `kubectl` deploy commands
- Port-forward setup for local testing against prod k8s
- Secret rotation
- Current image version history
