# Бренды как сущность: управление и фильтрация — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить строковое поле `brand` товара в полноценную сущность `Brand` (FK), добавить управление брендами в админке (вкладка «Бренды» с drill-down к товарам) и фильтр каталога по бренду.

**Architecture:** Backend — новая таблица `brand` по образцу `size`/`category`, `item.brand_id` FK (`ondelete=SET NULL`), Alembic-миграция с переносом существующих строковых брендов. Frontend — перегенерированный SDK, компоненты `Brands/*` (зеркало `Sizes/*`), `BrandCombobox` с созданием на лету, `useBrandsMap` для резолва имени, чипы фильтра в каталоге.

**Tech Stack:** FastAPI, SQLModel, Alembic, PostgreSQL, pytest; React 19, TanStack Query/Router, shadcn/ui, zod, @hey-api/openapi-ts.

**Спецификация:** `docs/superpowers/specs/2026-05-24-brand-entity-filtering-design.md`

**Важно про окружение:**
- Backend-команды выполняются внутри контейнера: `docker compose exec backend <cmd>` (или из `backend/` если запущен локально). Тесты: `bash scripts/tests-start.sh -x` либо `docker compose exec backend uv run pytest <path>`.
- Тесты делят живую БД (нет per-test rollback); `conftest` чистит таблицы на teardown сессии.
- После изменения backend-роутов/моделей перегенерировать SDK: `bash scripts/generate-client.sh`.

---

## Phase A — Backend: сущность Brand

### Task 1: Модель Brand

**Files:**
- Create: `backend/app/models/brand.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Создать модель** `backend/app/models/brand.py`

```python
import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.item import Item


class BrandBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)


class BrandCreate(BrandBase):
    pass


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

- [ ] **Step 2: Реэкспортировать в** `backend/app/models/__init__.py`

Добавить импорт после блока `category` (строки ~11-17):

```python
from app.models.brand import (
    Brand,
    BrandCount,
    BrandCountsPublic,
    BrandCreate,
    BrandPublic,
    BrandsPublic,
    BrandUpdate,
)
```

Добавить в `__all__` (по алфавиту, рядом с Cart/Category):

```python
    "Brand",
    "BrandCount",
    "BrandCountsPublic",
    "BrandCreate",
    "BrandPublic",
    "BrandUpdate",
    "BrandsPublic",
```

- [ ] **Step 3: Проверить импорт**

Run: `docker compose exec backend uv run python -c "from app.models import Brand, BrandCreate, BrandCountsPublic; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/brand.py backend/app/models/__init__.py
git commit -m "feat(backend): add Brand model"
```

---

### Task 2: CRUD-функции бренда

**Files:**
- Modify: `backend/app/crud.py`

- [ ] **Step 1: Добавить импорты Brand** в блок `from app.models import (...)` (рядом с Category):

```python
    Brand,
    BrandCreate,
    BrandUpdate,
```

- [ ] **Step 2: Добавить функции** после `update_size` (после строки ~172):

```python
def create_brand(*, session: Session, brand_in: BrandCreate) -> Brand:
    db_obj = Brand.model_validate(brand_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_brand_by_name(*, session: Session, name: str) -> Brand | None:
    statement = select(Brand).where(Brand.name == name)
    return session.exec(statement).first()


def update_brand(*, session: Session, db_brand: Brand, brand_in: BrandUpdate) -> Brand:
    brand_data = brand_in.model_dump(exclude_unset=True)
    db_brand.sqlmodel_update(brand_data)
    session.add(db_brand)
    session.commit()
    session.refresh(db_brand)
    return db_brand
```

- [ ] **Step 3: Проверить импорт**

Run: `docker compose exec backend uv run python -c "from app.crud import create_brand, get_brand_by_name, update_brand; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/app/crud.py
git commit -m "feat(backend): add brand crud functions"
```

---

### Task 3: Роутер брендов + регистрация

**Files:**
- Create: `backend/app/api/routes/brands.py`
- Modify: `backend/app/api/main.py`

- [ ] **Step 1: Создать роутер** `backend/app/api/routes/brands.py`

