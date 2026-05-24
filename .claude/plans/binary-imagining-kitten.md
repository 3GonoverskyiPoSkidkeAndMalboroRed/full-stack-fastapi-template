# Редизайн сайта под макет «РЕЕСТР13» (Swiss grid)

## Контекст

В `mockup/` лежит готовый дизайн главной страницы интернет-магазина стритвира «РЕЕСТР13» в эстетике Swiss grid wireframe (чёрный/бежевый/акцентный красный, Space Grotesk + JetBrains Mono, жёсткие 1px-рулы между блоками, табличные сетки). Текущий фронт построен на shadcn/ui с тёплой бежево-оранжевой палитрой OKLch и стандартными карточками — визуально и тонально это не совпадает с макетом.

Задача — применить дизайн макета ко **всему** сайту (главная, каталог, карточка товара, авторизация, корзина, оформление, кабинет, админка), сохранив весь существующий функционал (auth, корзина, избранное, заказы, админ-CRUD). При этом из макета **не** реализуем блоки «Медиа» (статьи) и «Фестиваль» — соответствующих сущностей в бэкенде нет и заводить их не нужно. Hero на главной заменяем на промо текущей коллекции, верхнюю чёрную полосу — на общую промо-фразу (доставка), переключатель RU/EN убираем, иконка поиска в хедере открывает диалог с поиском по товарам.

Тёмная тема удаляется полностью — палитра макета подразумевает только светлый режим.

## Решения, согласованные с пользователем

- Брендинг **РЕЕСТР13** используется как есть (логотип, тон).
- Сущности `Article` / `Event` **не** заводятся — блоки «Медиа» и «Фестиваль» из макета исключены.
- Тёмная тема и переключатель Appearance удаляются.
- Промо-полоса наверху — статичная фраза про доставку + ссылка в каталог.
- Hero на главной — статичный промо-блок «Лето 2026» со ссылкой в каталог.
- Переключатель RU/EN убираем (i18n не подключаем).
- Поиск — модальный диалог по товарам (новый параметр `q` в публичном эндпойнте items).
- Редизайн применяется ко **всему** сайту, включая `_authed` и `_admin` лейауты.

## Дизайн-система

### Палитра (CSS-переменные, корень)

| Токен | Значение | Применение |
|---|---|---|
| `--ink` | `#0a0a0a` | основной текст, бордеры, primary-кнопки |
| `--paper` | `#fafaf7` | фон страницы, инверсный текст |
| `--accent` | `#ff3b1f` | SOLD OUT, destructive, hover-fade |
| `--muted` | `#6b6b66` | вторичный текст, mono-меты |
| `--soft` | `#ececea` | фон placeholder/disabled |
| `--soft2` | `#e3e3e0` | фон festival-art (если понадобится) |
| `--grid` | `1px` | толщина рулов между блоками |

shadcn-токены маппятся на это поверх (`background→paper`, `foreground→ink`, `primary→ink`, `primary-foreground→paper`, `border→ink`, `muted-foreground→muted`, `destructive→accent`, `radius→0`). Pills остаются через явный `rounded-full` там, где нужно.

### Типографика

- Основной шрифт — **Space Grotesk** (400/500/600/700), `font-feature-settings: "ss01","ss02"`.
- Моно — **JetBrains Mono** (400/500) для цен, чисел, дат, кодовых меток (`№ 137 / 21.05.26`).
- Подключаются через `<link>` в `frontend/index.html` (preconnect + `subset=cyrillic,cyrillic-ext,latin,latin-ext`).
- Утилитарные классы в `index.css`: `.mono` (font-family JBM, letter-spacing .02em), `.upper` (uppercase, letter-spacing .04em), `.tnum` (font-variant-numeric tabular-nums).

### Сетка и контейнер

