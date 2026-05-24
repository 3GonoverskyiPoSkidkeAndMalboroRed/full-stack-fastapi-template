# Бренды как сущность: управление и фильтрация

Дата: 2026-05-24

## Цель

Превратить бренд из свободного текстового поля у товара в полноценную сущность
(как `Category` и `Size`), чтобы:

1. при создании/редактировании товара выбирать бренд из существующих **или** создавать
   новый прямо в форме (combobox с созданием на лету);
2. в админке (раздел «Товары») появилась вкладка **«Бренды»** рядом с «Товары» и
   «Размеры» — список брендов с CRUD и drill-down к товарам бренда;
3. публичный каталог фильтровался по бренду чипами (как по категориям/размерам).

## Текущее состояние (что меняем)

- `Item.brand: str | None` — свободная строка (max 255). Используется в:
  - `backend/app/models/item.py` (`ItemBase`, `ItemUpdate`);
  - `backend/app/core/db.py` (seed `SEED_ITEMS`, `_seed_items`);
  - `backend/app/utils_files.py:36` — `slugify(item.brand or "")` формирует имя папки фото;
  - `backend/tests/api/routes/test_items.py`, `backend/tests/utils/item.py`;
  - фронт: `Items/AddItem`, `Items/EditItem`, `Items/columns`, `Catalog/ProductDetail`,
    `Cart/CartItemRow`, `Wishlist/WishlistItemRow`.
- `Category`/`Size` — эталонный паттерн: 5-классовая модель, функции в `crud.py`,
  роутер с `/public` и `/counts/public`, компоненты `Add/Edit/Delete/ActionsMenu` + `columns`.

## Архитектурное решение

Бренд — отдельная таблица `brand` с `brand_id` FK на `item` (`ondelete=SET NULL`),
строго по образцу `Size`. Существующие строковые значения мигрируются в записи `Brand`.

## Backend

### Модель `backend/app/models/brand.py` (зеркало `size.py`)

```python
class BrandBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)

class BrandCreate(BrandBase): pass

class BrandUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)

class Brand(BrandBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    items: list["Item"] = Relationship(back_populates="brand")

class BrandPublic(BrandBase):
    id: uuid.UUID

class BrandsPublic(SQLModel):
    data: list[BrandPublic]
    count: int

class BrandCount(SQLModel):
    brand_id: uuid.UUID
    count: int

class BrandCountsPublic(SQLModel):
    data: list[BrandCount]
```

Реэкспорт всех классов из `models/__init__.py` (+ в `__all__`).

### `crud.py` (зеркало size-функций)

`create_brand`, `get_brand_by_name`, `update_brand`.

### Роутер `backend/app/api/routes/brands.py` (зеркало `sizes.py`)

- `GET /brands/public` → `BrandsPublic` (без auth)
- `GET /brands/counts/public?category_id=` → `BrandCountsPublic` (без auth);
  считает товары по бренду, опционально фильтруя по категории (как size counts)
- `GET /brands/` (auth) → `BrandsPublic`
- `GET /brands/{id}` (auth) → `BrandPublic`
- `POST /brands/` (auth) → `BrandPublic`; 400 при дублировании имени
- `PUT /brands/{id}` (auth) → `BrandPublic`; 400 при дублировании имени
- `DELETE /brands/{id}` (auth) → `Message`

Регистрация в `app/api/main.py`: `api_router.include_router(brands.router)`.

### `item.py`

- В `ItemBase` и `ItemUpdate`: убрать `brand: str`, добавить
  `brand_id: uuid.UUID | None = Field(default=None, foreign_key="brand.id", ondelete="SET NULL")`.
- В `Item` (table): `brand: Optional["Brand"] = Relationship(back_populates="items")`;
  добавить `Brand` в блок `if TYPE_CHECKING`.
- `ItemPublic` наследует `brand_id` из `ItemBase` (имя резолвится на фронте).

### `routes/items.py`

- `read_items_public`: добавить параметр `brand_id: uuid.UUID | None = None` и фильтр
  в `count_statement`/`statement`.
- `create_item`/`update_item`: добавить проверку существования `brand_id`
  (404 «Brand not found»), по образцу `category_id`/`size_id`.

### `utils_files.py`

Строка 36: `slugify(item.brand or "")` → `slugify(item.brand.name if item.brand else "")`.

### Миграция Alembic

Сгенерировать `alembic revision --autogenerate`, затем вручную упорядочить:

1. `create_table("brand", ...)` с `name` unique + index.
2. `add_column("item", brand_id uuid nullable, FK brand.id ondelete SET NULL)`.
3. **Data-migration**: для каждого distinct непустого `item.brand` вставить `Brand`,
   затем `UPDATE item SET brand_id = (SELECT id FROM brand WHERE brand.name = item.brand)`.