```python
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Brand,
    BrandCount,
    BrandCountsPublic,
    BrandCreate,
    BrandPublic,
    BrandsPublic,
    BrandUpdate,
    Item,
    Message,
)

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("/public", response_model=BrandsPublic)
def read_brands_public(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Public brands listing — no authentication required.
    """
    count_statement = select(func.count()).select_from(Brand)
    count = session.exec(count_statement).one()
    statement = select(Brand).offset(skip).limit(limit)
    brands = session.exec(statement).all()
    brands_public = [BrandPublic.model_validate(b) for b in brands]
    return BrandsPublic(data=brands_public, count=count)


@router.get("/counts/public", response_model=BrandCountsPublic)
def read_brand_counts_public(
    session: SessionDep,
    category_id: uuid.UUID | None = None,
) -> Any:
    """
    Public brand counts: number of items per brand, optionally filtered by category.
    """
    statement = (
        select(Item.brand_id, func.count(col(Item.id)))
        .where(col(Item.brand_id).is_not(None))
        .group_by(col(Item.brand_id))
    )
    if category_id is not None:
        statement = statement.where(Item.category_id == category_id)
    rows = session.exec(statement).all()
    data = [
        BrandCount(brand_id=brand_id, count=count)
        for brand_id, count in rows
        if brand_id is not None
    ]
    return BrandCountsPublic(data=data)


@router.get(
    "/",
    response_model=BrandsPublic,
    dependencies=[Depends(get_current_user)],
)
def read_brands(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve brands.
    """
    count_statement = select(func.count()).select_from(Brand)
    count = session.exec(count_statement).one()
    statement = select(Brand).offset(skip).limit(limit)
    brands = session.exec(statement).all()
    brands_public = [BrandPublic.model_validate(b) for b in brands]
    return BrandsPublic(data=brands_public, count=count)


@router.get(
    "/{id}",
    response_model=BrandPublic,
    dependencies=[Depends(get_current_user)],
)
def read_brand(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get brand by ID.
    """
    brand = session.get(Brand, id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.post(
    "/",
    response_model=BrandPublic,
    dependencies=[Depends(get_current_user)],
)
def create_brand(
    *,
    session: SessionDep,
    brand_in: BrandCreate,
) -> Any:
    """
    Create new brand.
    """
    existing = crud.get_brand_by_name(session=session, name=brand_in.name)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A brand with this name already exists.",
        )
    brand = crud.create_brand(session=session, brand_in=brand_in)
    return brand


@router.put(
    "/{id}",
    response_model=BrandPublic,
    dependencies=[Depends(get_current_user)],
)
def update_brand(
    *,
    session: SessionDep,
    id: uuid.UUID,
    brand_in: BrandUpdate,
) -> Any:
    """
    Update a brand.
    """
    brand = session.get(Brand, id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if brand_in.name:
        existing = crud.get_brand_by_name(session=session, name=brand_in.name)
        if existing and existing.id != id:
            raise HTTPException(
                status_code=400,
                detail="A brand with this name already exists.",
            )
    brand = crud.update_brand(session=session, db_brand=brand, brand_in=brand_in)
    return brand


@router.delete(
    "/{id}",
    response_model=Message,
    dependencies=[Depends(get_current_user)],
)
def delete_brand(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Delete a brand.
    """
    brand = session.get(Brand, id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    session.delete(brand)
    session.commit()
    return Message(message="Brand deleted successfully")
```

> Примечание: `read_brand_counts_public` обращается к `Item.brand_id`, который добавляется в Task 5. Этот роутер коммитим вместе с Task 5 (см. Step 4), либо порядок Task 3↔5 можно поменять. Для линейного исполнения: выполнить Task 5 перед запуском backend-тестов Task 4.

- [ ] **Step 2: Зарегистрировать роутер** в `backend/app/api/main.py`

Добавить `brands` в импорт `from app.api.routes import (...)` (по алфавиту, перед `cart`):

```python
    brands,
```

Добавить после `api_router.include_router(items.router)`:

```python
api_router.include_router(brands.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/routes/brands.py backend/app/api/main.py
git commit -m "feat(backend): add brands router"
```

---

## Phase B — Backend: интеграция с Item

### Task 5: Item.brand_id вместо строки

> Выполнять перед Task 4 (тесты роутера зависят от `brand_id`).

**Files:**
- Modify: `backend/app/models/item.py`

- [ ] **Step 1: Добавить Brand в TYPE_CHECKING** (`item.py`, блок ~12-18):

```python
    from app.models.brand import Brand
```

- [ ] **Step 2: В `ItemBase`** заменить строку `brand` (строка 28):

Было:
```python
    brand: str | None = Field(default=None, max_length=255)
```
Стало:
```python
    brand_id: uuid.UUID | None = Field(
        default=None, foreign_key="brand.id", ondelete="SET NULL"
    )
```

- [ ] **Step 3: В `ItemUpdate`** заменить строку `brand` (строка 49):

Было:
```python
    brand: str | None = Field(default=None, max_length=255)
```
Стало:
```python
    brand_id: uuid.UUID | None = Field(
        default=None, foreign_key="brand.id", ondelete="SET NULL"
    )
```

- [ ] **Step 4: В `Item` (table)** добавить relationship рядом с `size` (после строки ~71):

```python
    brand: Optional["Brand"] = Relationship(back_populates="items")
```

- [ ] **Step 5: Проверить импорт**

Run: `docker compose exec backend uv run python -c "from app.models import Item; print('brand_id' in Item.model_fields)"`
Expected: `True`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/item.py
git commit -m "feat(backend): replace item.brand string with brand_id FK"
```

---

### Task 6: Валидация brand_id и фильтр публичного списка

**Files:**
- Modify: `backend/app/api/routes/items.py`

- [ ] **Step 1: Импорт Brand** в `from app.models import (...)` (рядом с Category):

```python
    Brand,
```

- [ ] **Step 2: Параметр и фильтр в `read_items_public`** (после `size_id`, строка ~33):

Добавить параметр в сигнатуру:
```python
    brand_id: uuid.UUID | None = None,
```
Добавить фильтр после блока `if size_id is not None:` (после строки ~48):
```python
    if brand_id is not None:
        count_statement = count_statement.where(Item.brand_id == brand_id)
        statement = statement.where(Item.brand_id == brand_id)
```

- [ ] **Step 3: Валидация в `create_item`** (после блока проверки `size_id`, после строки ~132):

```python
    if item_in.brand_id is not None:
        brand = session.get(Brand, item_in.brand_id)
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
```

- [ ] **Step 4: Валидация в `update_item`** (после блока проверки `size_id`, после строки ~164):

```python
    if "brand_id" in update_dict and update_dict["brand_id"] is not None:
        brand = session.get(Brand, update_dict["brand_id"])
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/items.py
git commit -m "feat(backend): validate brand_id and filter items by brand"
```

---

### Task 7: Имя бренда в slug папки фото

**Files:**
- Modify: `backend/app/utils_files.py:36`

- [ ] **Step 1: Заменить строку 36**

Было:
```python
    brand_slug = slugify(item.brand or "")
