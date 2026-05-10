# Реализация интернет-магазина

## Контекст

Сейчас в проекте есть админский CRUD товаров `/items`, справочники Categories/Sizes, аутентификация и страница `/admin` для управления пользователями. Требуется превратить шаблон в работающий магазин: публичный каталог, карточка товара, серверная корзина, wishlist, оформление заказа со снимком цен, личный кабинет с историей заказов и админка с управлением статусами заказов.

Ответы пользователя на ключевые развилки:
- `/catalog` публичный, существующий `/items` переезжает в таб админки.
- Каталог открыт гостям; корзина/wishlist/чекаут/`/account`/`/admin` — за auth.
- Чекаут минимальный: ФИО, телефон, адрес одной строкой, опц. комментарий.
- В `Item` добавляется `image_url` и `stock` (с проверкой на чекауте).
- Личный кабинет — отдельный `/account` с Tabs «Заказы» и «Wishlist».
- `/admin` — одна страница с Tabs Users/Items/Orders.

Целевые статусы заказа (русские лейблы для UI, `Enum.value` для БД): `NEW`/«Новый» → `PROCESSED`/«Обработан» → `PAID`/«Оплачен» → `SHIPPED`/«Отправлен» → `DELIVERED`/«Доставлен». Переходы линейные, только вперёд.

---

## 1. Backend — модели

### 1.1. Изменения существующих файлов

`backend/app/models/item.py`:
- В `ItemBase` добавить `image_url: str | None = Field(default=None, max_length=2048)` и `stock: int = Field(default=0, ge=0)`. Поля наследуются всем семейством (`ItemCreate`/`Item`/`ItemPublic`).
- В `ItemUpdate` (не наследуется от Base) добавить те же два поля как `| None = None`.
- В `class Item(... table=True)` добавить обратные отношения:
  - `cart_items: list["CartItem"] = Relationship(back_populates="item", cascade_delete=True)`
  - `wishlist_items: list["WishlistItem"] = Relationship(back_populates="item", cascade_delete=True)`
  - `order_items: list["OrderItem"] = Relationship(back_populates="item")` (без cascade — снимок переживает удаление товара через `SET NULL` на FK).
- Дополнить `if TYPE_CHECKING:` импортом новых моделей.

`backend/app/models/user.py`:
- Добавить три relationship: `cart_items`, `wishlist_items`, `orders` — все с `cascade_delete=True`.
- Дополнить `if TYPE_CHECKING:` импортами.

`backend/app/models/__init__.py`:
- Реэкспортировать всё новое (см. ниже) и обновить `__all__`. `Order` и связанные обязаны импортироваться при загрузке пакета — иначе SQLModel не построит relationship.

### 1.2. Новый `backend/app/models/order.py`

- `class OrderStatus(str, Enum)` с пятью членами (`NEW`, `PROCESSED`, `PAID`, `SHIPPED`, `DELIVERED`).
- `OrderBase`: `recipient_name: str` (1..255), `phone: str` (1..32), `address: str` (1..1024), `comment: str | None` (max 2000).
- `OrderCreate(SQLModel)` — те же поля, что `OrderBase` (тело чекаута; корзина не передаётся, читается на сервере).
- `OrderUpdate(SQLModel)` — `status: OrderStatus | None = None` (для PATCH суперюзером).
- `Order(OrderBase, table=True)` с `__tablename__ = "shop_order"` (избегаем зарезервированного `ORDER` в Postgres):
  - `id: uuid.UUID` PK; `status: OrderStatus = Field(default=NEW, index=True)`;
  - `total: Decimal = Field(sa_column=Column(Numeric(10,2), nullable=False, default=0))`;
  - `user_id` FK→user.id, `ondelete="CASCADE"`, `index=True`;
  - `created_at` через `get_datetime_utc`/`DateTime(timezone=True)`;
  - relationships: `user` (back_populates="orders"), `items: list["OrderItem"]` (back_populates="order", `cascade_delete=True`).
- `OrderItemPublic(SQLModel)` — `id`, `item_id: uuid.UUID | None`, `title_snapshot`, `price_snapshot: Decimal`, `quantity: int`. Объявлен здесь же, чтобы избежать кругового импорта.
- `OrderPublic(OrderBase)`: `id`, `user_id`, `status`, `total`, `created_at`, `items: list[OrderItemPublic] = []`.
- `OrdersPublic(SQLModel)`: `data: list[OrderPublic]`, `count: int`.

