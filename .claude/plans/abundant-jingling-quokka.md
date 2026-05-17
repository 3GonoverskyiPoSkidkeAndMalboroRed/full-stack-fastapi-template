# Упрощение стека: Bun → npm, Biome → ESLint+Prettier, Traefik → nginx, удаление Adminer

## Context

Шаблон `full-stack-fastapi-template` тянет много «модных» инструментов (Bun, Biome, Traefik, Adminer) поверх привычных альтернатив (npm, ESLint+Prettier, nginx). Пользователь хочет привести стек к более стандартному виду — чтобы локальное окружение поднималось без установки нишевых рантаймов и чтобы новый разработчик не учил отдельный CLI на каждый шаг.

**Что меняется:**
1. **Bun → npm** (фронтенд + воркспейсы + Docker + CI)
2. **Biome → ESLint 9 (flat config) + Prettier 3** (с эквивалентным набором правил)
3. **Traefik → nginx** (и в dev, и в prod)
4. **Adminer удаляется полностью** (DB смотрится через любой внешний клиент)
5. **Mailcatcher остаётся**, перевешиваем с Traefik-лейблов на nginx-route

**Что НЕ меняется:** TanStack Router/Query, shadcn, Tailwind v4, FastAPI, SQLModel, Alembic, uv (Python), Mailcatcher, Docker compose, pre-commit/prek, Playwright.

**Важное предупреждение про prod nginx:** Traefik делал TLS+ACME автоматически через лейблы. У nginx это руками — потребуется либо отдельный сайдкар `nginxproxy/acme-companion`, либо ручной certbot. План закладывает связку `nginx-proxy + acme-companion` как наименее болезненный вариант.

---

## Поэтапный план

### Этап 1. Bun → npm

**Файлы:**

- `package.json` (корень) — оставить `workspaces: ["frontend"]` (npm понимает тот же формат), переписать скрипты:
  ```json
  "scripts": {
    "dev":     "npm -w frontend run dev",
    "lint":    "npm -w frontend run lint",
    "format":  "npm -w frontend run format",
    "test":    "npm -w frontend run test",
    "test:ui": "npm -w frontend run test:ui"
  }
  ```
- `frontend/package.json` — заменить `bunx playwright` → `npx playwright` в `test`/`test:ui`. Добавить `"engines": { "node": ">=20" }`. Скрипт `lint` будет переписан на этапе 2.
- `frontend/Dockerfile` — `oven/bun:1` → `node:20-alpine`, `bun install` → `npm ci`, `bun run build` → `npm run build`. Копировать `package-lock.json` вместо `bun.lock`.
- `frontend/Dockerfile.playwright` — удалить блок установки bun (строки 8–9), `bun install` → `npm ci`. Базовый образ `mcr.microsoft.com/playwright` уже содержит Node + npm.
- `scripts/generate-client.sh` — `bun run --filter frontend generate-client` → `npm -w frontend run generate-client`, `bun run lint` → `npm run lint`.
- `.github/workflows/playwright.yml` — `oven-sh/setup-bun@v2` → `actions/setup-node@v4` (`node-version: 20`); `bun ci` → `npm ci`; `bunx playwright` → `npx playwright`.
- `.github/workflows/pre-commit.yml` — то же самое (`setup-bun` → `setup-node`, `bun ci` → `npm ci`).
- `bun.lock` / `bun.lockb` — удалить, выполнить `npm install` для генерации `package-lock.json`.

**Ловушки:** воркспейсы npm работают так же, как у Bun, синтаксис `npm -w frontend run …` эквивалентен `bun run --filter frontend …`. Команда `bun ci` в текущих CI — артефакт, у Bun её нет; npm её действительно поддерживает.

---

### Этап 2. Biome → ESLint 9 (flat config) + Prettier 3

**Удалить:**
- `frontend/biome.json`
- Зависимость `@biomejs/biome` из `frontend/package.json`

**Добавить devDependencies в `frontend/package.json`:**
```
eslint                              ^9
typescript-eslint                   ^8
@eslint/js                          ^9
eslint-plugin-react                 ^7
eslint-plugin-react-hooks           ^5
eslint-config-prettier              ^9
prettier                            ^3
prettier-plugin-tailwindcss         ^0.6
```