```
Стало:
```python
    brand_slug = slugify(item.brand.name if item.brand else "")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/utils_files.py
git commit -m "fix(backend): build photo slug from brand.name"
```

---

### Task 8: Миграция Alembic

**Files:**
- Create: `backend/app/alembic/versions/<rev>_brand_entity.py`

- [ ] **Step 1: Сгенерировать ревизию** (для корректного `down_revision`)

Run: `docker compose exec backend uv run alembic revision -m "brand entity"`
Это создаст файл с заполненными `revision`/`down_revision`. Запомнить путь.

- [ ] **Step 2: Заменить тело `upgrade`/`downgrade`** в созданном файле (сохранить сгенерированные `revision`, `down_revision`):

```python
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


def upgrade():
    op.create_table(
        "brand",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_brand_name"), "brand", ["name"], unique=True)

    op.add_column("item", sa.Column("brand_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_item_brand_id_brand",
        "item",
        "brand",
        ["brand_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Data migration: distinct non-empty item.brand strings -> brand rows + link.
    op.execute(
        """
        INSERT INTO brand (id, name)
        SELECT gen_random_uuid(), brand
        FROM (
            SELECT DISTINCT brand FROM item
            WHERE brand IS NOT NULL AND brand <> ''
        ) AS distinct_brands
        """
    )
    op.execute(
        """
        UPDATE item
        SET brand_id = brand.id
        FROM brand
        WHERE item.brand = brand.name
        """
    )

    op.drop_column("item", "brand")


def downgrade():
    op.add_column(
        "item",
        sa.Column(
            "brand",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE item
        SET brand = brand.name
        FROM brand
        WHERE item.brand_id = brand.id
        """
    )
    op.drop_constraint("fk_item_brand_id_brand", "item", type_="foreignkey")
    op.drop_column("item", "brand_id")
    op.drop_index(op.f("ix_brand_name"), table_name="brand")
    op.drop_table("brand")
```

> `gen_random_uuid()` доступна в PostgreSQL (расширение pgcrypto/встроенно в PG13+). Если недоступна — заменить на `uuid_generate_v4()` либо включить `CREATE EXTENSION IF NOT EXISTS pgcrypto;` первой строкой data-migration.

- [ ] **Step 3: Применить миграцию**

Run: `docker compose exec backend uv run alembic upgrade head`
Expected: без ошибок; затем проверить:
Run: `docker compose exec backend uv run python -c "from sqlmodel import Session, select, func; from app.core.db import engine; from app.models import Brand; s=Session(engine); print(s.exec(select(func.count()).select_from(Brand)).one())"`
Expected: число > 0 (бренды из существующих товаров; в свежей БД может быть 0 до сидов).

- [ ] **Step 4: Проверить откат и повторное применение**

Run: `docker compose exec backend uv run alembic downgrade -1 && docker compose exec backend uv run alembic upgrade head`
Expected: обе команды без ошибок.

- [ ] **Step 5: Commit**

```bash
git add backend/app/alembic/versions/
git commit -m "feat(backend): migrate brand string to brand table"
```

---

### Task 9: Сиды брендов

**Files:**
- Modify: `backend/app/core/db.py`

- [ ] **Step 1: Импорт Brand** в `from app.models import (...)`:

```python
    Brand,
    BrandCreate,
```

- [ ] **Step 2: Константа SEED_BRANDS** после `SEED_SIZES` (после строки ~79):

```python
SEED_BRANDS = [
    "Nike",
    "Adidas",
    "Samsonite",
    "Sony",
    "Converse",
    "The North Face",
]
```

- [ ] **Step 3: Функция `_seed_brands`** (рядом с `_seed_sizes`):

```python
def _seed_brands(session: Session) -> None:
    added = False
    for name in SEED_BRANDS:
        existing = session.exec(select(Brand).where(Brand.name == name)).first()
        if existing is None:
            session.add(Brand(name=name))
            added = True
    if added:
        session.commit()
```

- [ ] **Step 4: Вызвать в `init_db`** между `_seed_sizes` и `_seed_items` (строка ~47):

```python
    _seed_categories(session)
    _seed_sizes(session)
    _seed_brands(session)
    _seed_items(session, user.id)
```

- [ ] **Step 5: В `_seed_items`** резолвить brand_id (заменить `brand=str(...)` на lookup):

В цикле `for item_data in SEED_ITEMS:` после строки с `size = crud.get_size_by_name(...)` добавить:
```python
        brand = crud.get_brand_by_name(session=session, name=str(item_data["brand"]))
```
В `ItemCreate(...)` заменить:
```python
            brand=str(item_data["brand"]),
```
на:
```python
            brand_id=(brand.id if brand else None),
```

- [ ] **Step 6: Проверить сиды**

Run: `docker compose exec backend uv run python -c "from sqlmodel import Session; from app.core.db import engine, init_db; init_db(Session(engine)); print('seeded')"`
Expected: `seeded` без ошибок.

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/db.py
git commit -m "feat(backend): seed brands and link seed items"
```

---

### Task 10: Обновить backend-тесты под brand_id

**Files:**
- Create: `backend/tests/utils/brand.py`
- Modify: `backend/tests/utils/item.py`
- Modify: `backend/tests/api/routes/test_items.py:179-203`
- Create: `backend/tests/api/routes/test_brands.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Утилита создания бренда** `backend/tests/utils/brand.py`

```python
from sqlmodel import Session

from app import crud
from app.models import Brand, BrandCreate
from tests.utils.utils import random_lower_string


def create_random_brand(db: Session) -> Brand:
    name = random_lower_string()
    brand_in = BrandCreate(name=name)
    return crud.create_brand(session=db, brand_in=brand_in)
```

- [ ] **Step 2: Обновить** `backend/tests/utils/item.py`

Заменить импорты и тело `create_random_item`:
```python
from decimal import Decimal

from sqlmodel import Session

from app import crud
from app.models import Item, ItemCreate
from tests.utils.brand import create_random_brand
from tests.utils.category import create_random_category
from tests.utils.size import create_random_size
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def create_random_item(db: Session) -> Item:
    user = create_random_user(db)
    owner_id = user.id
    assert owner_id is not None
    title = random_lower_string()
    description = random_lower_string()
    size = create_random_size(db)
    brand = create_random_brand(db)
    cost = Decimal("19.99")
    category = create_random_category(db)
    item_in = ItemCreate(
        title=title,
        description=description,
        size_id=size.id,
        brand_id=brand.id,
        cost=cost,
        category_id=category.id,
    )
    return crud.create_item(session=db, item_in=item_in, owner_id=owner_id)
```

- [ ] **Step 3: Обновить** `test_create_item_with_new_fields` в `test_items.py:179-203`

Добавить импорт сверху файла (рядом с `create_random_size`):
```python
from tests.utils.brand import create_random_brand
```
Заменить тело теста:
```python
def test_create_item_with_new_fields(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    category = create_random_category(db)
    size = create_random_size(db)
    brand = create_random_brand(db)
    data = {
        "title": "Foo",
        "description": "Fighters",
        "size_id": str(size.id),
        "brand_id": str(brand.id),
        "cost": "19.99",
        "category_id": str(category.id),
    }
    response = client.post(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["size_id"] == data["size_id"]
    assert content["brand_id"] == data["brand_id"]
    assert content["cost"] == data["cost"]
    assert content["category_id"] == data["category_id"]
```

- [ ] **Step 4: Тесты роутера брендов** `backend/tests/api/routes/test_brands.py`

```python
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.brand import create_random_brand


def test_create_brand(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"name": "Nike"}
    response = client.post(
        f"{settings.API_V1_STR}/brands/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert "id" in content


def test_create_brand_duplicate_name(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    data = {"name": brand.name}
    response = client.post(
        f"{settings.API_V1_STR}/brands/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 400


def test_read_brands(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_brand(db)
    create_random_brand(db)
    response = client.get(
        f"{settings.API_V1_STR}/brands/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2


def test_read_brands_public(client: TestClient, db: Session) -> None:
    create_random_brand(db)
    response = client.get(f"{settings.API_V1_STR}/brands/public")
    assert response.status_code == 200
    assert "data" in response.json()


def test_read_brand(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    response = client.get(
        f"{settings.API_V1_STR}/brands/{brand.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == brand.name


def test_read_brand_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/brands/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404


def test_update_brand(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    data = {"name": "Updated Brand"}
    response = client.put(
        f"{settings.API_V1_STR}/brands/{brand.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    assert response.json()["name"] == data["name"]


def test_delete_brand(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    response = client.delete(
        f"{settings.API_V1_STR}/brands/{brand.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Brand deleted successfully"


def test_delete_brand_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/brands/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
```

- [ ] **Step 5: Очистка таблицы brand в teardown** `backend/tests/conftest.py`

Добавить `Brand` в импорт `from app.models import (...)`:
```python
    Brand,
```
В кортеже удаления (строки ~29-38) добавить `Brand` ПОСЛЕ `Item` (Item ссылается на Brand):
```python
        for model in (
            OrderItem,
            Order,
            CartItem,
            WishlistItem,
            Item,
            Brand,
            Size,
            Category,
            User,
        ):
```

- [ ] **Step 6: Запустить тесты брендов и товаров**

Run: `docker compose exec backend uv run pytest tests/api/routes/test_brands.py tests/api/routes/test_items.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/tests/
git commit -m "test(backend): cover brands router and brand_id items"
```

---

### Task 4: Полная проверка backend

**Files:** —

- [ ] **Step 1: Линт** (mypy + ty + ruff)

Run: `docker compose exec backend bash scripts/lint.sh`
Expected: без ошибок. Частые правки: импорты, типизация.

- [ ] **Step 2: Все backend-тесты**

Run: `bash scripts/tests-start.sh -x`
Expected: PASS.

- [ ] **Step 3: Commit (если линт что-то поправил)**

```bash
git add -A backend/
git commit -m "chore(backend): lint fixes for brand entity"
```

---

## Phase D — Frontend: SDK и компоненты

### Task 12: Перегенерировать клиент

**Files:**
- Modify (auto): `frontend/src/client/**`

- [ ] **Step 1: Поднять backend и сгенерировать SDK**

Run: `docker compose up -d --wait backend && bash scripts/generate-client.sh`
Expected: успешная генерация + ESLint/Prettier.

- [ ] **Step 2: Проверить новые экспорты**

Run: `cd frontend && grep -l "brandsReadBrandsPublic\|brandsCreateBrand" src/client/*.ts && grep -rl "BrandPublic" src/client/`
Expected: совпадения найдены. Также убедиться, что `ItemPublic` содержит `brand_id` (а не `brand`):
Run: `cd frontend && grep -n "brand" src/client/types.gen.ts | head`
Expected: `brand_id` присутствует, строкового `brand` у Item нет.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/client/
git commit -m "chore(frontend): regenerate SDK with brands"
```

---

### Task 13: Компоненты управления брендом

**Files:**
- Create: `frontend/src/components/Brands/AddBrand.tsx`
- Create: `frontend/src/components/Brands/EditBrand.tsx`
- Create: `frontend/src/components/Brands/DeleteBrand.tsx`
- Create: `frontend/src/components/Brands/BrandActionsMenu.tsx`
- Create: `frontend/src/components/Brands/columns.tsx`

- [ ] **Step 1: `AddBrand.tsx`** (зеркало `Sizes/AddSize.tsx`)

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type BrandCreate, brandsCreateBrand } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  name: z.string().min(1, { message: "Введите название" }),
})

type FormData = z.infer<typeof formSchema>

const AddBrand = () => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: { name: "" },
  })

  const mutation = useMutation({
    mutationFn: (data: BrandCreate) => brandsCreateBrand({ body: data }),
    onSuccess: () => {
      showSuccessToast("Бренд создан")
      form.reset()
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] })
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2" />
          Добавить бренд
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить бренд</DialogTitle>
          <DialogDescription>
            Добавьте новый бренд (например Nike, Adidas).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Название <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Название бренда"
                        type="text"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Отмена
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Сохранить
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default AddBrand
```

- [ ] **Step 2: `EditBrand.tsx`** (зеркало `Sizes/EditSize.tsx`)

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type BrandPublic, type BrandUpdate, brandsUpdateBrand } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  name: z.string().min(1, { message: "Введите название" }),
})

type FormData = z.infer<typeof formSchema>

interface EditBrandProps {
  brand: BrandPublic
  onSuccess: () => void
}

const EditBrand = ({ brand, onSuccess }: EditBrandProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: { name: brand.name },
  })

  const mutation = useMutation({
    mutationFn: (data: BrandUpdate) =>
      brandsUpdateBrand({ path: { id: brand.id }, body: data }),
    onSuccess: () => {
      showSuccessToast("Бренд обновлён")
      setIsOpen(false)
      onSuccess()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] })
      queryClient.invalidateQueries({ queryKey: ["items"] })
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault()
          setIsOpen(true)
        }}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Редактировать
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать бренд</DialogTitle>
          <DialogDescription>Измените название бренда.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Название <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Название бренда"
                        type="text"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Отмена
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Сохранить
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditBrand
```

- [ ] **Step 3: `DeleteBrand.tsx`** (зеркало `Sizes/DeleteSize.tsx`)

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { brandsDeleteBrand } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface DeleteBrandProps {
  id: string
  onSuccess: () => void
}

const DeleteBrand = ({ id, onSuccess }: DeleteBrandProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { handleSubmit } = useForm()

  const deleteBrand = async (id: string) => {
    await brandsDeleteBrand({ path: { id } })
  }

  const mutation = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      showSuccessToast("Бренд удалён")
      setIsOpen(false)
      onSuccess()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] })
      queryClient.invalidateQueries({ queryKey: ["items"] })
    },
  })

  const onSubmit = async () => {
    mutation.mutate(id)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem
        variant="destructive"
        onSelect={(e) => e.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <Trash2 />
        Удалить
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Удалить бренд</DialogTitle>
            <DialogDescription>
              Этот бренд будет безвозвратно удалён. Товары с этим брендом
              сохранят данные, но потеряют ссылку на бренд. Вы уверены?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={mutation.isPending}>
                Отмена
              </Button>
            </DialogClose>
            <LoadingButton
              variant="destructive"
              type="submit"
              loading={mutation.isPending}
            >
              Удалить
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteBrand
```

- [ ] **Step 4: `BrandActionsMenu.tsx`** (зеркало `Sizes/SizeActionsMenu.tsx`)

```tsx
import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { BrandPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteBrand from "./DeleteBrand"
import EditBrand from "./EditBrand"

interface BrandActionsMenuProps {
  brand: BrandPublic
}

export const BrandActionsMenu = ({ brand }: BrandActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditBrand brand={brand} onSuccess={() => setOpen(false)} />
        <DeleteBrand id={brand.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 5: `columns.tsx`** (бренд + счётчик товаров + действия)

```tsx
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronRight } from "lucide-react"

import type { BrandPublic } from "@/client"
import { BrandActionsMenu } from "./BrandActionsMenu"

export interface BrandRow extends BrandPublic {
  itemCount: number
  onSelect: () => void
}

export const brandColumns: ColumnDef<BrandRow>[] = [
  {
    accessorKey: "name",
    header: "Название",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={row.original.onSelect}
        className="hover:text-primary inline-flex items-center gap-1 font-medium"
      >
        {row.original.name}
        <ChevronRight className="h-4 w-4 opacity-50" />
      </button>
    ),
  },
  {
    accessorKey: "itemCount",
    header: "Товаров",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.itemCount}</span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Действия</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <BrandActionsMenu brand={row.original} />
      </div>
    ),
  },
]
```

- [ ] **Step 6: Проверить компиляцию**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "components/Brands" || echo "no Brand type errors"`
Expected: `no Brand type errors`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Brands/
git commit -m "feat(frontend): add brand management components"
```

---

### Task 14: BrandCombobox и useBrandsMap

**Files:**
- Create: `frontend/src/components/Common/BrandCombobox.tsx`
- Create: `frontend/src/hooks/useBrandsMap.ts`

- [ ] **Step 1: `useBrandsMap.ts`** — резолв `brand_id` → имя

```ts
import { useQuery } from "@tanstack/react-query"

import { brandsReadBrandsPublic } from "@/client"

export function useBrandsMap() {
  const { data } = useQuery({
    queryKey: ["brands", "public"],
    queryFn: () => brandsReadBrandsPublic(),
    select: (res) => res.data?.data ?? [],
  })

  const map = new Map<string, string>()
  for (const b of data ?? []) {
    map.set(b.id, b.name)
  }
  return map
}
```

- [ ] **Step 2: `BrandCombobox.tsx`** — выбор существующего или создание на лету

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { brandsCreateBrand, brandsReadBrands } from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

interface BrandComboboxProps {
  value?: string | null
  onChange: (id: string | undefined) => void
  placeholder?: string
}

export function BrandCombobox({
  value,
  onChange,
  placeholder = "Выбрать бренд",
}: BrandComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: () => brandsReadBrands(),
    select: (res) => res.data?.data ?? [],
  })

  const selected = brands.find((b) => b.id === value)

  const filtered = useMemo(() => {
    if (!search) return brands
    const q = search.toLowerCase()
    return brands.filter((b) => b.name.toLowerCase().includes(q))
  }, [brands, search])

  const exactMatch = useMemo(
    () =>
      brands.some((b) => b.name.toLowerCase() === search.trim().toLowerCase()),
    [brands, search],
  )

  const createMutation = useMutation({
    mutationFn: (name: string) => brandsCreateBrand({ body: { name } }),
    onSuccess: async (res) => {
      showSuccessToast("Бренд создан")
      await queryClient.invalidateQueries({ queryKey: ["brands"] })
      const newId = res.data?.id
      if (newId) onChange(newId)
      setOpen(false)
      setSearch("")
    },
    onError: handleError.bind(showErrorToast),
  })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const trimmed = search.trim()

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={cn(!selected && "text-muted-foreground")}>
          {selected?.name ?? placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 w-full rounded-md border shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              placeholder="Поиск бренда…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => {
                  onChange(b.id === value ? undefined : b.id)
                  setOpen(false)
                  setSearch("")
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === b.id ? "opacity-100" : "opacity-0",
                  )}
                />
                {b.name}
              </button>
            ))}
            {trimmed.length > 0 && !exactMatch && (
              <button
                type="button"
                disabled={createMutation.isPending}
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => createMutation.mutate(trimmed)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Создать «{trimmed}»
              </button>
            )}
            {filtered.length === 0 && trimmed.length === 0 && (
              <div className="text-muted-foreground py-6 text-center text-sm">
                Начните вводить название.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Проверить компиляцию**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "BrandCombobox|useBrandsMap" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Common/BrandCombobox.tsx frontend/src/hooks/useBrandsMap.ts
git commit -m "feat(frontend): add BrandCombobox and useBrandsMap"
```

---

## Phase E — Frontend: интеграция

### Task 15: Поле бренда в формах товара

**Files:**
- Modify: `frontend/src/components/Items/AddItem.tsx`
- Modify: `frontend/src/components/Items/EditItem.tsx`

- [ ] **Step 1: `AddItem.tsx`** — импорт BrandCombobox

Добавить в импорты рядом с `SizeCombobox`:
```tsx
import { BrandCombobox } from "@/components/Common/BrandCombobox"
```

- [ ] **Step 2: `AddItem.tsx`** — zod и defaultValues

В `formSchema` заменить `brand: z.string().optional(),` на `brand_id: z.string().optional(),`.
В `defaultValues` заменить `brand: "",` на `brand_id: "",`.

- [ ] **Step 3: `AddItem.tsx`** — поле формы (заменить FormField name="brand", строки ~215-227)

```tsx
                <FormField
                  control={form.control}
                  name="brand_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Бренд</FormLabel>
                      <FormControl>
                        <BrandCombobox
                          value={field.value}
                          onChange={(id) => field.onChange(id ?? "")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
```

> `onSubmit` строит `payload` спредом `...data`, поэтому `brand_id` попадёт автоматически. Пустая строка `""` для опционального FK: бэкенд провалидирует — если поле опционально и пустая строка недопустима, заменить маппинг на `brand_id: data.brand_id || undefined`. Добавить это в `onSubmit` для надёжности:
> ```tsx
>     const payload: ItemCreate = {
>       ...data,
>       brand_id: data.brand_id || undefined,
>       stock: data.stock ? Number.parseInt(data.stock, 10) : 0,
>     }
> ```

- [ ] **Step 4: `EditItem.tsx`** — те же правки

Импорт `BrandCombobox`; в `formSchema` `brand` → `brand_id`; в `defaultValues` заменить `brand: item.brand ?? undefined,` на `brand_id: item.brand_id ?? undefined,`; заменить FormField name="brand" (строки ~191-203) на блок с `BrandCombobox` (как в Step 3, но name="brand_id"); в `onSubmit` добавить `brand_id: data.brand_id || undefined,` в payload.

- [ ] **Step 5: Проверить компиляцию**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "AddItem|EditItem" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Items/AddItem.tsx frontend/src/components/Items/EditItem.tsx
git commit -m "feat(frontend): use BrandCombobox in item forms"
```

---

### Task 16: Отображение имени бренда

**Files:**
- Modify: `frontend/src/components/Items/columns.tsx:86-88`
- Modify: `frontend/src/components/Catalog/ProductDetail.tsx:57-61`
- Modify: `frontend/src/components/Cart/CartItemRow.tsx:50-54`
- Modify: `frontend/src/components/Wishlist/WishlistItemRow.tsx` (блок brand)

- [ ] **Step 1: `Items/columns.tsx`** — BrandCell

Добавить импорт:
```tsx
import { useBrandsMap } from "@/hooks/useBrandsMap"
```
Добавить компонент рядом с `SizeCell`:
```tsx
function BrandCell({ id }: { id: string | null | undefined }) {
  const brands = useBrandsMap()
  if (!id) return <span className="text-muted-foreground italic">—</span>
  return <span>{brands.get(id) ?? id}</span>
}
```
Заменить колонку brand (строки ~85-88):
```tsx
  {
    accessorKey: "brand_id",
    header: "Бренд",
    cell: ({ row }) => <BrandCell id={row.original.brand_id} />,
  },
```

- [ ] **Step 2: `ProductDetail.tsx`** — резолв brand_id

Добавить импорт `useBrandsMap` и в начале компонента:
```tsx
  const brands = useBrandsMap()
  const brandName = item.brand_id ? brands.get(item.brand_id) : undefined
```
Заменить блок (строки ~57-61):
```tsx
          {brandName && (
            <span className="mono text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
              {brandName}
            </span>
          )}
```

- [ ] **Step 3: `CartItemRow.tsx`** — резолв brand_id

Добавить импорт `useBrandsMap`; в компоненте:
```tsx
  const brands = useBrandsMap()
  const brandName = item?.brand_id ? brands.get(item.brand_id) : undefined
```
Заменить блок (строки ~50-54):
```tsx
        {brandName && (
          <span className="text-muted-foreground text-xs uppercase">
            {brandName}
          </span>
        )}
```

- [ ] **Step 4: `WishlistItemRow.tsx`** — аналогично CartItemRow

Добавить импорт `useBrandsMap`; `const brands = useBrandsMap(); const brandName = item?.brand_id ? brands.get(item.brand_id) : undefined`; заменить `{item?.brand && (...)}` блок на `{brandName && (<span className="text-muted-foreground text-xs uppercase">{brandName}</span>)}`.

- [ ] **Step 5: Проверить компиляцию**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "columns|ProductDetail|CartItemRow|WishlistItemRow" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Items/columns.tsx frontend/src/components/Catalog/ProductDetail.tsx frontend/src/components/Cart/CartItemRow.tsx frontend/src/components/Wishlist/WishlistItemRow.tsx
git commit -m "feat(frontend): resolve brand name via useBrandsMap"
```

---

### Task 17: Вкладка «Бренды» в админке с drill-down

**Files:**
- Modify: `frontend/src/components/Admin/ItemsAdminPanel.tsx`

- [ ] **Step 1: Импорты** в `ItemsAdminPanel.tsx`

```tsx
import { useState } from "react"
import { ArrowLeft } from "lucide-react"

import { brandsReadBrands } from "@/client"
import AddBrand from "@/components/Brands/AddBrand"
import { brandColumns, type BrandRow } from "@/components/Brands/columns"
```

- [ ] **Step 2: Query options для брендов** (рядом с `getSizesQueryOptions`)

```tsx
function getBrandsQueryOptions() {
  return {
    queryFn: async () => {
      const { data } = await brandsReadBrands({ query: { skip: 0, limit: 100 } })
      return data!
    },
    queryKey: ["brands"],
  }
}
```

- [ ] **Step 3: Компонент вкладки брендов** (перед `ItemsAdminPanel`)

```tsx
function BrandsTabContent() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  )
  const { data: brands } = useSuspenseQuery(getBrandsQueryOptions())
  const { data: items } = useSuspenseQuery(getItemsQueryOptions())

  if (selected) {
    const brandItems = items.data.filter((i) => i.brand_id === selected.id)
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к брендам
        </button>
        <h3 className="text-lg font-semibold">Товары бренда «{selected.name}»</h3>
        {brandItems.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            У бренда пока нет товаров
          </p>
        ) : (
          <DataTable columns={columns} data={brandItems} />
        )}
      </div>
    )
  }

  if (brands.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-muted mb-4 rounded-full p-4">
          <Search className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">Нет брендов</h3>
        <p className="text-muted-foreground">Добавьте бренд</p>
      </div>
    )
  }

  const rows: BrandRow[] = brands.data.map((b) => ({
    ...b,
    itemCount: items.data.filter((i) => i.brand_id === b.id).length,
    onSelect: () => setSelected({ id: b.id, name: b.name }),
  }))

  return <DataTable columns={brandColumns} data={rows} />
}

function BrandsTable() {
  return (
    <Suspense fallback={<PendingItems />}>
      <BrandsTabContent />
    </Suspense>
  )
}
```

- [ ] **Step 4: Добавить вкладку** в JSX (внутри `<Tabs>`)

В `<TabsList>` после `sizes`:
```tsx
          <TabsTrigger value="brands">Бренды</TabsTrigger>
```
После `<TabsContent value="sizes">...`:
```tsx
        <TabsContent value="brands" className="space-y-4">
          <div className="flex justify-end">
            <AddBrand />
          </div>
          <BrandsTable />
        </TabsContent>
```

- [ ] **Step 5: Проверить компиляцию**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "ItemsAdminPanel" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Admin/ItemsAdminPanel.tsx
git commit -m "feat(frontend): add brands admin tab with drill-down"
```

---

### Task 18: Фильтр каталога по бренду

**Files:**
- Modify: `frontend/src/routes/_public/catalog.index.tsx`

- [ ] **Step 1: Импорты** — добавить SDK-функции

```tsx
  brandsReadBrandCountsPublic,
  brandsReadBrandsPublic,
```
(в существующий импорт из `@/client`)

- [ ] **Step 2: Расширить `catalogSearchSchema`**

```tsx
const catalogSearchSchema = z.object({
  category_id: z.string().uuid().optional().catch(undefined),
  size_id: z.string().uuid().optional().catch(undefined),
  brand_id: z.string().uuid().optional().catch(undefined),
})
```

- [ ] **Step 3: Проброс `brand_id` в запрос** (`getCatalogQueryOptions`)

В объекте `query` добавить:
```tsx
          ...(search.brand_id ? { brand_id: search.brand_id } : {}),
```

- [ ] **Step 4: Запросы брендов в `CatalogFilters`** (рядом с sizes-запросами)

```tsx
  const brandsQuery = useQuery({
    queryKey: ["brands", "public"],
    queryFn: async () => (await brandsReadBrandsPublic()).data!,
  })
  const brandCountsQuery = useQuery({
    queryKey: ["brands", "counts", search.category_id ?? null],
    queryFn: async () =>
      (
        await brandsReadBrandCountsPublic({
          query: search.category_id
            ? { category_id: search.category_id }
            : undefined,
        })
      ).data!,
  })

  const countsByBrand = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of brandCountsQuery.data?.data ?? []) {
      map.set(row.brand_id, row.count)
    }
    return map
  }, [brandCountsQuery.data])

  const handleBrandChange = (nextId: string | undefined) => {
    navigate({
      search: (prev: CatalogSearch) => ({ ...prev, brand_id: nextId }),
    })
  }
```

- [ ] **Step 5: Ряд чипов «Бренд»** в JSX `CatalogFilters` (после `FilterRow` размеров, перед закрывающим `</div>`)

```tsx
      {(brandsQuery.data?.data.length ?? 0) > 0 && (
        <FilterRow label="Бренд">
          <Chip
            active={!search.brand_id}
            onClick={() => handleBrandChange(undefined)}
          >
            Все
          </Chip>
          {brandsQuery.data?.data.map((b) => {
            const count = countsByBrand.get(b.id) ?? 0
            return (
              <Chip
                key={b.id}
                active={search.brand_id === b.id}
                onClick={() => handleBrandChange(b.id)}
              >
                {b.name}
                <span className="mono ml-1 text-[10px] opacity-60">
                  {count}
                </span>
              </Chip>
            )
          })}
        </FilterRow>
      )}
```

- [ ] **Step 6: Проверить компиляцию**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "catalog.index" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/_public/catalog.index.tsx
git commit -m "feat(frontend): add brand filter chips to catalog"
```

---

## Phase F — Frontend: проверка

### Task 19: Линт, сборка, ручная проверка

**Files:** —

- [ ] **Step 1: Линт**

Run: `cd frontend && npm run lint`
Expected: без ошибок.

- [ ] **Step 2: Сборка**

Run: `cd frontend && npm run build`
Expected: `tsc --build` + `vite build` без ошибок.

- [ ] **Step 3: Ручная проверка** (стек поднят: `docker compose watch`)

Открыть `dashboard.localhost:8081` → раздел «Товары»:
- Вкладка «Бренды»: создать бренд, увидеть его в списке со счётчиком 0.
- Создать/редактировать товар: в поле «Бренд» найти существующий и создать новый на лету.
- Клик по бренду во вкладке «Бренды» → drill-down к товарам бренда, «Назад к брендам».

Открыть каталог (`localhost:8081` публичная часть) → проверить ряд чипов «Бренд», фильтрацию и счётчики; комбинацию с фильтром по категории.

- [ ] **Step 4: Commit (если линт что-то поправил)**

```bash
git add -A frontend/
git commit -m "chore(frontend): lint fixes for brand feature"
```

---

## Self-review заметки

- **Порядок Task 3 ↔ Task 5:** роутер брендов (Task 3) обращается к `Item.brand_id`, который вводится в Task 5. При линейном исполнении выполнить Task 5 до запуска backend-тестов (Task 4/Task 10). Нумерация фаз отражает это: Phase B (Item) идёт после Phase A, но Task 4 (полная проверка) намеренно стоит после Task 10.
- **`gen_random_uuid()`** в миграции — при ошибке добавить `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.
- **Пустая строка `brand_id`** из combobox обнуляется в `onSubmit` (`data.brand_id || undefined`).
- **Счётчики брендов** фильтруются только по категории (как size counts) — сознательное упрощение из спецификации.
- **prek-хук** перегенерирует клиент при изменении `backend/**` — после backend-коммитов SDK может обновиться автоматически; Task 12 фиксирует это явно.