### 1.3. Новый `backend/app/models/order_item.py`

Только табличная модель (наружу выходит вложенно через `OrderItemPublic` из `order.py`):

`OrderItem(SQLModel, table=True)`:
- `id` PK;
- `order_id` FK→`shop_order.id`, `ondelete="CASCADE"`, `index=True`;
- `item_id: uuid.UUID | None` FK→`item.id`, `ondelete="SET NULL"`;
- `title_snapshot: str` (max 255);
- `price_snapshot: Decimal` через `Column(Numeric(8,2), nullable=False)`;
- `quantity: int = Field(default=1, ge=1)`;
- relationships: `order` (back_populates="items"), `item` (back_populates="order_items").

### 1.4. Новый `backend/app/models/cart.py`

- `CartItemBase`: `quantity: int = Field(default=1, ge=1, le=999)`.
- `CartItemCreate`: `item_id: uuid.UUID`, `quantity: int = Field(default=1, ge=1, le=999)`.
- `CartItemUpdate`: только `quantity: int (ge=1, le=999)`.
- `CartItem(CartItemBase, table=True)`:
  - `id` PK; `user_id` FK→user CASCADE; `item_id` FK→item CASCADE; `created_at`.
  - `__table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_cart_user_item"),)`.
  - relationships `user`, `item`.
- `CartItemPublic(CartItemBase)`: `id`, `item_id`, `quantity`, `item: ItemPublic | None`, `created_at: datetime | None`.
- `CartItemsPublic(SQLModel)`: `data`, `count`, `subtotal: Decimal` (вычисляется в роуте).

### 1.5. Новый `backend/app/models/wishlist.py`

- `WishlistItemCreate`: `item_id: uuid.UUID`.
- `WishlistItem(SQLModel, table=True)`: `id`, `user_id` (CASCADE), `item_id` (CASCADE), `created_at`, `UniqueConstraint("user_id","item_id", name="uq_wishlist_user_item")`, relationships `user`/`item`.
- `WishlistItemPublic`: `id`, `item_id`, `item: ItemPublic | None`, `created_at`.
- `WishlistItemsPublic`: `data`, `count`.

---

## 2. Backend — CRUD (`backend/app/crud.py`)

Стиль повторяет существующие функции (kw-only, `commit + refresh`):

- **Cart**: `get_user_cart(session, user_id)` (с `selectinload(CartItem.item)`); `add_to_cart(session, user_id, payload)` — если запись (user_id,item_id) уже есть, увеличить `quantity`, иначе создать; `update_cart_quantity(session, cart_item, quantity)`; `delete_cart_item(session, cart_item)`; `clear_cart(session, user_id)` (массовый `delete(...)`).
- **Wishlist**: `get_user_wishlist`, `add_to_wishlist` (идемпотентно — повторный возврат существующей записи), `delete_wishlist_item`.
- **Orders**: `list_orders(session, *, user_id=None, status=None, skip, limit)`; `get_order(session, order_id)`; `update_order_status(session, order, new_status)`; `create_order_from_cart(session, user, payload)`. Последняя — транзакционная: загружает корзину с `selectinload`, проверяет непустоту и `quantity ≤ stock` (иначе `ValueError`), создаёт `Order` со статусом `NEW`, `OrderItem`-снимки (title/price), уменьшает `Item.stock`, считает `total = sum(price * qty)`, очищает `CartItem` пользователя, коммитит. На исключении — `session.rollback()`.

Stock-валидацию политика — в роуте (HTTP-коды). CRUD остаётся тонким; валидацию переходов статуса тоже делает роут.

---

## 3. Backend — роуты

### 3.1. Новый `backend/app/api/routes/cart.py` — `prefix="/cart" tags=["cart"]`, везде `CurrentUser`

- `GET /` → `CartItemsPublic` (с подсчётом `subtotal`).
- `POST /` body `CartItemCreate` → `CartItemPublic`. 404 на отсутствующий item; 409 «Недостаточно товара на складе» если `(existing_qty + new_qty) > item.stock`.
- `PATCH /{id}` body `CartItemUpdate` → `CartItemPublic`. 404 / 403 (только владелец, без поблажки суперюзеру) / 409 на превышение stock.
- `DELETE /{id}` → `Message`. Ownership.
- `DELETE /` → `Message("Cart cleared")`.

### 3.2. Новый `backend/app/api/routes/wishlist.py` — `prefix="/wishlist" tags=["wishlist"]`

