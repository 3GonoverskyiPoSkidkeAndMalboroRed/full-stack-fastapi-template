# План: Разделение навигации — navbar для обычных пользователей, sidebar только для /admin

## Context

Сейчас у фронтенда два layout-обёртки. `_layout.tsx` использует `SidebarProvider` + `AppSidebar` и требует логина — под ним лежат **все** авторизованные страницы: `account`, `cart`, `checkout`, `admin`, `settings`, `index` (Dashboard). `_public.tsx` без sidebar содержит только каталог. AppSidebar дублирует навигацию из PublicHeader (Главная/Каталог/Корзина/Избранное/Кабинет), плюс пункт «Админка» для `is_superuser`.

Юзер хочет, чтобы обычный пользователь (даже залогиненный) видел только верхний горизонтальный navbar (`PublicHeader`) — никакого sidebar. Sidebar остаётся только на админских страницах (`/admin`), на остальных страницах админ тоже видит navbar, как обычный юзер. Корневой `/` нужно сделать публичной главной — сейчас там Dashboard за логином.

Бонус-требования:
- Ссылка «Каталог» в navbar становится `<Button>` и переезжает в правую часть header'а.
- «Избранное» — это таб внутри `/account` (`?tab=wishlist`). Это **уже так**: маршрут `/wishlist` не существует, в `account.tsx:39-52` уже два таба (`orders`, `wishlist`). Менять ничего не нужно — просто подтверждаем через ссылку в navbar.

## Изменения

### 1. Перетасовка layout-файлов

Создаём два новых pathless-layout, удаляем старый `_layout.tsx`:

- **`frontend/src/routes/_authed.tsx`** (NEW) — приватный navbar-layout.
  ```tsx
  import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
  import { Footer } from "@/components/Common/Footer"
  import { PublicHeader } from "@/components/Common/PublicHeader"
  import { isLoggedIn } from "@/hooks/useAuth"

  export const Route = createFileRoute("/_authed")({
    component: AuthedLayout,
    beforeLoad: async () => {
      if (!isLoggedIn()) {
        throw redirect({ to: "/login" })
      }
    },
  })

  function AuthedLayout() {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex-1 px-4 py-8 md:px-6 md:py-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
    )
  }
  ```

- **`frontend/src/routes/_admin.tsx`** (NEW, замена `_layout.tsx`) — sidebar-layout с проверкой `is_superuser`. Идентичен текущему `_layout.tsx`, плюс защита роли.
  ```tsx
  export const Route = createFileRoute("/_admin")({
    component: AdminLayout,
    beforeLoad: async () => {
      if (!isLoggedIn()) throw redirect({ to: "/login" })
      // Доп. проверку is_superuser оставим внутри admin.tsx (там уже есть, см. ниже)
    },
  })

  function AdminLayout() {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="text-muted-foreground -ml-1" />
          </header>
          <main className="flex-1 p-6 md:p-8">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    )
  }
  ```

- **`frontend/src/routes/_layout.tsx`** — **DELETE**.

### 2. Перенос страниц по новым layout-ам

| Откуда | Куда | Изменения |
|---|---|---|
| `_layout/index.tsx` (Dashboard) | **DELETE** | Маршрут `/` теперь публичный (см. п.3) |
| `_layout/account.tsx` | `_authed/account.tsx` | Только `createFileRoute("/_authed/account")` |
| `_layout/cart.tsx` | `_authed/cart.tsx` | `createFileRoute("/_authed/cart")` |
| `_layout/checkout.tsx` | `_authed/checkout.tsx` | `createFileRoute("/_authed/checkout")` |
| `_layout/settings.tsx` | `_authed/settings.tsx` | `createFileRoute("/_authed/settings")` |
| `_layout/admin.tsx` | `_admin/admin.tsx` | `createFileRoute("/_admin/admin")`. `beforeLoad` с проверкой `is_superuser` уже есть внутри файла — оставляем |

После перемещений папка `_layout/` пустая → удалить.

Пути для пользователя остаются те же: `/account`, `/cart`, `/checkout`, `/settings`, `/admin` (pathless layouts `_authed`/`_admin` не добавляют сегмент к URL).

### 3. Публичная главная

