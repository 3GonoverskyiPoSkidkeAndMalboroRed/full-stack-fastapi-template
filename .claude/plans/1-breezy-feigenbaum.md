# План: 4 улучшения интернет-магазина

## Контекст

Пользователь просит четыре независимых улучшения UX магазина:

1. **Счётчик товаров в корзине** в шапке — сейчас иконка корзины (`PublicHeader.tsx`) показывается без числа товаров.
2. **Управление количеством прямо в карточке товара** — сейчас `AddToCartButton` после добавления показывает только надпись «В корзине», без возможности изменить количество или удалить. Существующий `QuantityControl` уже умеет +/− и используется на странице корзины.
3. **Отмена заказа с причиной** — модель `Order` имеет статусы `NEW → PROCESSED → PAID → SHIPPED → DELIVERED`, статуса `CANCELLED` нет, и нет роута для отмены заказа со стороны пользователя.
4. **Звёздочки на обязательных полях** в форме `/account` (`AccountSettings.tsx`) — сейчас визуальной разницы между обязательными и опциональными полями нет. Текста «опц.» в этой форме нет (он только в `CheckoutForm.tsx`, который пользователь решил не трогать) — значит достаточно расставить «*» и не добавлять подписей об опциональности.

Ожидаемый результат: счётчик в шапке, удобная работа с количеством из карточки, кнопка «Отменить заказ» c выбором причины из 4 стандартных + «Другое», и понятная пометка обязательного поля в настройках.

## Решения по уточнениям

- **Страница настроек:** `/account` (компонент `AccountSettings`). Email — единственное обязательное поле, получит «*».
- **Причины отмены:** «Передумал(а) покупать», «Нашёл(ла) дешевле в другом магазине», «Не подошёл размер/модель», «Слишком долгая доставка» + «Другое» с текстовым полем.
- **Когда можно отменять:** в статусах `NEW`, `PROCESSED`, `PAID` (не `SHIPPED` / `DELIVERED` / `CANCELLED`). Возврат денег за `PAID` в этой итерации не реализуем — только смена статуса и возврат `stock` товарам.

---

## 1. Счётчик товаров в шапке

**Файл:** `frontend/src/components/Common/PublicHeader.tsx`

- Добавить `useQuery({ queryKey: ["cart"], queryFn: () => cartReadCart().then(r => r.data!), enabled: loggedIn })`.
- Вокруг иконки `ShoppingCart` обернуть `<span className="relative">` и поверх — `<Badge>` с `cart?.count`, если `cart?.count > 0`. Стиль: маленький круг в правом верхнем углу (используется компонент `@/components/ui/badge`, абсолютное позиционирование, `text-xs`).
- Скрывать badge при `count === 0`.

Не делаем то же самое для `AppSidebar.tsx` — это админская навигация, счётчик там пользователю не нужен.

## 2. Управление количеством в карточке товара

**Файлы:**
- `frontend/src/components/Catalog/AddToCartButton.tsx` — рефактор.
- `frontend/src/components/Catalog/ProductCard.tsx` — место использования.
- Переиспользуем `frontend/src/components/Cart/QuantityControl.tsx` и API `cartDeleteCartItem`.

**Логика в `AddToCartButton.tsx`:**
- Хук `useQuery(["cart"])` уже есть — он возвращает список `cart.data`, ищем по `item_id` соответствующий `cartItem` (нужны его `id` и `quantity`).
- Если `cartItem` не найден → показываем существующую кнопку «В корзину».
- Если найден → вместо кнопки рендерим: `<QuantityControl cartItemId={cartItem.id} quantity={cartItem.quantity} maxQuantity={stock} />` плюс маленькая иконочная кнопка `Trash2` (мутация `cartDeleteCartItem` с инвалидацией `["cart"]`). Обернуть в `<div onClick={e => e.preventDefault()}>` чтобы клик не триггерил `<Link>` карточки.
- Принимать новый опциональный проп `stock?: number` из `ProductCard` для передачи в `maxQuantity`.

**В `ProductCard.tsx`:** передать `stock={item.stock ?? undefined}` в `<AddToCartButton>`.

## 3. Отмена заказа с причиной

### 3.1. Backend — модель и миграция

**Файл:** `backend/app/models/order.py`
- В `OrderStatus` добавить значение `CANCELLED = "CANCELLED"`.
- В таблицу `Order` добавить поле `cancellation_reason: str | None = Field(default=None, max_length=500)`.
- В `OrderPublic` добавить то же поле.
- Создать модель `OrderCancel(SQLModel)` с полем `reason: str = Field(min_length=1, max_length=500)` и реэкспортировать её из `app/models/__init__.py`.

**Миграция:** внутри контейнера backend выполнить `alembic revision --autogenerate -m "add CANCELLED order status and cancellation_reason"`, проверить сгенерированный файл (должен добавлять колонку и расширять enum). При необходимости — поправить руками: для Postgres расширение enum через `ALTER TYPE ... ADD VALUE 'CANCELLED'` (не в транзакции), либо использовать `op.execute(...)`.

### 3.2. Backend — CRUD и роут

**Файл:** `backend/app/crud.py` — добавить функцию `cancel_order(*, session, order, reason)`:
- Меняет `order.status = OrderStatus.CANCELLED` и `order.cancellation_reason = reason`.
- Для каждого `OrderItem` находит соответствующий `Item` (если `item_id is not None`) и делает `item.stock += order_item.quantity` (возврат запаса на склад).
- Коммитит транзакцию.