- `GET /` → `WishlistItemsPublic`.
- `POST /` body `WishlistItemCreate` → `WishlistItemPublic` (идемпотентно).
- `DELETE /{id}` → `Message`. Ownership.

### 3.3. Новый `backend/app/api/routes/orders.py` — `prefix="/orders" tags=["orders"]`

- `POST /` body `OrderCreate` → `OrderPublic` (`current_user`). Перехват `ValueError` → 400.
- `GET /` query `skip`, `limit`, `status?` → `OrdersPublic`. Суперюзер видит все, обычный — `where Order.user_id == current_user.id`. Сортировка по `created_at desc`, eagerload `items`.
- `GET /{id}` → `OrderPublic`. 404 / 403.
- `PATCH /{id}/status` body `OrderUpdate`, `Depends(get_current_active_superuser)`. Допустимые переходы: `NEW→PROCESSED→PAID→SHIPPED→DELIVERED`. Любой откат или skip → 400 «Недопустимый переход статуса».

### 3.4. Расширение `backend/app/api/routes/items.py` — публичные ручки каталога

Добавить два эндпоинта **без** `CurrentUser`:
- `GET /items/public` → `ItemsPublic`. Query: `skip`, `limit`, `category_id?`, `size_id?`. Сортировка `created_at desc`, без owner-фильтра.
- `GET /items/public/{id}` → `ItemPublic`. 404 если нет.

Существующий админский CRUD оставить как есть.

### 3.5. Публичные ручки справочников

Каталог нуждается в фильтрах. Текущие `/categories/`, `/sizes/` требуют auth. Добавить:
- `GET /categories/public` → `CategoriesPublic` (без auth) в `routes/categories.py`.
- `GET /sizes/public` → `SizesPublic` (без auth) в `routes/sizes.py`.

Только чтение, без write-операций.

### 3.6. Регистрация в `backend/app/api/main.py`

Добавить include для `cart`, `wishlist`, `orders`. Старые роутеры сохраняются.

---

## 4. Alembic — одна ревизия

Создать через `alembic revision --autogenerate -m "add shop tables and item fields"` (внутри docker), затем причесать вручную.

`upgrade()`:
1. `op.add_column('item', sa.Column('image_url', sa.String(2048), nullable=True))`.
2. `op.add_column('item', sa.Column('stock', sa.Integer(), nullable=False, server_default='0'))`.
3. Создать ENUM `orderstatus = sa.Enum('NEW','PROCESSED','PAID','SHIPPED','DELIVERED', name='orderstatus')` через `orderstatus.create(op.get_bind(), checkfirst=True)`.
4. `op.create_table('shop_order', ...)` — все поля, FK `user_id` CASCADE, индексы по `status`, `user_id`.
5. `op.create_table('orderitem', ...)` — FK `order_id` → `shop_order.id` CASCADE, FK `item_id` → `item.id` SET NULL, индексы по `order_id`, `item_id`.
6. `op.create_table('cartitem', ...)` — FK + `UniqueConstraint('user_id','item_id', name='uq_cart_user_item')`, индексы.
7. `op.create_table('wishlistitem', ...)` — то же без quantity, `uq_wishlist_user_item`.

`downgrade()`: drop wishlistitem → cartitem → orderitem → shop_order → enum `orderstatus.drop()` → drop_column `item.stock` → drop_column `item.image_url`.

---

## 5. Сидинг (`backend/app/core/db.py`)

Расширить каждый словарь в `SEED_ITEMS` ключами `image_url` и `stock` (примеры значений: `https://picsum.photos/seed/<slug>/600/600`, stock 10–50). В `_seed_items` пробросить эти поля в `ItemCreate(...)`. Идемпотентность сохраняется (`count > 0 → return`). Cart/wishlist/orders **не сидируем**.

---

## 6. Backend-тесты

### 6.1. Новые фабрики в `backend/tests/utils/`

- `order.py` — `create_random_order(db, *, user=None, status=NEW, with_items=2)`.
- `cart.py` — `create_random_cart_item(db, *, user, item, quantity=1)`.
- `wishlist.py` — `create_random_wishlist_item(db, *, user, item)`.

### 6.2. Новые роут-тесты в `backend/tests/api/routes/`