- **`frontend/src/routes/_public/index.tsx`** (NEW) — простая публичная главная с hero-фото и CTA в каталог. Содержание минимальное: фоновое изображение, заголовок, описание, кнопка «Перейти в каталог». Без длинных секций — чтобы не разрастаться.

  Тестовое содержание (фото через `picsum.photos/seed/.../1600/700`):
  ```tsx
  export const Route = createFileRoute("/_public/")({
    component: HomePage,
    head: () => ({ meta: [{ title: "Главная — FastAPI Template" }] }),
  })

  function HomePage() {
    return (
      <section className="relative overflow-hidden rounded-xl">
        <img src="https://picsum.photos/seed/storefront/1600/700"
             alt="Витрина" className="h-[420px] w-full object-cover" />
        <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/70 via-black/40 to-transparent">
          <div className="max-w-xl space-y-5 px-6 text-white md:px-12">
            <h1 className="text-4xl font-bold md:text-5xl">
              Добро пожаловать
            </h1>
            <p className="text-white/90">…короткое описание магазина…</p>
            <Button asChild size="lg">
              <Link to="/catalog">Перейти в каталог</Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }
  ```

### 4. PublicHeader: «Каталог» как кнопка справа

`frontend/src/components/Common/PublicHeader.tsx`:

- Удалить блок `<nav>` слева (он содержит только ссылку «Каталог»). Остаётся только `<Logo variant="full" />` слева.
- В правой части перед иконками `loggedIn`/`!loggedIn` добавить **первым элементом**:
  ```tsx
  <Button asChild size="sm">
    <Link to="/catalog" activeProps={{ className: "ring-2 ring-primary/30" }}>
      <ShoppingBag className="size-4" />
      <span className="hidden sm:inline">Каталог</span>
    </Link>
  </Button>
  ```
  Иконка `ShoppingBag` из `lucide-react` (уже используется в AppSidebar). `variant="default"` — заливка primary, согласно палитре.

Остальные пункты (Корзина / Избранное / Кабинет / Выйти / Войти / Регистрация) сохраняются как есть. Ссылка «Избранное» уже идёт в `/account?tab=wishlist` — это и есть требование «перенести Избранное в /account как tab».

### 5. AppSidebar — без изменений

Файл `frontend/src/components/Sidebar/AppSidebar.tsx` остаётся как есть. Он теперь рендерится только в `_admin.tsx`, то есть на админских страницах. Ссылки «Главная / Каталог / Корзина / Избранное / Кабинет» в сайдбаре дают админу способ вернуться к обычной части сайта; «Админка» — фокус на админ-разделе.

### 6. Редиректы на «/»

Несколько мест редиректят на `/` после успешных операций (`useAuth.ts:52`, `login.tsx:40`, `signup.tsx:47`, `recover-password.tsx:38`, `reset-password.tsx:54`, `admin.tsx:24`). Все они остаются как есть — теперь `/` это публичная главная, что нормально. Если позже хочется направлять залогиненных пользователей в `/account` — это отдельная задача, в этом плане не делаем.

### 7. Прочее

- `__root.tsx` уже глобально подключает `ThemeSwitcher` (слева снизу) — без изменений.
- `frontend/src/routes/routeTree.gen.ts` пересоберётся автоматически при `npx vite build` / `npm run dev`.

## Критические файлы

- `frontend/src/routes/_layout.tsx` — удалить.
- `frontend/src/routes/_layout/*` — перенести в `_authed/` / `_admin/`, папку удалить.
- `frontend/src/routes/_authed.tsx` — создать.
- `frontend/src/routes/_admin.tsx` — создать.
- `frontend/src/routes/_public/index.tsx` — создать.
- `frontend/src/components/Common/PublicHeader.tsx` — переоформить навигацию.

## Verification

1. `cd frontend && npx vite build` — пересборка `routeTree.gen.ts` и проверка, что нет конфликтов маршрутов.
2. `npm run lint` и `npx tsc -p tsconfig.build.json --noEmit` — чисто.
3. `docker compose watch` → проверки:
   - **Незалогиненный**: открыть `/` → публичная главная с фото и кнопкой; в navbar — Logo, кнопка «Каталог» справа, «Войти», «Регистрация». Sidebar нигде не появляется.
   - **Залогиненный обычный**: `/cart`, `/account`, `/account?tab=wishlist`, `/account?tab=orders`, `/checkout`, `/settings` — всё открывается, в navbar справа: Каталог, Корзина, Избранное, Кабинет, Выйти. Sidebar отсутствует.
   - **Залогиненный обычный пытается зайти на `/admin`**: редирект на `/` (защита внутри `admin.tsx`).
   - **Залогиненный superuser**: на `/admin` появляется sidebar (AppSidebar) с пунктами + админкой. На `/`, `/cart`, `/account` — обычный navbar без sidebar.
   - **Логин flow**: после `/login` юзер попадает на `/` (публичная главная).
4. Кнопка «Каталог» в правой части navbar: variant=default (терракотовый primary), `ShoppingBag` иконка + текст «Каталог» на ≥sm.
5. Активный таб «Избранное» в `/account?tab=wishlist` отрабатывает корректно (без отдельного маршрута `/wishlist`).
