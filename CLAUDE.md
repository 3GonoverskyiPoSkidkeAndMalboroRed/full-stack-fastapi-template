# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack overview

- **Backend** (`backend/`): FastAPI + SQLModel + Alembic + PostgreSQL, dependencies managed by `uv`.
- **Frontend** (`frontend/`): React 19 + Vite + TypeScript with TanStack Router (file-based routing) and TanStack Query, shadcn/ui (style `new-york`, base color `neutral`) over Tailwind CSS v4. Linter/formatter: **Biome** (not ESLint/Prettier). Package manager: **Bun**.
- **Dev orchestration**: `docker compose watch` brings up backend, frontend, Postgres, Adminer, Mailcatcher, Traefik. See `development.md` for ports and local-vs-Docker swap workflow (services share ports so you can stop one and run it natively).

## Commands

### Run the stack
```bash
docker compose watch                              # full stack with hot-reload
docker compose exec backend bash                  # shell into backend container
```

### Backend (run from `backend/`)
```bash
uv sync                                           # install deps
fastapi dev app/main.py                           # dev server (after stopping the docker `backend` service)
bash scripts/test.sh                              # full pytest + coverage (htmlcov/)
bash scripts/tests-start.sh -x                    # run tests inside running container, stop on first error
uv run pytest tests/api/routes/test_items.py::test_read_items -v   # single test
bash scripts/lint.sh                              # mypy + ty + ruff check + ruff format --check
bash scripts/format.sh                            # ruff fix + format
alembic revision --autogenerate -m "..."          # new migration (run inside container)
alembic upgrade head                              # apply migrations
```

