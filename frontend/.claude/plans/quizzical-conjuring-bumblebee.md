# План: фильтрация по брендам + бренд как сущность

## Контекст

Сейчас бренд товара хранится как свободная текстовая строка `Item.brand: str | None`. Задача — превратить бренд в полноценную сущность `Brand` (по образцу `Category` и `Size`), чтобы:

1. При создании/редактировании товара в админке выбирать бренд из существующих **или создавать новый прямо в форме** (combobox с созданием).
2. Добавить в админ-панель «Товары» третью вкладку **«Бренды»**, где можно создавать бренды и просматривать товары по выбранному бренду.
3. Добавить фильтр по брендам на публичной витрине (каталог) рядом с фильтрами по категориям и размерам.

**Решения, согласованные с пользователем:**

- Существующие текстовые бренды из сидов («Nike», «Adidas» и т.д.) **переносятся** в новую таблицу через data-миграцию, привязка к товарам сохраняется, старое поле `brand` удаляется.
- Фильтрация по брендам — и в каталоге, и в админке.
- Выбор/создание бренда в форме товара — **combobox с возможностью создания** (по образцу `SizeCombobox`).

Бренд моделируется как `Category` (без эндпоинта подсчётов): сущность простая, фильтр-чипсы бренда не показывают счётчики.

---

## Backend

### 1. Новая модель `backend/app/models/brand.py`

Зеркало `backend/app/models/category.py`:

- `BrandBase(SQLModel)` → `name: str = Field(min_length=1, max_length=255)`
- `BrandCreate(BrandBase)` → `pass`
- `BrandUpdate(SQLModel)` → `name: str | None`
- `Brand(BrandBase, table=True)` → `id: uuid.UUID` (PK), `name` unique+index, `items: list["Item"] = Relationship(back_populates="brand")`
- `BrandPublic(BrandBase)` → `+ id`
- `BrandsPublic(SQLModel)` → `data: list[BrandPublic]`, `count: int`

### 2. `backend/app/models/__init__.py`

Добавить импорт и `__all__` для `Brand, BrandCreate, BrandUpdate, BrandPublic, BrandsPublic` (по образцу блока Category).

### 3. `backend/app/models/item.py`

- В `ItemBase`: заменить `brand: str | None` на `brand_id: uuid.UUID | None = Field(default=None, foreign_key="brand.id", ondelete="SET NULL")`.
- В `ItemUpdate`: заменить `brand: str | None` на `brand_id: uuid.UUID | None`.
- В `Item` (table): добавить `brand: Optional["Brand"] = Relationship(back_populates="items")` и `Brand` в блок `if TYPE_CHECKING`.
- В `ItemPublic`: добавить **вложенный** `brand: "BrandPublic | None" = None` — чтобы фронтенд получал имя бренда вместе с товаром (минимум изменений в местах отображения). `brand_id` уже наследуется из `ItemBase`.

### 4. `backend/app/crud.py`

Добавить (зеркало `create_size`/`get_size_by_name`/`update_size`): `create_brand`, `get_brand_by_name`, `update_brand`. Импортировать `Brand, BrandCreate, BrandUpdate`.

### 5. Новый роут `backend/app/api/routes/brands.py`

Зеркало `backend/app/api/routes/categories.py`: `GET /brands/public`, `GET /brands/` (auth), `GET /brands/{id}`, `POST /brands/` (проверка дубля имени), `PUT /brands/{id}`, `DELETE /brands/{id}`.
Зарегистрировать в `backend/app/api/main.py`: `api_router.include_router(brands.router)`.

### 6. `backend/app/api/routes/items.py`

- `read_items_public`: добавить параметр `brand_id: uuid.UUID | None = None` и фильтр `Item.brand_id == brand_id` (по образцу `size_id`, строки 46-48).
- `create_item`: валидация `brand_id` → `session.get(Brand, ...)` (по образцу size, строки 129-132).
- `update_item`: валидация `brand_id` в `update_dict` (по образцу size, строки 161-164).
- Импортировать `Brand`.

### 7. `backend/app/utils_files.py` (строка 36)

`item.brand` теперь связь, не строка. Заменить `slugify(item.brand or "")` на `slugify(item.brand.name if item.brand else "")`.

### 8. Сидинг `backend/app/core/db.py`

- Добавить `_seed_brands(session)`: собрать уникальные значения `brand` из `SEED_ITEMS`, создать `Brand` по образцу `_seed_sizes` (идемпотентно).
- В `init_db` вызвать `_seed_brands(session)` перед `_seed_items`.
- В `_seed_items`: резолвить `brand_id` через `crud.get_brand_by_name(...)` вместо передачи `brand=str(...)`.

### 9. Миграция Alembic

Создать через `alembic revision --autogenerate -m "add brand table and brand_id"` (внутри контейнера), затем **дописать data-миграцию вручную** между созданием таблицы и удалением колонки:

1. `create_table('brand', ...)` + unique index `ix_brand_name`.
2. `add_column('item', brand_id uuid nullable)` + FK на `brand.id` (`ondelete='SET NULL'`).
3. Data-migration через `op.get_bind()`: выбрать `DISTINCT brand` из `item` (непустые), вставить в `brand` с `uuid.uuid4()`, затем `UPDATE item SET brand_id = <id>` сопоставлением по имени.
4. `drop_column('item', 'brand')`.

- `downgrade`: вернуть колонку `brand`, заполнить из `brand_id`→`name`, удалить `brand_id`, удалить таблицу `brand`.

### 10. Тесты