- Контейнер страницы `max-width: 1440px; margin: 0 auto; padding: 0 24px` (класс `.frame`, использовать вместо текущего `max-w-7xl`).
- Секции разделены `border-bottom: 1px solid var(--ink)` без gap — рулы как часть макета.

## Файлы и изменения

### Базовые стили и шрифты

- `frontend/index.html` — добавить preconnect + `<link>` на Google Fonts (Space Grotesk + JetBrains Mono с кириллическим subset).
- `frontend/src/index.css` — полностью переписать:
  - удалить блок `.dark { ... }` и оставить только `:root`;
  - переопределить shadcn-токены под палитру выше (через oklch значения близкие к hex);
  - объявить `--ink/--paper/--accent/--muted/--soft/--soft2/--grid` напрямую в `:root`;
  - сделать `--radius: 0` (макет острый), pills — через `rounded-full`;
  - добавить `font-family` глобально на `body` (Space Grotesk + system fallback);
  - добавить классы `.mono`, `.upper`, `.tnum`, `.frame`, `.rule`, `.rule-soft`, `.ph` (placeholder с диагональной сеткой как в макете) — реюзаются на главной и в плейсхолдерах товаров без фото.
- Удалить `frontend/src/components/Common/Appearance.tsx` (если есть) и любые упоминания toggle темы в `main.tsx`, сайдбаре, settings. Удалить класс `.dark` с `<html>` нигде не выставлять.

### Общий шеллл (header, footer, layouts)

- `frontend/src/components/Common/PromoStrip.tsx` (новый) — чёрная лента 36px, центрированная, три элемента в строку: `mono.upper` «БЕСПЛАТНАЯ ДОСТАВКА ОТ 5 000 ₽», вторичный текст, `<Link to="/catalog">` с CSS-стрелкой `.arrow`.
- `frontend/src/components/Common/PublicHeader.tsx` — переписать под `grid 200px 1fr 200px`:
  - **left:** `icon-btn` «Назад» (`router.history.back()`), `icon-btn` «Поиск» (открывает SearchDialog);
  - **brand:** flex-центр — ссылка «МАГАЗИН» (`/catalog`), `<Logo />` РЕЕСТР13 (34px 700), ссылка «КАБИНЕТ» (`/account`) — для авторизованного, иначе «ВОЙТИ» (`/login`);
  - **right:** `<Link>` «Корзина · N» в стиле `.cart-pill` (border 1px, rounded-full, 11px, uppercase); для авторизованного с актуальным `cartCount`, для гостя ведёт на /login и показывает «Корзина · 0»; рядом — кнопка «Выйти» (только для авторизованного, текстом, без иконки).
  - убрать переключатель RU/EN и кнопки «Регистрация» из шапки (логика регистрации остаётся через страницу /signup, ссылка живёт внизу /login).
- `frontend/src/components/Common/Logo.tsx` — переписать под brand-mark (Space Grotesk 700, 34px, letter-spacing .02em), убрать иконки/SVG; `variant="full"` рисует «РЕЕСТР13».
- `frontend/src/components/Common/Footer.tsx` — переписать под `.foot-grid` (4 колонки 1.4fr 1fr 1fr 1fr):
  - колонка-лого (РЕЕСТР13 42px) + описание «Медиа о моде и культуре. Магазин стритвира. Очные мероприятия.»;
  - «Навигация»: Главная, О нас, Магазин (`/catalog`), Кабинет (`/account`);
  - «Соцсети»: vk.com/reestr13, t.me/reestr13;
  - «Документы»: Пользовательское соглашение, Политика конфиденциальности, Условия доставки, Условия возврата, Контакты;
  - `.foot-bottom`: disclaimer + mono «© 2026 · WIREFRAME v0.1» (год — текущий).
