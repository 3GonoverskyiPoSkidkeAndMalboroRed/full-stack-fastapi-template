# План: Смена цветовой темы сайта на тёплую землистую палитру

## Context

Текущая тема (`frontend/src/index.css`) — нейтрально-серая, со стандартным shadcn-палитрой (oklch с нулевой хроматичностью) и единственным «выпадающим» бирюзовым `--primary` (`oklch(0.5982 0.10687 182.4689)`). Юзер хочет переключить сайт на тёплую землистую палитру из 5 цветов:

| HEX       | OKLCH (≈)                  | Роль                          |
|-----------|----------------------------|-------------------------------|
| `#D9B89C` | `oklch(0.795 0.045 65)`    | Светлый бежевый — secondary/accent (light), muted-foreground (dark) |
| `#8C4B26` | `oklch(0.428 0.099 47)`    | Тёмно-коричневый — secondary/accent (dark) |
| `#A64826` | `oklch(0.491 0.141 39)`    | Терракотовый — **primary** на обеих темах |
| `#F2F2F2` | `oklch(0.961 0 0)`         | Светлый фон / foreground в dark |
| `#262626` | `oklch(0.247 0 0)`         | Тёмный текст / фон в dark |

Тема в проекте задаётся через CSS-переменные в `:root` и `.dark` блоках `frontend/src/index.css` (Tailwind v4 + shadcn pattern). Почти все компоненты уже используют семантические токены (`bg-background`, `bg-card`, `text-primary`, `border`, и т.д.), поэтому смена цветов сводится в основном к правке `index.css`.

По решениям юзера: красное сердечко в `AddToWishlistButton` (`text-red-500`) остаётся как есть; chart-* токены переводятся в оттенки палитры.

## Изменения

### Единственный файл: `frontend/src/index.css`

Переписать содержимое блоков `:root` и `.dark`, оставив структуру `@theme inline { ... }` нетронутой.

#### Light (`:root`)

```css
:root {
  --radius: 0.625rem;

  /* Surface */
  --background: oklch(0.961 0 0);        /* #F2F2F2 */
  --foreground: oklch(0.247 0 0);        /* #262626 */
  --card: oklch(1 0 0);                  /* white — выделяется поверх #F2F2F2 */
  --card-foreground: oklch(0.247 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.247 0 0);

  /* Brand */
  --primary: oklch(0.491 0.141 39);              /* #A64826 терракот */
  --primary-foreground: oklch(0.961 0 0);        /* #F2F2F2 */

  /* Secondary / accent — тёплый беж */
  --secondary: oklch(0.795 0.045 65);            /* #D9B89C */
  --secondary-foreground: oklch(0.247 0 0);
  --accent: oklch(0.795 0.045 65);               /* #D9B89C */
  --accent-foreground: oklch(0.247 0 0);

  /* Muted — приглушённый тёплый нейтрал */
  --muted: oklch(0.90 0.018 65);
  --muted-foreground: oklch(0.50 0.04 50);

  /* Status */
  --destructive: oklch(0.577 0.245 27.325);      /* оставляем красный */

  /* Lines / focus */
  --border: oklch(0.85 0.02 60);
  --input: oklch(0.85 0.02 60);
  --ring: oklch(0.491 0.141 39);                 /* primary */

  /* Charts — 5 оттенков палитры */
  --chart-1: oklch(0.491 0.141 39);              /* #A64826 */
  --chart-2: oklch(0.428 0.099 47);              /* #8C4B26 */
  --chart-3: oklch(0.795 0.045 65);              /* #D9B89C */
  --chart-4: oklch(0.65 0.13 40);                /* осветлённый терракот */
  --chart-5: oklch(0.35 0.08 47);                /* затемнённый коричневый */

  /* Sidebar */
  --sidebar: oklch(0.961 0 0);
  --sidebar-foreground: oklch(0.247 0 0);
  --sidebar-primary: oklch(0.491 0.141 39);
  --sidebar-primary-foreground: oklch(0.961 0 0);
  --sidebar-accent: oklch(0.795 0.045 65);
  --sidebar-accent-foreground: oklch(0.247 0 0);
  --sidebar-border: oklch(0.85 0.02 60);
  --sidebar-ring: oklch(0.491 0.141 39);
}
```

#### Dark (`.dark`)