- `backend/tests/utils/item.py` (строки 20, 27): вместо `brand=random_lower_string()` создать `Brand` (через `crud.create_brand`) и передавать `brand_id`.
- `backend/tests/api/routes/test_items.py` (строки 188, 201): заменить `"brand": "TestBrand"` на `brand_id` существующего бренда; проверять `content["brand_id"]` / `content["brand"]["name"]`.
- Новый `backend/tests/api/routes/test_brands.py` — зеркало `test_categories.py` (create/read/update/delete + дубликаты).

---

## Frontend

> После backend-изменений выполнить `bash scripts/generate-client.sh` — это сгенерирует `brandsReadBrands`, `brandsReadBrandsPublic`, `brandsCreateBrand`, `brandsUpdateBrand`, `brandsDeleteBrand`, типы `BrandPublic`/`BrandCreate`/`BrandUpdate`, и обновит `ItemCreate`/`ItemUpdate` (`brand` → `brand_id`) и `ItemPublic` (вложенный `brand`). Не редактировать `src/client/**` вручную.

### 1. Новый `frontend/src/components/Common/BrandCombobox.tsx`

На основе `SizeCombobox.tsx`, но:

- Источник данных — `brandsReadBrands` (queryKey `["brands"]`).
- Если введённый текст не совпадает с существующим брендом — показывать пункт **«Создать "<текст>"»**, который вызывает `brandsCreateBrand`, инвалидирует `["brands"]` и выбирает id нового бренда (`useMutation` + `useQueryClient`).

### 2. `frontend/src/components/Items/AddItem.tsx` и `EditItem.tsx`

- В zod-схеме: `brand: z.string().optional()` → `brand_id: z.string().optional()`.
- Заменить текстовый `<Input name="brand">` на `<BrandCombobox value={field.value} onChange={(id) => field.onChange(id ?? "")} />` (по образцу `SizeCombobox`, AddItem строки 198-213).
- Обновить `defaultValues` и формирование payload (`brand_id` вместо `brand`). В `EditItem` дефолт — `item.brand_id ?? undefined`.

### 3. `frontend/src/components/Items/columns.tsx` (строка 86)

Заменить текстовую ячейку `brand` на отображение `row.original.brand?.name` (имя приходит вложенным в `ItemPublic`), либо «—» если пусто.

### 4. Места отображения бренда (строка-имя → вложенный объект)

`CartItemRow.tsx` (50-52), `WishlistItemRow.tsx` (63-65), `ProductDetail.tsx` (57-59): заменить `item.brand` на `item.brand?.name`.

### 5. Новые компоненты админки `frontend/src/components/Brands/*`

Зеркало `frontend/src/components/Sizes/*`: `AddBrand.tsx`, `columns.tsx`, `EditBrand.tsx`, `DeleteBrand.tsx`, `BrandActionsMenu.tsx` (используют `brandsCreateBrand`/`brandsUpdateBrand`/`brandsDeleteBrand`, queryKey `["brands"]`).

### 6. `frontend/src/components/Admin/ItemsAdminPanel.tsx`

- Добавить третью вкладку `<TabsTrigger value="brands">Бренды</TabsTrigger>`.
- `TabsContent value="brands"`: `<AddBrand />` + `BrandsTable` (по образцу `SizesTable`, `brandsReadBrands`).
- Блок **«Товары по бренду»**: `Select`/`BrandCombobox` для выбора бренда → `DataTable` товаров, отфильтрованных по `brand_id` **на клиенте** из уже загруженного списка `itemsReadItems` (повторно используя `columns`). Бэкенд-фильтр для админ-эндпоинта не нужен.

### 7. Фильтр в каталоге `frontend/src/routes/_public/catalog.index.tsx`

- В `catalogSearchSchema` (строки 15-18) добавить `brand_id: z.string().uuid().optional().catch(undefined)`.
- В `getCatalogQueryOptions` (строки 33-39) добавить `...(search.brand_id ? { brand_id: search.brand_id } : {})`.
- В `CatalogFilters` добавить `FilterRow label="Бренд"` с чипсами из `brandsReadBrandsPublic` (по образцу категорий, строки 158-174; без счётчиков) и хендлер обновления `brand_id` в URL.

---

## Проверка (end-to-end)

1. **Backend up + миграция**: `docker compose up -d --wait backend`, затем внутри контейнера применить миграцию (`alembic upgrade head`) и убедиться, что сиды создали бренды и привязали товары.
2. **Тесты бэкенда**: `docker compose exec backend bash scripts/tests-start.sh -x` (или локально `bash scripts/test.sh`) — все тесты, включая новый `test_brands.py`, проходят.
3. **Линт бэкенда**: `cd backend && bash scripts/lint.sh` (mypy + ty + ruff).
4. **Регенерация клиента**: `bash scripts/generate-client.sh` — без ошибок, SDK содержит `brands*` функции и `brand_id`/вложенный `brand` в типах Item.
5. **Линт/сборка фронтенда**: `cd frontend && npm run lint && npm run build`.
6. **Ручная проверка в браузере** (`docker compose watch`, `dashboard.localhost:8081`):
   - Админка → «Товары» → создать товар: combobox бренда показывает существующие, позволяет создать новый, новый сразу выбирается.
   - Появилась вкладка «Бренды»: создание бренда, список, фильтр товаров по бренду.
   - Каталог (`catalog`): новый ряд фильтров «Бренд», выбор бренда фильтрует товары (URL-параметр `brand_id`), отображается имя бренда в карточке/детали/корзине/избранном.