- `test_cart.py`: пустая корзина; повторный POST увеличивает `quantity` (без дубля); 409 при превышении stock; 404 на несуществующий item; 403 на чужой PATCH/DELETE; `DELETE /cart` очищает.
- `test_wishlist.py`: идемпотентность POST; 404 на несуществующий item; 403 на чужой DELETE.
- `test_orders.py`: POST без корзины → 400; POST со stock-нарушением → 400; успех — stock уменьшен, корзина очищена, total корректен, snapshot сохранён; GET `/` суперюзер vs пользователь; 403 на чужой `GET /{id}`; PATCH /status: суперюзер NEW→PROCESSED ок; обычный пользователь → 403; PROCESSED→NEW → 400; NEW→PAID (skip) → 400.
- Расширить `test_items.py`: `GET /items/public` без авторизации возвращает все, фильтр по `category_id` работает; `GET /items/public/{id}` без auth.
- Опц. `test_categories.py`/`test_sizes.py` — добавить тесты на public-ручки.

### 6.3. Обновить `backend/tests/conftest.py`

В teardown-фикстуре добавить `delete()` в правильном порядке (от детей к родителям) **до** существующих очисток `Item/Size/Category/User`:
```
OrderItem → Order → CartItem → WishlistItem → Item → Size → Category → User
```
Импорты дополнить новыми моделями.

---

## 7. Frontend — фронт-задачи

### 7.1. Регенерация SDK

После применения миграции и подъёма backend:
```
bash scripts/generate-client.sh
```
Появятся плоские функции `cartReadCart`, `cartAddToCart`, `cartUpdateCartItem`, `cartDeleteCartItem`, `cartClearCart`, `wishlistReadWishlist`, `wishlistAddToWishlist`, `wishlistDeleteWishlistItem`, `ordersCreateOrder`, `ordersReadOrders`, `ordersReadOrder`, `ordersUpdateOrderStatus`, `itemsReadItemsPublic`, `itemsReadItemPublic`, `categoriesReadCategoriesPublic`, `sizesReadSizesPublic`. (Точные имена зависят от автогенерации; задавать `name=...` в декораторах не обязательно — текущий стиль использует имя функции.)

### 7.2. Глобальный fix interceptor (`frontend/src/main.tsx:20-26`)

Текущая реализация безусловно редиректит на `/login` при 401/403, что сломает публичные страницы (любой 401 на `/cart` для гостя превратится в редирект). Изменить условие:
```ts
if ([401, 403].includes(response.status) && localStorage.getItem("access_token")) {
  localStorage.removeItem("access_token")
  window.location.href = "/login"
}
```
Если токена нет — гость, ничего не делаем.

### 7.3. Публичный layout

Создать `frontend/src/routes/_public.tsx` — pathless layout без `beforeLoad`. Внутри тонкий header (`Logo` слева, ссылка «Каталог», справа: для авторизованных — «Корзина»/«Кабинет»/«Выйти»; для гостей — «Войти»/«Регистрация») и `<Outlet />`. Footer переиспользовать существующий.

Header вынести в новый `frontend/src/components/Common/PublicHeader.tsx`.

Под `_public/` положить:
- `frontend/src/routes/_public/catalog.tsx` — листинг с фильтрами.
- `frontend/src/routes/_public/catalog.$id.tsx` — карточка товара.

### 7.4. Каталог и карточка товара

`/catalog`:
- `validateSearch` через zod: `category_id?`, `size_id?`, `skip?`.
- `useSuspenseQuery(["catalog", search], () => itemsReadItemsPublic({query: search}))`.
- Параллельно `categoriesReadCategoriesPublic` и `sizesReadSizesPublic` для фильтров.
- Pending: `<PendingCatalog />` (skeleton 8 карточек).

Новые компоненты `frontend/src/components/Catalog/`:
- `ProductCard.tsx` — `image_url` (fallback на placeholder), title, brand, cost, кнопка «В корзину», иконка-сердечко wishlist в углу. Если не залогинен — клик ведёт на `/login` (через redirect-search-param).
- `ProductGrid.tsx` — CSS grid + skeleton.
- `CategoryFilter.tsx`, `SizeFilter.tsx` — селекты, прокидывают значения в `navigate({search: ...})`.
- `ProductDetail.tsx` — большая карточка (картинка слева, info справа, поле `quantity`, кнопки «В корзину»/«В wishlist»).
- `AddToCartButton.tsx`, `AddToWishlistButton.tsx` — гард на `isLoggedIn()`; mutation на `cartAddToCart`/`wishlistAddToWishlist`; toast «Добавлено в корзину»/«Добавлено в избранное»; invalidate `["cart"]`/`["wishlist"]`.