4. `drop_column("item", "brand")`.

`downgrade` выполняет обратное (вернуть строковую колонку, перенести имена, удалить таблицу).

### `db.py`

- Добавить `SEED_BRANDS` (Nike, Adidas, Samsonite, Sony, Converse, The North Face) и
  `_seed_brands(session)` (идемпотентно, по образцу `_seed_sizes`); вызвать в `init_db`
  перед `_seed_items`.
- В `_seed_items`: резолвить `brand_id = get_brand_by_name(...)` вместо строки `brand`.

### Тесты

- `tests/utils/item.py`: создавать `Brand` и передавать `brand_id` вместо строки.
- `tests/api/routes/test_items.py`: заменить `"brand": "TestBrand"` на `brand_id`
  существующего бренда; проверять `content["brand_id"]`.

## Frontend

### Регенерация SDK

`bash scripts/generate-client.sh` → новые `brandsReadBrands`, `brandsReadBrandsPublic`,
`brandsCreateBrand`, `brandsReadBrandCountsPublic`, `brandsUpdateBrand`, `brandsDeleteBrand`,
типы `BrandPublic`, `BrandCreate`, `BrandUpdate`, `BrandsPublic`, `BrandCount`.
`ItemPublic`/`ItemCreate`/`ItemUpdate` теряют `brand`, получают `brand_id`.

### Компоненты бренда `components/Brands/` (зеркало `Sizes/`)

`AddBrand.tsx`, `EditBrand.tsx`, `DeleteBrand.tsx`, `BrandActionsMenu.tsx`,
`columns.tsx` (`brandColumns`: название, счётчик товаров, действия).

### `Common/BrandCombobox.tsx`

Как `SizeCombobox`, но: при пустом результате поиска показывает кнопку
«Создать «{search}»» → `brandsCreateBrand({ body: { name } })`,
`invalidateQueries(["brands"])`, выбор созданного `brand_id`. Возвращает `brand_id`.

### `Common/useBrandsMap.ts`

Хук: `brandsReadBrandsPublic` → `Map<id, name>`. Используется во всех местах
отображения, чтобы резолвить `brand_id` → имя:
`Items/columns` (BrandCell), `Catalog/ProductDetail`, `Cart/CartItemRow`,
`Wishlist/WishlistItemRow`.

### `AddItem` / `EditItem`

- zod: `brand: z.string().optional()` → `brand_id: z.string().optional()`.
- Поле бренда: `<Input>` → `<BrandCombobox value={field.value} onChange=...>`.
- Маппинг payload: `brand_id` вместо `brand`. В `EditItem` defaultValue из `item.brand_id`.

### Вкладка «Бренды» в `ItemsAdminPanel`

Третья вкладка `<TabsTrigger value="brands">Бренды</TabsTrigger>`:
- кнопка `<AddBrand />` + таблица `brandColumns`;
- drill-down: локальный state `selectedBrand`; при выборе бренда — заголовок
  «← Назад к брендам» + таблица товаров, отфильтрованных из уже загруженного
  `["items"]` по `brand_id` на клиенте (новый бэкенд-параметр не нужен).

### Фильтр каталога `routes/_public/catalog.index.tsx`

- `catalogSearchSchema`: добавить `brand_id: z.string().uuid().optional().catch(undefined)`.
- `getCatalogQueryOptions`: пробрасывать `brand_id` в `itemsReadItemsPublic`.
- Запросы: `brandsReadBrandsPublic` + `brandsReadBrandCountsPublic` (фильтр по `category_id`).
- Новый `FilterRow label="Бренд"` с чипами «Все» + бренды со счётчиками; `handleBrandChange`.

## Решения по объёму (YAGNI)

- Счётчики брендов фильтруются только по `category_id` (как size counts), не по размеру —
  сохраняет паттерн, минимизирует объём.
- Drill-down в админке — клиентская фильтрация уже загруженного списка товаров,
  без расширения авторизованного `GET /items/` фильтрами.
- Имя бренда резолвится на фронте через `useBrandsMap` (как `size_id`), `ItemPublic`
  не получает вычисляемого `brand_name`.

## Критерии готовности

- `bash scripts/lint.sh` (mypy + ty + ruff) и backend-тесты зелёные.
- `npm run lint` и `npm run build` зелёные; SDK перегенерирован.
- Миграция применяется и откатывается; существующие бренды перенесены в `Brand`.
- В админке: создание бренда в форме товара и во вкладке «Бренды», drill-down к товарам.
- В каталоге: фильтр по бренду чипами со счётчиками.