```css
.dark {
  --background: oklch(0.247 0 0);                /* #262626 */
  --foreground: oklch(0.961 0 0);                /* #F2F2F2 */
  --card: oklch(0.30 0 0);                       /* чуть светлее фона */
  --card-foreground: oklch(0.961 0 0);
  --popover: oklch(0.30 0 0);
  --popover-foreground: oklch(0.961 0 0);

  --primary: oklch(0.491 0.141 39);              /* #A64826 */
  --primary-foreground: oklch(0.961 0 0);

  --secondary: oklch(0.428 0.099 47);            /* #8C4B26 — тёмно-коричневый */
  --secondary-foreground: oklch(0.961 0 0);
  --accent: oklch(0.428 0.099 47);
  --accent-foreground: oklch(0.961 0 0);

  --muted: oklch(0.32 0.015 60);
  --muted-foreground: oklch(0.78 0.03 65);       /* светлый бежевый текст */

  --destructive: oklch(0.704 0.191 22.216);      /* оставляем красный */

  --border: oklch(0.40 0.02 55);
  --input: oklch(0.40 0.02 55);
  --ring: oklch(0.491 0.141 39);

  --chart-1: oklch(0.65 0.13 40);
  --chart-2: oklch(0.491 0.141 39);
  --chart-3: oklch(0.795 0.045 65);
  --chart-4: oklch(0.428 0.099 47);
  --chart-5: oklch(0.55 0.10 50);

  --sidebar: oklch(0.30 0 0);
  --sidebar-foreground: oklch(0.961 0 0);
  --sidebar-primary: oklch(0.491 0.141 39);
  --sidebar-primary-foreground: oklch(0.961 0 0);
  --sidebar-accent: oklch(0.428 0.099 47);
  --sidebar-accent-foreground: oklch(0.961 0 0);
  --sidebar-border: oklch(0.40 0.02 55);
  --sidebar-ring: oklch(0.491 0.141 39);
}
```

### Что НЕ меняется

- Структура `@theme inline { ... }` сверху файла — она лишь маппит `--color-*` на CSS-переменные, без правок.
- `@layer base { ... }` блок снизу — `border-border`, `bg-background`, `text-foreground` уже идут через токены.
- `AddToWishlistButton.tsx` — `text-red-500` для активного сердечка остаётся (решение юзера).
- Чёрные градиенты-оверлеи поверх фото (`from-black/70 ...` в hero на `_public/index.tsx`, в категориях, в лайтбоксе) — не палитра, а оверлей картинок; оставляю.
- Компоненты shadcn (`ui/button.tsx`, `ui/card.tsx` и т.д.) — без правок, они уже семантические.

### Места, где новая палитра проявится автоматически (для справки)

- `Card` / `CardContent` (например в `ProductCard.tsx:59`, `_public/about.tsx`) — `bg-card border` → белые карточки на бежевом фоне.
- Hero на главной (`_public/index.tsx`) — бейдж `bg-primary/90` станет терракотовым.
- About-страница (`_public/about.tsx`) — `bg-primary/10 text-primary` для иконок-кружков, бейдж «О компании».
- `ThemeSwitcher` — `bg-background/95 border` пилюля; активная кнопка `variant="default"` будет терракотовой.
- `Button` `variant="default"` (включая `AddToCartButton`) — заливка primary (`#A64826`).
- `Button` `variant="secondary"` (включая `AddToCartButton` в состоянии «В корзине», floating-сердечко) — заливка `#D9B89C`.
- `Skeleton`, focus-ring, `Tabs`, `Sidebar` — всё подхватится через `--muted`, `--ring`, `--sidebar-*`.

## Критические файлы

- `frontend/src/index.css` — единственный файл правок.

## Verification

1. `cd frontend && npm run lint` — sanity-check (никаких изменений в TS/TSX не делаем, но проверим Prettier для CSS).
2. `cd frontend && npx tsc -p tsconfig.build.json --noEmit` — для надёжности.
3. `docker compose watch` → `http://dashboard.localhost:8081/`:
   - **Light theme** (Sun в ThemeSwitcher): фон сайта `#F2F2F2`, кнопки primary и focus-ring терракотовые `#A64826`, secondary/accent бежевый `#D9B89C`, текст почти чёрный.
   - **Dark theme** (Moon): фон `#262626`, текст `#F2F2F2`, primary остался терракотовый, secondary/accent — коричневый `#8C4B26`.
   - **System theme** (Monitor): подхватывает системную предпочтительность.
4. Пройти ключевые экраны: `/` (главная, hero + категории), `/catalog`, `/catalog/$id`, `/about`, `/account`, `/admin` (через `/dashboard`) — убедиться, что нигде нет «сломанного» контраста (например тёмный текст на тёмном фоне).
5. Проверить ThemeSwitcher слева снизу: активная иконка терракотовая.
6. Сердечко в избранном — остаётся красным (`text-red-500`).