### 7.5. Корзина (`frontend/src/routes/_layout/cart.tsx`)

`useSuspenseQuery(["cart"], cartReadCart)`. Pending: `PendingCart`.

Компоненты `frontend/src/components/Cart/`:
- `CartList.tsx` — `useSuspenseQuery`.
- `CartItemRow.tsx` — image / title / cost / `QuantityControl` / удалить / итог по строке.
- `QuantityControl.tsx` — `[-] N [+]`, мутация `cartUpdateCartItem` с onError-rollback при 409 (stock).
- `CartSummary.tsx` — `subtotal` + кнопка «Оформить заказ» (`<Link to="/checkout">`, `disabled` при пустой корзине).

### 7.6. Чекаут (`frontend/src/routes/_layout/checkout.tsx`)

Layout: слева `CheckoutForm`, справа `OrderSummary` (читает `cartReadCart`).

`frontend/src/components/Checkout/`:
- `CheckoutForm.tsx` — `react-hook-form` + zod (recipient_name min 2, phone regex `/^\+?[\d\s\-()]{6,32}$/`, address min 5, comment max 2000 опц.). После успеха `ordersCreateOrder` → invalidate `["cart"]`, `["orders"]`, toast → `navigate({to: "/account", search: {tab: "orders"}})`.
- `OrderSummary.tsx` — компактный список + total.

### 7.7. Личный кабинет (`frontend/src/routes/_layout/account.tsx`)

`Tabs` со значениями `orders`/`wishlist`, текущая вкладка читается из `Route.useSearch()` (`?tab=orders`). Default `orders`.

`frontend/src/components/Orders/`:
- `OrdersList.tsx` — `useSuspenseQuery(["orders"], ordersReadOrders)`.
- `OrderRow.tsx` — `Accordion` (адрес/телефон/комментарий + список `OrderItem`).
- `OrderStatusBadge.tsx` — маппинг `OrderStatus` → цвет (`NEW=secondary`, `PROCESSED=blue`, `PAID=violet`, `SHIPPED=amber`, `DELIVERED=green`) и русские лейблы.

`frontend/src/components/Wishlist/`:
- `WishlistList.tsx`, `WishlistItemRow.tsx` — кнопки «В корзину» (вызывает `cartAddToCart`) и «Удалить из избранного».

### 7.8. Рефакторинг `/admin` (`frontend/src/routes/_layout/admin.tsx`)

Превратить в страницу с `Tabs` Users/Items/Orders, активная вкладка через `?tab=`:
- Users-таб — оставить существующий код (текущий контент admin.tsx — `<DataTable>` с пользователями) в виде компонента `frontend/src/components/Admin/UsersAdminPanel.tsx`.
- Items-таб — компонент `frontend/src/components/Admin/ItemsAdminPanel.tsx`: туда **скопировать тело** `frontend/src/routes/_layout/items.tsx` (`getItemsQueryOptions`, `getSizesQueryOptions`, `ItemsTableContent`, `SizesTableContent`, JSX вложенных Tabs items+sizes), без `createFileRoute`.
- Orders-таб — `frontend/src/components/Admin/Orders/AdminOrdersTable.tsx` (`DataTable` со столбцами id, created_at, user_id, total, status, action). `OrderStatusSelect.tsx` — shadcn `Select` с допустимыми следующими статусами для текущего значения (`DELIVERED` — disabled). Mutation `ordersUpdateOrderStatus`, invalidate `["orders","admin"]`.

Сохранить `beforeLoad` редирект для не-суперюзера.

### 7.9. Удаление `frontend/src/routes/_layout/items.tsx`

После переноса контента в `ItemsAdminPanel.tsx`:
1. Удалить файл `routes/_layout/items.tsx` (vite-плагин обновит `routeTree.gen.ts`).
2. В `frontend/src/components/Sidebar/AppSidebar.tsx:15-25` убрать пункт `Items`. Добавить пункты для авторизованных: «Каталог» (`/catalog`), «Корзина» (`/cart`), «Кабинет» (`/account`). Admin-пункт сохранить.
3. Прогнать `bun run build` — починить любые оставшиеся ссылки `to="/items"` (например, в редиректах).

---

## 8. Критические файлы