- `frontend/src/components/Common/SearchDialog.tsx` (новый) — shadcn `Dialog` + `Input` + список результатов (карточки в стиле `.media-item`):
  - debounced query (300мс) по `itemsReadItemsPublic({ query: { q, limit: 12 } })`;
  - управляется через прокинутый из header `open/onOpenChange`;
  - результат — clickable строки `[name | category | price] → /catalog/$id`;
  - пустое состояние «Ничего не найдено», начальное — подсказка «Начните вводить название».
- `frontend/src/routes/_public.tsx` и `frontend/src/routes/_authed.tsx` — поменять структуру:
  ```
  <div className="min-h-screen bg-paper text-ink">
    <PromoStrip />
    <PublicHeader />
    <main><Outlet /></main>
    <Footer />
  </div>
  ```
  Убрать `max-w-7xl` обёртку — `main` использует `.frame` внутри секций (как в макете, рулы во всю ширину).

### Главная (`frontend/src/routes/_public/index.tsx`)

Полностью переписать. Компоненты вынести inline или в `frontend/src/components/Home/`:

1. **Hero** — `<section class="hero">` grid 1fr/1fr с `border-bottom: 1px var(--ink)`:
   - слева `hero-meta`: тег `<span class="tag solid">Магазин</span>` + mono-мета «Раздел / 01 · Коллекция»; `<h1>` «Ре́ <em>ЛЕТО 2026</em>» (em в инверсии с skew); `<p class="lede">` краткое описание; `<Link to="/catalog" class="read-link">` «Открыть каталог →»; снизу mono «10 SKU · ДРОП №04»;
   - справа `.hero-art.ph` — диагональная placeholder-сетка с label «cover · 01» и corner «2400 × 1600».
2. **Sec-head** «Магазин» + meta (mono «Дроп №04», «10 / N SKU»).
3. **Sec-sub** — короткая подпись «Следите за последними новостями моды и тенденциями» + ссылка «Перейти в магазин →».
4. **Product grid** (5 колонок) — первые 10 товаров через `useSuspenseQuery(itemsReadItemsPublic({ limit: 10 }))` + `<Suspense fallback={<PendingHomeGrid />}>`. Каждая карточка — новый `ProductCard` (см. ниже).
5. **see-all** — `<Link to="/catalog" class="see-all">` «ПОСМОТРЕТЬ ВСЕ ТОВАРЫ» + hint mono «N ПОЗИЦИЙ · ДРОП №04».

### Каталог и карточка товара

- `frontend/src/components/Catalog/ProductCard.tsx` — переписать под `.product` из макета:
  - flex column, border-right + border-bottom 1px ink, padding 18px;
  - img 1:1 (соотношение через `aspect-square`), если нет фото — placeholder `.ph` с label-номером;
  - meta: `name` (14px 500) + `num` (mono 11px muted);
  - price-row: `price` (mono 13px) + `stock` (`SOLD OUT` accent или `IN STOCK` ink, 10px uppercase tracking .2em);
  - убрать shadcn `Card`/`CardContent`/`CardFooter`, оставить чистый `<article>` со ссылкой на `/catalog/$id`;
  - `AddToCartButton` и `AddToWishlistButton` интегрировать как мелкие icon-btn в углу карточки (hover-overlay), чтобы не ломать сетку.
- `frontend/src/components/Catalog/ProductGrid.tsx` — `display: grid; grid-template-columns: repeat(5, 1fr);` (на md 3, на sm 2). Убрать nth-child(5n) border-right через CSS-правило в `index.css` или через Tailwind `[&>article:nth-child(5n)]:border-r-0`.
- `frontend/src/routes/_public/catalog.index.tsx` — заменить `<h1>Каталог</h1>` + `Select`-фильтры на:
  - `sec-head` «Каталог» + meta (mono «Все позиции · N / total»);
  - фильтры в стиле tag/pill: tags для категорий (горизонтальный ряд `border 1px var(--ink) rounded-full`, активная — `solid` ink/paper); фильтр размеров — те же tags. Сохранить логику URL search params (`category_id`, `size_id`).
