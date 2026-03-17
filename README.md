# Production Issue Dashboard

A real-time dashboard for tracking, triaging, and resolving production issues with Slack integration and AI-powered categorization.

## Features

- **Slack Integration** -- Report issues directly from Slack using slash commands or bot mentions; receive threaded updates and reminders in your channels.
- **AI Categorization & RCA** -- Automatically categorize incoming issues by type and severity, and generate root cause analysis suggestions using Claude or other LLM providers via LiteLLM.
- **Auto-Assignment** -- Round-robin assignment of new issues to team members based on current workload and availability.
- **Configurable Reminders** -- Periodic Slack reminders for open issues with per-team frequency and quiet-hours settings.
- **Dashboard & Analytics** -- Web UI showing open/in-progress/resolved issue counts, team-level stats, average resolution times, and historical trends.
- **Team Management** -- Create teams, add members with Slack identity mapping, and control notification preferences.
- **Full Audit Trail** -- Every status change, assignment, and update is recorded in the issue history.

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url> issue-dashboard
cd issue-dashboard
cp .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Bot token starting with `xoxb-` from your Slack app |
| `SLACK_APP_TOKEN` | App-level token starting with `xapp-` (for Socket Mode) |
| `SLACK_SIGNING_SECRET` | Signing secret from the Slack app settings page |
| `AI_API_KEY` | API key for your chosen AI provider |
| `AI_PROVIDER` | LLM provider name (default: `claude`) |
| `AI_MODEL` | Model identifier (default: `claude-sonnet-4-20250514`) |

### 2. Start with Docker Compose

```bash
docker-compose up -d
```

This starts three services:

- **db** -- PostgreSQL 16 on port 5432
- **backend** -- FastAPI server on port 8000 (runs migrations automatically on startup)
- **frontend** -- Vite/React dev server on port 3000

### 3. Access the dashboard

Open [http://localhost:3000](http://localhost:3000) in your browser.

The API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI) and [http://localhost:8000/redoc](http://localhost:8000/redoc) (ReDoc).

### 4. Set up the Slack bot

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and create a new app from scratch.
2. Under **Socket Mode**, enable it and generate an app-level token with the `connections:write` scope. Copy this as `SLACK_APP_TOKEN`.
3. Under **OAuth & Permissions**, add the following bot token scopes:
   - `chat:write` -- Send messages
   - `chat:write.public` -- Send messages to channels the bot is not a member of
   - `commands` -- Register slash commands
   - `channels:history` -- Read messages in public channels
   - `groups:history` -- Read messages in private channels
   - `im:history` -- Read direct messages
   - `users:read` -- Look up user info
   - `reactions:read` -- Read message reactions
4. Install the app to your workspace and copy the **Bot User OAuth Token** as `SLACK_BOT_TOKEN`.
5. Copy the **Signing Secret** from the app's Basic Information page as `SLACK_SIGNING_SECRET`.
6. Invite the bot to the channels where you want to track issues.

## Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start just the database
docker-compose up db -d

# Run migrations
alembic upgrade head

# Start the dev server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on port 3000 and proxies API requests to `http://localhost:8000`.

### Database only

If you only need PostgreSQL (e.g., when running backend and frontend locally):

```bash
docker-compose up db -d
```

### Running migrations

```bash
cd backend
alembic upgrade head       # Apply all pending migrations
alembic revision --autogenerate -m "description"  # Generate a new migration
```

## Architecture

```
                  +-------------------+
                  |   Slack Workspace |
                  +--------+----------+
                           |
                   Socket Mode / Events
                           |
         +-----------------v-----------------+
         |          FastAPI Backend           |
         |                                   |
         |  +-------------+  +------------+  |
         |  | Slack Bot   |  | REST API   |  |
         |  | (bolt)      |  | (routes)   |  |
         |  +------+------+  +-----+------+  |
         |         |               |          |
         |  +------v---------------v------+   |
         |  |     Service Layer           |   |
         |  |  - Issue CRUD               |   |
         |  |  - Team management          |   |
         |  |  - AI categorization        |   |
         |  |  - Reminder scheduler       |   |
         |  +-------------+---------------+   |
         |                |                   |
         +----------------+-------------------+
                          |
              +-----------v-----------+
              |     PostgreSQL 16     |
              |   (issue_dashboard)   |
              +-----------------------+

         +---------------------------------+
         |        React Frontend           |
         |  (Vite + TypeScript)            |
         |  - Dashboard view               |
         |  - Issue list & detail          |
         |  - Team management              |
         +---------------------------------+
```

### Key components

- **FastAPI Backend** -- Async Python web framework handling REST API and Slack events.
- **Slack Bolt** -- Slack SDK for receiving events via Socket Mode (no public URL needed for development).
- **LiteLLM** -- Unified interface to call Claude, GPT, or other LLM providers for issue categorization and RCA.
- **APScheduler** -- Background scheduler for sending periodic reminders on unresolved issues.
- **SQLAlchemy 2.0** -- Async ORM with PostgreSQL via asyncpg.
- **Alembic** -- Database migration management.
- **React + Vite** -- Frontend single-page application.

## API Endpoints

### Issues

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/issues` | List issues (filterable by status, team, assignee; paginated) |
| `POST` | `/api/issues` | Create a new issue |
| `GET` | `/api/issues/{id}` | Get issue details |
| `PUT` | `/api/issues/{id}` | Update an issue (status, priority, assignment, etc.) |
| `DELETE` | `/api/issues/{id}` | Delete an issue |
| `GET` | `/api/issues/{id}/history` | Get audit history for an issue |

### Teams

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teams` | List all teams |
| `POST` | `/api/teams` | Create a new team |
| `GET` | `/api/teams/{id}` | Get team details with members |
| `PUT` | `/api/teams/{id}` | Update team settings |
| `DELETE` | `/api/teams/{id}` | Delete a team |

### Team Members

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/teams/{id}/members` | Add a member to a team |
| `PUT` | `/api/teams/{id}/members/{member_id}` | Update member settings |
| `DELETE` | `/api/teams/{id}/members/{member_id}` | Remove a member from a team |

### Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Aggregate statistics (open, in-progress, resolved, critical counts, avg resolution time) |
| `GET` | `/api/dashboard/team-stats` | Per-team breakdown of issue counts and resolution metrics |

### Slack

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/slack/events` | Slack event subscription endpoint |
| `POST` | `/api/slack/commands` | Slash command handler |

## Configuration Reference

All configuration is via environment variables (or `.env` file).

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/issue_dashboard` | PostgreSQL connection string (must use `asyncpg` driver) |
| `SLACK_BOT_TOKEN` | (empty) | Slack bot user OAuth token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | (empty) | Slack app-level token for Socket Mode (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | (empty) | Slack request signing secret |
| `AI_PROVIDER` | `claude` | LiteLLM provider name (`claude`, `openai`, `azure`, etc.) |
| `AI_MODEL` | `claude-sonnet-4-20250514` | Model identifier passed to LiteLLM |
| `AI_API_KEY` | (empty) | API key for the chosen AI provider |
| `APP_BASE_URL` | `http://localhost:8000` | Public base URL of the backend (used in Slack messages for links) |
| `DEFAULT_REMINDER_FREQUENCY_MINUTES` | `120` | Default interval between reminders for unresolved issues |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins (JSON list) |
| `HOST` | `0.0.0.0` | Backend listen address |
| `PORT` | `8000` | Backend listen port |