`scripts/lint.sh` runs **both** `mypy` and `ty` (Astral's type checker, configured with `error-on-warning = true`). Both must pass; `ty` is stricter and frequently catches issues `mypy` misses.

### Frontend (run from `frontend/`, or use root workspace scripts)
```bash
bun install
bun run dev                                       # vite dev server on :5173
bun run lint                                      # biome check --write
bun run build                                     # tsc --build + vite build
bunx playwright test                              # E2E (requires backend up: docker compose up -d --wait backend)
bunx playwright test tests/auth.spec.ts           # single E2E test
```

### Full integration tests (Docker)
```bash
bash scripts/test.sh                              # builds, brings stack up, runs backend tests, tears down
```

## OpenAPI client generation — critical workflow

The frontend SDK in `frontend/src/client/` is **fully auto-generated** by `@hey-api/openapi-ts` from the backend's OpenAPI schema. **Whenever you change backend routes, request/response models, or add a new router**, you must regenerate the client:

```bash
bash scripts/generate-client.sh                   # exports openapi.json from app.main.app, runs openapi-ts, then biome lint
```

Notes on the generated SDK:
- `backend/app/main.py` defines `custom_generate_unique_id` → operation IDs are `{tag}-{route_name}`.
- `frontend/openapi-ts.config.ts` strips the leading service/tag from method names. This is why the SDK exports flat functions like `itemsReadItems`, `itemsCreateItem`, `categoriesReadCategories`, `sizesReadSizes` rather than namespaced classes. Import them directly from `@/client`.
- Generated files (`frontend/src/client/**`) and `frontend/src/components/ui/**` (shadcn) are **excluded from Biome** (`frontend/biome.json`) — do not hand-edit them; regenerate or use `bunx shadcn add` instead.
- A `prek` (pre-commit) hook auto-regenerates the client when `backend/**` or `scripts/generate-client.sh` change.

## Backend architecture

### Models layout (`backend/app/models/`)
Models are split per domain into separate files (`user.py`, `item.py`, `category.py`, `size.py`, `token.py`, `message.py`) and re-exported from `models/__init__.py`. Always import via the package: `from app.models import Item, ItemCreate, ...`.

For each entity the SQLModel pattern is: `XxxBase` (shared fields) → `XxxCreate` / `XxxUpdate` (request bodies) → `Xxx` (DB table, `table=True`) → `XxxPublic` / `XxxsPublic` (response models with `count`). When adding a new entity, follow this five-class shape so both `crud.py` and the generated frontend types stay symmetric.

Cross-model imports must use `if TYPE_CHECKING:` for type-only references and `Relationship(back_populates=...)` for runtime relations to avoid SQLModel relationship init bugs (`Item` ↔ `User`, `Category`, `Size` already do this).

### Domain relationships
`Item` has FKs to `User` (owner, `ondelete=CASCADE`), `Category`, and `Size` — all three optional except owner. `crud.py` validates referenced FK rows exist; `routes/items.py` re-validates them on `POST`/`PUT`.

### Routing & authorization
- `app/api/main.py` mounts routers under `settings.API_V1_STR` (`/api/v1`). The `private` router is only mounted when `ENVIRONMENT == "local"`.
- `app/api/deps.py` exposes `SessionDep`, `CurrentUser`, `get_current_active_superuser`. Use the `Annotated[..., Depends(...)]` aliases in route signatures.
- **Owner-based access control**: in `items` routes, superusers see all items; normal users see only `Item.owner_id == current_user.id` and get `403` on others' items. Mirror this pattern when adding owned resources.

### Database lifecycle
- `app/core/db.py::init_db` seeds the first superuser (from `FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD`), then categories, sizes, items — all in Russian (`SEED_CATEGORIES`, `SEED_ITEMS`). Seeding is idempotent (skipped if rows exist).
- `scripts/prestart.sh` runs `alembic upgrade head` then `init_db` on every container start.
- Tests **share the live database**: `tests/conftest.py` calls `init_db` once per session and deletes `Item`/`Category`/`User` rows on teardown. There is no per-test rollback — design tests accordingly.

### Auth specifics
- JWT bearer with `OAuth2PasswordBearer(tokenUrl=f"{API_V1_STR}/login/access-token")`.
- `crud.authenticate` runs a dummy Argon2 verification when the user is missing to prevent timing attacks — keep this branch when refactoring login.
- Password hashing uses `pwdlib` with Argon2 + bcrypt fallback.

### Settings
`app/core/config.py` reads `../.env` (one level above `backend/`). Validators raise on `"changethis"` defaults outside `local` env. `SQLALCHEMY_DATABASE_URI` is computed; do not set it directly.

## Frontend architecture

### Routing
File-based via `@tanstack/router-plugin/vite`. Routes live in `frontend/src/routes/`; the generated `routeTree.gen.ts` is committed and updated automatically by Vite. The `_layout/` segment is the authenticated shell — its `beforeLoad` redirects to `/login` if `localStorage.access_token` is missing (`hooks/useAuth.ts::isLoggedIn`).

### Data fetching pattern
Pages use `useSuspenseQuery` wrapped in `<Suspense fallback={<PendingX />}>`. Mutations use `useMutation` with `onSettled` invalidating relevant query keys (e.g., `["items"]`). See `routes/_layout/items.tsx` and `components/Items/AddItem.tsx` as the canonical templates when adding new resources.

### HTTP client config
`frontend/src/main.tsx` calls `client.setConfig({ baseUrl: import.meta.env.VITE_API_URL, auth: () => localStorage.getItem("access_token") || "", throwOnError: true })` and registers an error interceptor that clears the token and redirects to `/login` on 401/403. All SDK functions inherit this config — do not create a second axios client.

### Forms
`react-hook-form` + `zod` resolver, with shadcn `Form/FormField/FormItem/FormControl/FormMessage` wrappers. Toasts via `sonner` through `useCustomToast`; errors funneled through `utils.ts::handleError`.

### Path aliases & UI
- `@/` → `frontend/src/` (set in `vite.config.ts` and `tsconfig.json`).
- shadcn aliases: `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`. Add new shadcn primitives with `bunx shadcn add <name>` rather than hand-coding them.
- Tailwind v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`); theme tokens live in `src/index.css`.

## Code style & tooling guardrails

- **Ruff**: configured for Python 3.10+, excludes `alembic/`. Notable rules: `T201` forbids `print()`, `ARG001` forbids unused function args, `E501` (line length) is disabled.
- **Biome**: 2-space indent, double quotes, semicolons as needed, organize imports on save. `noNonNullAssertion` and `noExplicitAny` are off; `useSelfClosingElements` and `noUselessElse` are errors.
- **mypy**: `strict = true`, excludes `alembic/`, `venv/`, `.venv/`.
- **ty**: `error-on-warning = true` — warnings will fail the lint step.
- Pre-commit (`prek`) runs all of the above plus client regeneration before each commit. To install: `uv run prek install -f` from `backend/`.

## Russian-language content

Seed data, default UI strings in Russian seeded data, and several recent commit messages are in Russian — preserve Russian content when editing existing seeds, fixtures, or comments unless explicitly asked to translate.