- `frontend/src/components/Catalog/ProductDetail.tsx` — переверстать карточку товара под Swiss-grid 2 колонки:
  - слева `ProductGallery` (текущий компонент адаптировать стилями — рамки 1px, placeholder с диагональю);
  - справа мета: tag «В наличии / Sold out» (accent), h1 (60px), mono цена, описание, размер-комбо, кнопка «Добавить в корзину» (solid ink), второстепенная «В избранное» (ghost).

### Авторизация и формы

Страницы `frontend/src/routes/login.tsx`, `signup.tsx`, `recover-password.tsx`, `reset-password.tsx`, `routes/_authed/settings.tsx`, `_authed/account.*` — общая стилистика:

- центрированный контейнер 480px на `paper`, border 1px ink, без shadow;
- h1 в стиле hero (40–48px);
- Input — без скруглений, border 1px ink, фокус — outline accent;
- Button primary — solid ink + paper text + uppercase + tracking;
- Button ghost — border 1px ink, paper фон;
- ссылки «Забыли пароль?», «Уже есть аккаунт?» снизу dashed border.

### Корзина, оформление, кабинет (`_authed/*`)

- Списки товаров — табличный grid с 1px рулами (как `.media-item`), mono для количества/цены;
- кнопки «Оформить», «Удалить», «+/-» в стиле btn-ghost/solid;
- таб-навигация в `/account` (заказы / избранное / настройки) — пилюли в стиле `.tag`.

### Админка (`_admin/*`)

- `frontend/src/components/Sidebar/*` — `AppSidebar` перекрасить под палитру (paper фон, ink текст, dashed разделители); ссылки 13px uppercase tracking .14em; убрать иконки или оставить SVG в стиле line-icon 1.5px stroke;
- таблицы `Items/columns.tsx`, `UsersAdminPanel`, `AdminOrdersPanel` — заменить стандартный `DataTable` стилизацию на `.media-item`-подобные строки (grid с фиксированными колонками, dashed border-bottom);
- в Sidebar меню удалить пункты, ссылающиеся на несуществующие разделы (Media/Festival, если они появлялись бы — их в проекте нет, проверить и не добавлять).

### Бэкенд

- `backend/app/api/routes/items.py::read_items_public` — добавить параметр `q: str | None = None`:
  ```python
  if q:
      pattern = f"%{q.strip()}%"
      count_statement = count_statement.where(col(Item.title).ilike(pattern))
      statement = statement.where(col(Item.title).ilike(pattern))
  ```
  Используется в SearchDialog. Безопасный ilike, параметр опциональный.
- Регенерация SDK: `bash scripts/generate-client.sh` после правки бэка.

### Удаление мертвого

- Удалить `Appearance` toggle и его импорты (settings, sidebar, header).
- Удалить из `frontend/src/index.css` блок `.dark { ... }`.
- Удалить устаревшие placeholder-картинки `picsum.photos/...` на главной.

## Критические файлы (мест на правку)

Фронт:
- `frontend/index.html`
- `frontend/src/index.css`
- `frontend/src/main.tsx` (если есть toggle темы)
- `frontend/src/components/Common/PublicHeader.tsx`
- `frontend/src/components/Common/Footer.tsx`
- `frontend/src/components/Common/Logo.tsx`
- `frontend/src/components/Common/PromoStrip.tsx` (новый)
- `frontend/src/components/Common/SearchDialog.tsx` (новый)
- `frontend/src/routes/_public.tsx`
- `frontend/src/routes/_authed.tsx`
- `frontend/src/routes/_public/index.tsx`
- `frontend/src/routes/_public/catalog.index.tsx`
- `frontend/src/routes/_public/catalog.$id.tsx`
- `frontend/src/components/Catalog/ProductCard.tsx`
- `frontend/src/components/Catalog/ProductGrid.tsx`
- `frontend/src/components/Catalog/ProductDetail.tsx`
- `frontend/src/routes/login.tsx`, `signup.tsx`, `recover-password.tsx`, `reset-password.tsx`
- `frontend/src/routes/_authed/account.*`, `cart.tsx`, `checkout.tsx`, `settings.tsx`
- `frontend/src/components/Sidebar/*`, `frontend/src/routes/_admin.tsx`
- `frontend/src/components/Pending/*` (скелеты под новые сетки)

