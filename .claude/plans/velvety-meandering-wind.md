# Карточка товара как отдельная страница

## Контекст

В публичном каталоге (`/catalog`) при клике на товар URL меняется на `/catalog/<uuid>`, но содержимое страницы остаётся прежним — продолжают показываться фильтры и сетка товаров. Нужно, чтобы карточка открывалась как полноценная отдельная страница, и в ней отображалась полная информация о товаре.

**Корень бага:** в TanStack Router file-based routing файл `frontend/src/routes/_public/catalog.$id.tsx` — это **дочерний** маршрут для `catalog.tsx` (точечная нотация = вложенность). Чтобы дочерний маршрут отрендерился, родительский компонент `Catalog()` (`catalog.tsx:130`) должен содержать `<Outlet />`. Его там нет → URL обновляется, но React продолжает показывать список + фильтры. Сама страница `catalog.$id.tsx` уже зарегистрирована в `routeTree.gen.ts:25` и работоспособна — её просто нечем «вывести» на экран.

**Также по второму пункту задачи:** в `ProductDetail` сейчас не показываются категория и размер по имени (в `ItemPublic` приходят только `category_id` / `size_id` как UUID), и нет навигации обратно в каталог.

## Что меняем

### 1. Переименование роута (баг-фикс)

`frontend/src/routes/_public/catalog.tsx` → `frontend/src/routes/_public/catalog.index.tsx`

- Содержимое файла **не меняется** — только имя.
- Внутри `createFileRoute("/_public/catalog")` оставить как есть.
- Использовать `git mv`, чтобы сохранить историю.

После этого `catalog.index` (страница `/catalog`) и `catalog.$id` (страница `/catalog/<id>`) станут братскими маршрутами под общим родителем `_public`, у которого `<Outlet />` уже есть и работает (это подтверждается тем, что текущий `/catalog` отображается).

`frontend/src/routeTree.gen.ts` пересоздастся автоматически плагином `@tanstack/router-plugin/vite` при следующем запуске `bun run dev`. **Важно:** до первого старта dev-сервера старые импорты `from './routes/_public/catalog'` в `routeTree.gen.ts` будут битыми — поэтому сначала запускаем `bun run dev`, и только потом `lint`/`build`.

### 2. Расширение карточки товара

Файл: `frontend/src/components/Catalog/ProductDetail.tsx`

**A. Категория и размер по имени.** Подгружаем справочники теми же query keys, которые уже использует `CatalogFilters` в `catalog.tsx:63-70` (`["categories", "public"]`, `["sizes", "public"]`) — кэш TanStack Query переиспользуется автоматически, новых сетевых запросов при переходе со списка на карточку не возникнет.

```tsx
const categoriesQuery = useQuery({
  queryKey: ["categories", "public"],
  queryFn: async () => (await categoriesReadCategoriesPublic()).data!,
})
const sizesQuery = useQuery({
  queryKey: ["sizes", "public"],
  queryFn: async () => (await sizesReadSizesPublic()).data!,
})

const categoryName = item.category_id
  ? categoriesQuery.data?.data.find((c) => c.id === item.category_id)?.name
  : undefined
const sizeName = item.size_id
  ? sizesQuery.data?.data.find((s) => s.id === item.size_id)?.name
  : undefined
```

Блок рендерится в правой колонке под `<h1>{item.title}</h1>`, перед блоком цены. Если справочник ещё не загружен или категория/размер удалены — соответствующая строка просто скрывается (без «—», без skeleton — мягкая деградация).

```tsx
{(categoryName || sizeName) && (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
    {categoryName && <span>Категория: {categoryName}</span>}
    {sizeName && <span>Размер: {sizeName}</span>}
  </div>
)}
```

**B. Кнопка «Назад в каталог».** Первой нодой в JSX, через `<Link to="/catalog">` (а не `history.back()` — пользователь мог открыть карточку напрямую по URL).

```tsx
return (
  <div className="space-y-6">
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to="/catalog">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Назад в каталог
      </Link>
    </Button>
    <div className="grid gap-8 lg:grid-cols-2">
      {/* …существующая разметка без изменений… */}
    </div>
  </div>
)
```

**Новые импорты в `ProductDetail.tsx`:**

```tsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { categoriesReadCategoriesPublic, sizesReadSizesPublic } from "@/client"
```

## Что НЕ трогаем

- Бэкенд — все нужные данные есть в SDK.
- `frontend/src/routes/_public/catalog.$id.tsx` — он корректен, после переименования родителя начнёт рендериться.
- `frontend/src/client/**` — генерируется openapi-ts.
- `frontend/src/routeTree.gen.ts` — пересоздаётся автоматически.
- shadcn-примитивы добавлять не нужно (`Button`, `Card`, `Badge`, `Skeleton` уже есть).

## Критические файлы

- `frontend/src/routes/_public/catalog.tsx` → `git mv` в `catalog.index.tsx` (содержимое не меняется)
- `frontend/src/components/Catalog/ProductDetail.tsx` — редактирование (импорты, queries, кнопка назад, строки с именами)
- `frontend/src/routes/_public/catalog.$id.tsx` — НЕ редактировать, убедиться, что рендерится
- `frontend/src/routeTree.gen.ts` — НЕ редактировать вручную, проверить что пересоздался

## Верификация

1. `cd frontend && bun run dev` — дождаться `VITE ready`. Плагин роутера должен пересоздать `routeTree.gen.ts` с парой `PublicCatalogIndexRouteImport` + `PublicCatalogIdRouteImport` под общим `PublicRoute`.
2. Открыть `http://localhost:5173/catalog` → список товаров и фильтры отображаются как раньше.
3. Кликнуть карточку → URL становится `/catalog/<uuid>`, страница **полностью** заменяется на карточку (без фильтров и сетки сверху).
4. На странице карточки видны: кнопка «← Назад в каталог», название, бренд, цена, бейдж наличия, **строки «Категория: …» и «Размер: …»**, описание, селектор количества, кнопки «В корзину» / «В избранное».
5. Клик «Назад в каталог» → клиентская навигация на `/catalog` без full reload.
6. Открыть `/catalog/<uuid>` напрямую в новой вкладке → кнопка «Назад» работает (ведёт на `/catalog`).
7. DevTools → Network: при переходе со `/catalog` на `/catalog/<id>` запросы `/categories/public` и `/sizes/public` не повторяются (кэш совпадает по queryKey).
8. `cd frontend && bun run lint` — без ошибок.
9. `cd frontend && bun run build` — без ошибок TypeScript.
