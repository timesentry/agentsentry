# AgentSentry

**Open-source agent chronometry, tokenomics, and orchestration.**

Built by [TimeSentry AI](https://timesentry.ai) — because if you're running AI agents, you should understand exactly what they're doing, how long they're doing it, and what it costs.

AgentSentry is a self-hosted platform for tracking AI agent sessions in real time. It captures transcripts, measures token consumption, auto-classifies work by project, and gives you a dashboard to make sense of it all. Think of it as the missing observability layer for your AI workforce.

## Philosophy

AI agents are becoming teammates. Like any teammate, you need visibility into their work — not to micromanage, but to understand. AgentSentry exists because:

- **Agents should be accountable.** Every session, every token, every minute — tracked and queryable.
- **Cost visibility shouldn't be an afterthought.** Real-time tokenomics means no surprises on your next invoice.
- **Open source is the right default.** Agent tooling is infrastructure. Infrastructure should be inspectable, forkable, and community-driven.

## Architecture

```
┌──────────────┐     hooks      ┌──────────────┐     REST      ┌──────────────┐
│  Claude Code │ ──────────────►│   Backend    │◄──────────────│   Frontend   │
│  (+ plugin)  │   POST /v1/   │  Flask + PG  │   /api/*      │  React+Vite  │
└──────────────┘  sessions/     └──────────────┘               └──────────────┘
```

- **Plugin** — Claude Code hooks that automatically ship session transcripts to the backend after every response.
- **Backend** — Flask API with PostgreSQL. Ingests sessions, extracts token counts, runs background AI classification (via Claude Haiku), and serves analytics.
- **Frontend** — React dashboard with real-time analytics, timeline visualizations, and project/agent management.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- An [Anthropic API key](https://console.anthropic.com/) (for auto-classification)

### 1. Clone & configure

```bash
git clone https://github.com/timesentry/agentsentry.git
cd agentsentry
cp .env.example .env
```

Edit `.env` and set your `ANTHROPIC_API_KEY` and a random `SECRET_KEY`.

### 2. Start the stack

```bash
make dev
```

This launches PostgreSQL, the Flask backend (port 5000), and the Vite dev server (port 5173).

### 3. Register & create an agent

1. Open [http://localhost:5173/register](http://localhost:5173/register)
2. Create an account
3. Go to **Agents** and create a new agent
4. Copy the API key (`tsk_...`)

### 4. Install the Claude Code plugin

Launch Claude Code with the plugin directory pointed at this repo:

```bash
claude --plugin-dir ./plugin
```

Then configure with the skill command:

```
/agentsentry --apiKey tsk_your_key_here
```

Or manually create a `.agentsentry` file in your project root:

```
AGENTSENTRY_API_KEY=tsk_your_key_here
AGENTSENTRY_URL=http://localhost:5000
```

That's it. Every Claude Code session in that project will now be tracked automatically.

## Features

### Session Tracking
- Automatic transcript capture via Claude Code hooks
- Token extraction from JSONL transcripts (input + output tokens)
- Duration tracking with start/end timestamps
- Heartbeat support for long-running sessions

### AI Classification
- Background auto-classification of session descriptions using Claude Haiku
- Automatic project assignment based on transcript content
- Incremental classification — only processes new content since last classification

### Analytics Dashboard
- **Summary cards** — Active agents, total hours, total tokens, session count
- **Breakdown charts** — Hours and tokens by project or agent (pie/bar toggle)
- **Session timeline** — Stacked area chart of token usage over time, with collapsible session groups (groupable by project or agent)
- **Date range filtering** — All analytics scoped to configurable UTC date ranges

### Project & Agent Management
- Organize agents into projects
- Per-agent API keys with rotation support
- Multi-user with data isolation

## Plugin System

AgentSentry hooks into Claude Code's lifecycle events:

| Hook | When | What |
|------|------|------|
| `SessionStart` | Session begins | Loads `.agentsentry` credentials |
| `Stop` | After each response | Ships transcript to backend |
| `SessionEnd` | Session ends | Final transcript upload |

The plugin searches for `.agentsentry` starting from the working directory and walking up to the root, falling back to `~/.agentsentry` for a global default. This means you can have per-project configs (different agents, different servers) or a single global config.

## Development

```bash
make dev          # Start all services
make stop         # Stop all services
make logs         # Tail logs
make shell        # Flask shell
make db-migrate   # Create a new migration
make db-upgrade   # Apply migrations
make clean        # Stop and remove volumes
```

### Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.12, Flask, SQLAlchemy, PostgreSQL 16 |
| Frontend | React 19, TypeScript, Vite, TailwindCSS, Recharts |
| Plugin | Bash hooks for Claude Code |
| Infra | Docker Compose |
| AI | Anthropic Claude API (Haiku for classification) |

## Configuration

### Environment Variables (`.env`)

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `DATABASE_URL` | Full connection string |
| `SECRET_KEY` | Flask session secret |
| `ANTHROPIC_API_KEY` | For AI session classification |

### Agent Config (`.agentsentry`)

| Key | Description |
|-----|-------------|
| `AGENTSENTRY_API_KEY` | Agent bearer token (`tsk_...`) |
| `AGENTSENTRY_URL` | Backend URL (default: `http://localhost:5000`) |

## API

### Agent-Facing (Bearer token auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/sessions/` | Create or update a session |
| `POST` | `/api/v1/sessions/heartbeat` | Keep-alive ping |

### Dashboard (Session cookie auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/` | Analytics for date range |
| `GET` | `/api/entries/` | List session entries |
| `GET` | `/api/entries/:id/transcript` | Get session transcript |
| `CRUD` | `/api/agents/` | Manage agents |
| `CRUD` | `/api/projects/` | Manage projects |

## TimeSentry AI

AgentSentry is built by [TimeSentry AI](https://timesentry.ai), where we build the full stack for AI-era time intelligence — from human time tracking to autonomous agent orchestration.

AgentSentry covers the self-hosted, open-source side of agent observability. If your needs grow beyond that — multi-team dashboards, cost allocation across departments, compliance-grade audit trails, integrations with billing and project management tools, or managed infrastructure so you don't have to run your own stack — that's what [timesentry.ai](https://timesentry.ai) is for.

The way we see it: agents are the new workforce, and every workforce needs timekeeping. We're building the tools to make that simple, whether you're a solo developer running Claude Code or an enterprise managing hundreds of AI agents across teams.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Contributions welcome. Open an issue or submit a PR.

---

Built by [TimeSentry AI](https://timesentry.ai).