**Создать `frontend/eslint.config.js`** (flat config, эквивалент текущим Biome-правилам):
```js
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import prettier from "eslint-config-prettier"

export default tseslint.config(
  { ignores: [
      "dist/**", "node_modules/**",
      "src/routeTree.gen.ts",
      "src/client/**",
      "src/components/ui/**",
      "playwright-report/**",
      "playwright.config.ts",
  ]},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { plugins: { react, "react-hooks": reactHooks },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: "detect" } },
    rules: {
      // Эквивалент Biome
      "@typescript-eslint/no-explicit-any": "off",        // suspicious.noExplicitAny
      "@typescript-eslint/no-non-null-assertion": "off",  // style.noNonNullAssertion
      "react/no-array-index-key": "off",                  // suspicious.noArrayIndexKey
      "no-param-reassign": "error",                       // style.noParameterAssign
      "react/self-closing-comp": "error",                 // style.useSelfClosingElements
      "no-else-return": "error",                          // style.noUselessElse
      ...reactHooks.configs.recommended.rules,
    }
  },
  prettier,  // отключает форматирующие правила, которые конфликтуют с prettier
)
```

**Создать `frontend/.prettierrc.json`** (эквивалент Biome formatter):
```json
{
  "semi": false,
  "singleQuote": false,
  "useTabs": false,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Создать `frontend/.prettierignore`** — те же пути, что в `ignores` ESLint.

**Скрипты в `frontend/package.json`:**
```json
"lint":        "eslint . && prettier --check .",
"lint:fix":    "eslint . --fix && prettier --write .",
"format":      "prettier --write ."
```

**Обновить:**
- `.pre-commit-config.yaml` — переименовать хук `local-biome-check` → `local-eslint-prettier`, `name: "biome check"` → `name: "eslint + prettier"`. Команда `npm run lint` уже корректна.
- `.vscode/extensions.json` — `biomejs.biome` → `dbaeumer.vscode-eslint` + `esbenp.prettier-vscode`.
- `.vscode/settings.json` (если есть Biome-настройки) — заменить на `editor.defaultFormatter: esbenp.prettier-vscode` + `editor.codeActionsOnSave: { source.fixAll.eslint: true }`.
- `scripts/generate-client.sh` — финальная строка `npm run lint` остаётся как есть, но теперь это ESLint+Prettier.

**Ловушки:** Biome имеет встроенный `organizeImports` — заменяется ESLint-плагином `eslint-plugin-import` или (проще) опцией `--fix` через `prettier-plugin-organize-imports`. Включаю `prettier-plugin-organize-imports` в зависимости как опциональный шаг — добавим, если понадобится.

---

### Этап 3. Traefik → nginx (dev)

**Заменить сервис `proxy` в `compose.override.yml`** (строки 8–46):
```yaml
proxy:
  image: nginx:1.27
  ports:
    - "8081:80"
  volumes:
    - ./nginx/dev.conf:/etc/nginx/conf.d/default.conf:ro
  depends_on:
    - backend
    - frontend
    - mailcatcher
  networks:
    - default
