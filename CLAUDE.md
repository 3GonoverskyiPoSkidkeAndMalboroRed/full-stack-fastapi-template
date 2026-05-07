# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack web application template: FastAPI backend (Python) + React frontend (TypeScript) + PostgreSQL, all orchestrated with Docker Compose. Uses Traefik as reverse proxy in production.

## Common Commands

### Development (Docker Compose)

```bash
docker compose watch          # Start full stack with live reload
docker compose logs backend   # View backend logs
docker compose exec backend bash  # Shell into running backend container
docker compose down -v        # Stop and remove volumes
```

### Backend (from `backend/` directory)

```bash
uv sync                       # Install dependencies
source .venv/bin/activate     # Activate virtualenv
fastapi dev app/main.py       # Run local dev server (outside Docker)
```

### Backend Tests

```bash
# Full test cycle (builds, starts stack, runs tests, tears down):
bash ./scripts/test.sh

# If stack is already running:
docker compose exec backend bash scripts/tests-start.sh

# With pytest args (e.g., stop on first error):
docker compose exec backend bash scripts/tests-start.sh -x

# Run a single test file inside Docker:
docker compose exec backend bash -c "cd backend && coverage run -m pytest tests/api/test_items.py -v"
```

### Frontend (from `frontend/` directory)

```bash
bun install                   # Install dependencies
bun run dev                   # Run Vite dev server at localhost:5173
bun run build                 # TypeScript check + production build
bun run lint                  # Biome lint + format (auto-fix)
bun run generate-client       # Regenerate OpenAPI client from openapi.json
```

### Frontend E2E Tests (Playwright)

```bash
docker compose up -d --wait backend   # Start backend first
bunx playwright test                  # Run tests
bunx playwright test --ui             # Interactive UI mode
```

Tests use Chromium only. Auth state is set up once in `tests/auth.setup.ts`. CI runs sharded across 4 containers.

### Linting & Pre-commit

```bash
# From backend/ — run all pre-commit hooks manually:
uv run prek run --all-files

# Individual checks:
uv run ruff check --fix app           # Lint
uv run ruff format app                # Format
uv run mypy app                       # Type check
uv run bash scripts/lint.sh           # All: mypy + ty + ruff check + ruff format --check
uv run bash scripts/format.sh         # ruff check --fix + ruff format
```

### Database Migrations (inside backend container)

```bash
docker compose exec backend bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Generate Frontend Client from OpenAPI

```bash
bash ./scripts/generate-client.sh     # Generates openapi.json then runs client generator
```

## Architecture

### Backend (`backend/app/`)

- **Entry point**: `main.py` → FastAPI app with CORS, Sentry integration
- **API routes**: `api/routes/` — split by domain: `login.py`, `users.py`, `items.py`, `utils.py`, `private.py` (local-only)
- **Dependencies**: `api/deps.py` — injectable deps: `SessionDep`, `TokenDep`, `CurrentUser`, `get_current_active_superuser`
- **Router registration**: `api/main.py` — all routers mounted under `/api/v1`
- **Models**: `models.py` — SQLModel classes defining both DB tables and API schemas (User, Item with UUID PKs + all Create/Update/Public variants)
- **CRUD**: `crud.py` — database operations for users and items, includes timing-attack prevention in auth
- **Config**: `core/config.py` — Pydantic Settings reading from top-level `.env`
- **Database**: `core/db.py` — SQLAlchemy engine, `init_db()` seeds first superuser
- **Security**: `core/security.py` — JWT tokens (HS256), password hashing (Argon2+Bcrypt via pwdlib)
- **Migrations**: `alembic/` — Alembic configured to auto-import models from `models.py`
- **Startup**: `backend_pre_start.py` waits for DB, then `alembic upgrade head`, then `initial_data.py` seeds superuser

### Frontend (`frontend/src/`)

- **Routes**: `routes/` — TanStack Router file-based routing (`__root.tsx`, `_layout.tsx`, page files)
- **Components**: `components/` — Admin, Items, UserSettings, Common, Sidebar, Pending, UI (shadcn)
- **API client**: `client/` — auto-generated from backend OpenAPI schema via `@hey-api/openapi-ts`
- **Hooks**: `hooks/` — custom React hooks
- **API connectivity**: Frontend does NOT proxy through nginx. Browser calls backend directly using `VITE_API_URL` (set at build time)

### Docker Compose Structure

- `compose.yml` — production config (db, adminer, prestart, backend, frontend; uses external Traefik network)
- `compose.override.yml` — dev overrides: adds Traefik proxy, mailcatcher, Playwright container, source volume mounts, `--reload` flag
- `compose.traefik.yml` — standalone Traefik for production HTTPS

### Key Services & Ports (dev)

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 8000 | http://localhost:8000 |
| Adminer | 8080 | http://localhost:8080 |
| Traefik UI | 8090 | http://localhost:8090 |
| Mailcatcher | 1080 | http://localhost:1080 |

### Environment

- Config via top-level `.env` file (required vars: `SECRET_KEY`, `POSTGRES_PASSWORD`, `FIRST_SUPERUSER_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`, `FIRST_SUPERUSER`)
- Backend reads `../.env` relative to `backend/` via Pydantic Settings
- `ENVIRONMENT` controls behavior: `local` enables private routes and relaxes secret validation

### Pre-commit Hooks

Runs via `prek` (installed via `uv run prek install -f` from `backend/`): ruff check, ruff format, mypy, ty, biome (frontend), OpenAPI client regeneration, release date stamping.

### Backend Tooling

- **Python**: 3.10+, managed by `uv`
- **Linting**: ruff (with rules: E, W, F, I, B, C4, UP, ARG001, T201)
- **Type checking**: mypy (strict), ty
- **Testing**: pytest + coverage (90% threshold enforced in CI)
- **Formatting**: ruff format

### Frontend Tooling

- **Runtime**: Bun (preferred) or Node.js
- **Linting/Formatting**: Biome
- **Framework**: React 19 + TypeScript + TanStack Query + TanStack Router + Tailwind CSS v4 + shadcn/ui
- **E2E**: Playwright