**Файл:** `backend/app/api/routes/orders.py` — новый эндпоинт:
```
POST /orders/{id}/cancel
body: OrderCancel { reason: str }
```
- Проверки: `order.user_id == current_user.id` или superuser, иначе 403.
- Если `order.status not in {NEW, PROCESSED, PAID}` → 400 «Этот заказ нельзя отменить».
- Иначе `crud.cancel_order(...)` и вернуть `_serialize_order(order)`.
- Не трогать существующий `_ALLOWED_TRANSITIONS` (он для админского pipeline-перехода вперёд) — отмена это отдельная операция.

### 3.3. Frontend — статус и список

**Файл:** `frontend/src/components/Orders/OrderStatusBadge.tsx`
- В `STATUS_LABELS` добавить `CANCELLED: "Отменён"`.
- В `STATUS_CLASSES` добавить `CANCELLED: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100"`.

**Файл:** `frontend/src/components/Orders/OrderRow.tsx`
- В развёрнутом блоке (`{open && ...}`) добавить блок с кнопкой «Отменить заказ» — показывать только если `order.status` ∈ `{NEW, PROCESSED, PAID}`.
- При клике открывается диалог отмены (см. ниже).
- Если `order.cancellation_reason` есть — отрисовать его как отдельную строку «Причина отмены: …».

**Новый файл:** `frontend/src/components/Orders/CancelOrderDialog.tsx`
- Использовать существующий shadcn `Dialog` (`@/components/ui/dialog`) + `RadioGroup` (если уже добавлен; если нет — `npx shadcn add radio-group`).
- 4 предустановленные причины + radio «Другое»; при выборе «Другое» — раскрывается `<Textarea>` (`@/components/ui/textarea`).
- Submit → `useMutation` на `ordersCancelOrder({ path: { id }, body: { reason } })` (имя функции после генерации SDK), `onSuccess` → `queryClient.invalidateQueries({ queryKey: ["orders"] })` и закрыть диалог.
- Ошибки через `handleError` + `useCustomToast`.

### 3.4. Перегенерация SDK

После backend-изменений запустить:
```bash
bash scripts/generate-client.sh
```
SDK получит функции `ordersCancelOrder` и обновлённый enum `OrderStatus`.

## 4. Звёздочка на обязательном поле в /account

**Файл:** `frontend/src/components/Account/AccountSettings.tsx`

- В `FormLabel` для `email` (строка 119) заменить `<FormLabel>Почта</FormLabel>` на:
  ```tsx
  <FormLabel>
    Почта <span className="text-destructive">*</span>
  </FormLabel>
  ```
- ФИО, телефон, адрес доставки — лейблы не трогаем (они опциональны и на бэкенде в `UserUpdateMe`, и в Zod-схеме). Подписей вроде «опц.» в форме нет и добавлять не нужно — паттерн соответствует существующему стилю проекта (см. `AddSize.tsx:92` — там тоже только «*» на обязательном).

---

## Критические файлы

| Задача | Файл |
|---|---|
| 1 | `frontend/src/components/Common/PublicHeader.tsx` |
| 2 | `frontend/src/components/Catalog/AddToCartButton.tsx`, `frontend/src/components/Catalog/ProductCard.tsx` |
| 3 (backend) | `backend/app/models/order.py`, `backend/app/models/__init__.py`, `backend/app/crud.py`, `backend/app/api/routes/orders.py`, новая миграция в `backend/app/alembic/versions/` |
| 3 (frontend) | `frontend/src/components/Orders/OrderStatusBadge.tsx`, `frontend/src/components/Orders/OrderRow.tsx`, **новый** `frontend/src/components/Orders/CancelOrderDialog.tsx` |
| 4 | `frontend/src/components/Account/AccountSettings.tsx` |

## Что переиспользуем

- `QuantityControl` (`frontend/src/components/Cart/QuantityControl.tsx`) — для +/− в карточке товара.
- `cartDeleteCartItem` из `@/client` — удаление из карточки.
- Существующий queryKey `["cart"]` и инвалидации.
- shadcn-примитивы: `Badge`, `Dialog`, `RadioGroup`, `Textarea`, `Button`, `Form*`.
- Паттерн звёздочки из `frontend/src/components/Admin/AddSize.tsx:92`.

## Верификация

1. Поднять стек: `docker compose watch`.
2. Backend-миграция применилась — проверить логи и `psql`:
   `docker compose exec backend bash -c "alembic current"` и
   `\d shop_order` показывает колонку `cancellation_reason`.
3. Зайти в `/account` под обычным пользователем → у поля «Почта» есть «*», у остальных — нет.
4. Зайти на `/catalog` → у иконки корзины в шапке появляется badge при добавлении товара, скрывается после очистки корзины.
5. На карточке товара (каталог): после клика «В корзину» появляются `−`/`+` и иконка удаления; +/− меняет количество (и счётчик в шапке), Trash2 удаляет.
6. Оформить заказ через `/checkout`, затем `/account` → раскрыть заказ → нажать «Отменить заказ» → выбрать причину (включая «Другое» с текстом) → submit. Статус становится «Отменён», в заказе отображается «Причина отмены: …», `stock` товаров вернулся (проверить страницу товара).
7. После отмены кнопка «Отменить заказ» больше не показывается. Кнопка не показывается и при статусах `SHIPPED`/`DELIVERED`.
8. `cd frontend && npm run lint && npm run build` без ошибок.
9. `cd backend && bash scripts/lint.sh` — mypy/ty/ruff чистые.
10. `cd backend && bash scripts/tests-start.sh -x` (если поднят стек) либо `bash scripts/test.sh` — все тесты проходят.