```

**Создать `nginx/dev.conf`:**
```nginx
server {
  listen 80;
  server_name api.localhost;
  location / { proxy_pass http://backend:8000; proxy_set_header Host $host; }
}
server {
  listen 80;
  server_name dashboard.localhost;
  location / { proxy_pass http://frontend:80; proxy_set_header Host $host; }
}
server {
  listen 80;
  server_name mailcatcher.localhost;
  location / { proxy_pass http://mailcatcher:1080; proxy_set_header Host $host; }
}
server {
  listen 80 default_server;
  return 404;
}
```

**Удалить из `compose.yml`:**
- сервис `adminer` целиком (строки 22–43, см. этап 4)
- все `traefik.*` labels у backend (124–140) и frontend (154–170)
- `networks: traefik-public` у всех сервисов — заменить на дефолтную сеть compose
- блоки `networks: traefik-public: external: true` в конце файла

**Удалить из `compose.override.yml`:**
- сервис `adminer` (53–56) — этап 4
- `networks: traefik-public: external: false` — больше не нужно

**Сохраняем порты:** backend по-прежнему `8000:8000` напрямую, frontend `5173:80` напрямую — для прямого доступа. Через nginx можно ходить как `*.localhost` на `:8081`.

---

### Этап 4. Удаление Adminer

- Удалить блок `adminer:` (строки 22–43) из `compose.yml`.
- Удалить блок `adminer:` (строки 53–56) из `compose.override.yml`.
- В `development.md` убрать строку про «Adminer на :8080». В качестве замены упомянуть, что подключиться к БД можно любым клиентом (DBeaver, TablePlus, psql) на `localhost:5432` с кредами из `.env`.

---

### Этап 5. Traefik → nginx (prod)

**Полностью удалить `compose.traefik.yml`.**

**Создать `compose.nginx.yml`** (стек для prod) — связка `nginx-proxy + acme-companion`:
```yaml
services:
  proxy:
    image: nginxproxy/nginx-proxy:1.6
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - certs:/etc/nginx/certs
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
    networks:
      - proxy-net

  acme:
    image: nginxproxy/acme-companion:2.6
    depends_on: [proxy]
    environment:
      DEFAULT_EMAIL: ${EMAIL?Variable not set}
    volumes_from: [proxy]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - acme:/etc/acme.sh
    networks:
      - proxy-net

volumes: { certs: , vhost: , html: , acme: }
networks: { proxy-net: { external: true } }
```

**Обновить `compose.yml`** — навесить переменные окружения вместо traefik-labels:
```yaml
backend:
  environment:
    VIRTUAL_HOST: api.${DOMAIN}
    VIRTUAL_PORT: "8000"
    LETSENCRYPT_HOST: api.${DOMAIN}
  networks: [proxy-net, default]

frontend:
  environment:
    VIRTUAL_HOST: dashboard.${DOMAIN}
    VIRTUAL_PORT: "80"
    LETSENCRYPT_HOST: dashboard.${DOMAIN}
  networks: [proxy-net, default]
```
(Сеть `proxy-net` создать однократно: `docker network create proxy-net`.)

**В `.env.example` / `.env`:**
- удалить `USERNAME`, `HASHED_PASSWORD` (использовались для Traefik dashboard)
- оставить `DOMAIN`, `STACK_NAME`, `EMAIL`

---

### Этап 6. Документация

- `README.md` — заменить упоминание Traefik на nginx (строки 25–26). Убрать «Adminer».
- `development.md` — переписать секции про:
  - Traefik / `localhost.tiangolo.com` (3–21, 82–100) → инструкции по nginx-проксированию через `*.localhost`
  - Adminer (19) — удалить
  - Mailcatcher (37–47) — обновить адрес на `mailcatcher.localhost:8081` (через nginx) или прямой `:1080`
- `deployment.md` — переписать все упоминания Traefik (15, 29, 35, 40, 44, 47, 97, 100, 103, 324) на nginx-proxy + acme-companion, убрать `adminer.staging.${DOMAIN}` и `traefik.${DOMAIN}`.
- `CLAUDE.md` — заменить упоминания «Bun», «Biome» в секции «Stack overview» и «Commands»; обновить команды `bun run` → `npm run`, `bunx` → `npx`.

---

## Порядок исполнения

Каждый этап — отдельный коммит, чтобы можно было откатить. Рекомендуемый порядок:

1. **Этап 4** (Adminer — самое лёгкое, разогрев)
2. **Этап 1** (Bun → npm — затрагивает много файлов, но без поломок логики)
3. **Этап 2** (Biome → ESLint+Prettier — может всплыть «новых» ESLint-ошибок в коде; чинить сразу)
4. **Этап 3** (dev nginx)
5. **Этап 5** (prod nginx)
6. **Этап 6** (документация — последним, по факту изменений)

---

## Верификация

После каждого этапа:

| Этап | Проверка |
|------|---------|
| 1 (npm) | `npm install` в корне без ошибок; `npm run dev` запускает Vite; `docker compose build frontend` зелёный; `docker compose run --rm playwright npx playwright test --list` показывает тесты. |
| 2 (ESLint) | `npm run lint` в `frontend/` зелёный; `bash scripts/generate-client.sh` отрабатывает до конца; `prek run --all-files` проходит. |
| 3 (dev nginx) | `docker compose watch` поднимает стек; `curl -H "Host: api.localhost" http://localhost:8081/api/v1/utils/health-check/` возвращает 200; `curl -H "Host: dashboard.localhost" http://localhost:8081/` отдаёт фронт. |
| 4 (adminer) | `docker compose ps` не показывает adminer; в логах нет ошибок про сеть. |
| 5 (prod nginx) | На staging-домене: `curl -I https://api.${DOMAIN}/api/v1/utils/health-check/` возвращает 200 с валидным TLS; acme-companion в логах подтверждает выпуск сертификата. |
| Полный E2E | `bash scripts/test.sh` (бэкенд) + `bunx playwright test` (фронт через Docker) — всё зелёное. |

---

## Критические файлы (одним списком)

**Изменить:**
- `package.json`
- `frontend/package.json`
- `frontend/biome.json` → удалить
- `frontend/eslint.config.js` → создать
- `frontend/.prettierrc.json` → создать
- `frontend/.prettierignore` → создать
- `frontend/Dockerfile`
- `frontend/Dockerfile.playwright`
- `compose.yml`
- `compose.override.yml`
- `compose.traefik.yml` → удалить
- `compose.nginx.yml` → создать
- `nginx/dev.conf` → создать
- `scripts/generate-client.sh`
- `.pre-commit-config.yaml`
- `.github/workflows/playwright.yml`
- `.github/workflows/pre-commit.yml`
- `.vscode/extensions.json`, `.vscode/settings.json`
- `.env.example` (если есть в репо)
- `README.md`, `development.md`, `deployment.md`, `CLAUDE.md`
- `bun.lock` / `bun.lockb` → удалить, появится `package-lock.json`

**Итого:** ~22 файла, 4 удаления, 5 созданий.