Бэк:
- `backend/app/api/routes/items.py`

## Переиспользуемые утилиты

- `firstPhotoOrPlaceholder` (`@/lib/photo`) — оставляем, используется в новом `ProductCard`.
- `formatPrice` (`@/components/Catalog/ProductCard`) — вынести в `@/lib/format.ts` (новый) и реюзать в SearchDialog, корзине, hero-сетке.
- `useCustomToast` и `handleError` (`@/utils.ts`) — без изменений.

## Порядок реализации (рекомендуется)

1. Стили и шрифты (`index.html` + `index.css`) — без этого все правки компонентов выглядят сломано.
2. PromoStrip + Logo + PublicHeader + Footer + лейауты `_public`/`_authed`.
3. Главная (Hero + Sec-head + Product grid + see-all).
4. ProductCard/ProductGrid → каталог → карточка товара.
5. Бэкенд: `q` в `items/public` → регенерация SDK → SearchDialog.
6. Авторизация (формы) и кабинет/корзина/оформление.
7. Админка и сайдбар.
8. Удалить тёмную тему и Appearance окончательно.
9. Прогнать линтеры/тесты, проверить вручную в браузере.

## Верификация

- Поднять стек: `docker compose watch`.
- Открыть в браузере:
  - http://dashboard.localhost:8081/ — главная: сравнить визуально с `mockup/Главная.html`, проверить PromoStrip, header (Назад/Поиск/Корзина), hero, сетку 5×2, see-all, footer (4 колонки + disclaimer).
  - http://dashboard.localhost:8081/catalog — фильтры-pill работают, сетка 5 колонок, рулы 1px между ячейками.
  - http://dashboard.localhost:8081/catalog/<id> — детальная карточка в Swiss-стиле.
  - /login, /signup, /recover-password — формы в новом стиле.
  - /cart, /checkout, /account — авторизованные страницы, рулы и mono.
  - /admin (как superuser) — сайдбар и таблицы в новом стиле.
  - Кликнуть «Поиск» в шапке → ввести «Сумка» → должен прийти ответ от `/api/v1/items/public?q=Сумка&limit=12`, отрисоваться результаты, клик ведёт в /catalog/<id>.
- Тёмная тема не появляется (toggle отсутствует, `<html>` без `.dark`).
- Линтеры/типы:
  - `cd frontend && npm run lint && npm run build`;
  - `cd backend && bash scripts/lint.sh`;
- Тесты бэка (есть ли регрессия в `items/public`): `bash backend/scripts/tests-start.sh -x`.
- SDK: после `bash scripts/generate-client.sh` в `frontend/src/client` появилось поле `q` в типе query для `itemsReadItemsPublic`.

## Известные риски и компромиссы

- Сетка 5 колонок на ширинах < 1280px ломается — нужна адаптация: 3 колонки md, 2 колонки sm, 1 колонка xs. Заложено через Tailwind `grid-cols-2 md:grid-cols-3 xl:grid-cols-5`.
- shadcn-компоненты (`Card`, `Badge`, `Select`, `Dialog`) после смены `--radius=0` и палитры могут визуально отличаться от ожидания — точечно проверить и при необходимости переопределить классы.
- Поиск по `Item.title` через ilike — нечувствителен к регистру в Postgres только для ILIKE; для русского текста должно работать корректно. Если нужны диакритика/стемминг — не в рамках этой задачи.
- Регенерация SDK обновит много файлов в `frontend/src/client/` — нормально, они авто-генерируются.