**Backend:**
- `backend/app/models/__init__.py` (реэкспорт), `models/item.py`, `models/user.py` (изменения); новые `models/order.py`, `models/order_item.py`, `models/cart.py`, `models/wishlist.py`.
- `backend/app/crud.py` (новые функции).
- `backend/app/api/main.py` (регистрация); новые `routes/cart.py`, `routes/wishlist.py`, `routes/orders.py`; правки `routes/items.py`, `routes/categories.py`, `routes/sizes.py`.
- `backend/app/core/db.py` (SEED_ITEMS).
- Новая миграция в `backend/app/alembic/versions/`.
- `backend/tests/conftest.py`; новые `tests/utils/{order,cart,wishlist}.py`; новые `tests/api/routes/test_{cart,wishlist,orders}.py`; правки `test_items.py`.

**Frontend:**
- `frontend/src/main.tsx` (interceptor).
- `frontend/src/components/Sidebar/AppSidebar.tsx`.
- Новые `routes/_public.tsx`, `routes/_public/catalog.tsx`, `routes/_public/catalog.$id.tsx`.
- Новые `routes/_layout/cart.tsx`, `routes/_layout/checkout.tsx`, `routes/_layout/account.tsx`.
- Рефакторинг `routes/_layout/admin.tsx`; удаление `routes/_layout/items.tsx`.
- Новые папки компонентов: `components/Catalog/`, `components/Cart/`, `components/Wishlist/`, `components/Orders/`, `components/Checkout/`, `components/Admin/Orders/`; компонент `components/Common/PublicHeader.tsx`; новые `components/Pending/Pending{Catalog,Cart,Orders}.tsx`.

**Переиспользуем без изменений:** `components/ui/*` (shadcn), `components/Common/DataTable.tsx`, `components/Common/SizeCombobox.tsx`, `hooks/useAuth.ts`, `hooks/useCustomToast.ts`, `utils.ts::handleError`, паттерны из `components/Items/`.

---

## 9. Порядок выполнения

1. Backend: модели + миграция + сидинг + регистрация роутеров. `bash backend/scripts/lint.sh`.
2. CRUD-функции и роуты cart/wishlist/orders + публичные ручки items/categories/sizes.
3. Backend-тесты + обновлённый `conftest`. `bash backend/scripts/test.sh` зелёный.
4. `bash scripts/generate-client.sh` — обновить SDK.
5. Глобальная правка interceptor в `main.tsx` (иначе публичные страницы будут редиректить).
6. `_public` layout + `/catalog` + `/catalog/$id` (+ `Catalog` компоненты, `PublicHeader`).
7. `/cart` + `/checkout` (+ `Cart`/`Checkout` компоненты).
8. `/account` (Tabs + `Orders`/`Wishlist` компоненты).
9. Рефакторинг `/admin` (Tabs Users/Items/Orders) + перенос содержимого `items.tsx` в `ItemsAdminPanel`, удаление `routes/_layout/items.tsx`, чистка sidebar.
10. `cd frontend && bun run lint && bun run build`.

---

## 10. Verification

**Backend:**
- `cd backend && bash scripts/lint.sh` (mypy + ty + ruff). `ty` строгий — следить за `X | None` и аннотациями relationship.
- `bash scripts/test.sh` — миграции + init_db + pytest.
- Точечно: `uv run pytest tests/api/routes/test_orders.py -v` (транзакционность checkout).

**Frontend:**
- `cd frontend && bun run lint`.
- `bun run build` — проверка типов после регенерации SDK.

**Ручной smoke-сценарий (после `docker compose watch`):**
1. Гость открывает `/catalog` — карточки с картинками, фильтры работают.
2. Клик «В корзину» в карточке → редирект на `/login` (`?redirect=/catalog`).
3. Логин обычным пользователем → возврат на `/catalog`.
4. Добавление товара → toast «Добавлено в корзину».
5. `/cart` — позиция, изменение `quantity`, удаление, повторное добавление.
6. `/checkout` — форма ФИО/телефон/адрес/комментарий → submit → редирект `/account?tab=orders`.
7. `/account?tab=orders` — заказ со статусом «Новый», адрес/телефон видны.
8. Логин суперюзером → `/admin?tab=orders` → смена статуса NEW→PROCESSED. Попытка PATCH /status обычным пользователем → 403.
9. Возврат под обычным пользователем → `/account?tab=orders` — статус обновился.
10. Edge-case: пустой чекаут → 400; quantity > stock в корзине → 409.
