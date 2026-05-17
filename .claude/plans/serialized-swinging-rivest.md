# План: несколько фото для Item с каруселью и lightbox

## Context

Сейчас у `Item` одно поле `image_url: str | None`, которое в seed-данных заполняется ссылками на picsum.photos. На фронте оно отображается одиночным `<img>` в `ProductCard`, `ProductDetail`, `CartItemRow`, `WishlistItemRow`. Этого недостаточно: товару нужны несколько фото с возможностью загрузки из админки `/admin?tab=items`, перелистывания на детальной странице каталога и просмотра в полноэкранном режиме с зумом.

Задача — поднять полноценное хранение, загрузку и отображение нескольких фото на товар, с физическим хранением файлов на сервере в директории `item-photo/<slug-brand-title-uuid>/`.

## Согласованные дизайн-решения

- **Хранение**: одно поле `Item.images: list[str]` (PostgreSQL JSONB, не пустой массив по дефолту). Без отдельной таблицы — для проекта это единственное отступление от реляционного стиля, но оправдано: фото — порядоченный массив строк, никаких метаданных к каждой записи не нужно. Порядок задаётся индексом в массиве.
- **Старое поле `image_url`**: удалить полностью из модели, схем, сидов, фронта (нет требования обратной совместимости).
- **Имя директории**: `item-photo/{slug(brand)}_{slug(title)}_{shortuuid8}/` — slugify даёт ASCII-safe имя, UUID-суффикс гарантирует уникальность даже при коллизии brand+title. UUID-суффикс хранится только в путях файлов в `images` — повторно использовать ту же директорию определяем через `os.path.dirname(item.images[0])`. При переименовании товара директория не трогается (ссылки в БД остаются валидными).
- **Карусель**: shadcn Carousel поверх `embla-carousel-react`. Lightbox через shadcn Dialog + `react-zoom-pan-pinch` для зума/драга/пинча.
- **Endpoint-стратегия**: JSON для CRUD (`POST /items/`, `PUT /items/{id}`), отдельные multipart endpoint-ы для фото — `POST /items/{id}/photos`, `DELETE /items/{id}/photos`. Двухэтапный flow в `AddItem`: сначала создаём пустой Item, потом грузим фото; в `EditItem` uploader всегда виден.
- **Миграция**: строго через `alembic revision --autogenerate`, затем ручная корректировка трёхступенчатого ALTER (см. ниже) — иначе NOT NULL без default упадёт на existing rows.

## Backend

### 1. Модель — `backend/app/models/item.py`

- Удалить `image_url` из `ItemBase` (строка 29) и из `ItemUpdate` (строка 48).
- Добавить в `ItemBase`:
  ```python
  from sqlalchemy.dialects.postgresql import JSONB
  from sqlalchemy import Column

  images: list[str] = Field(
      default_factory=list,
      sa_column=Column(JSONB, nullable=False, server_default="[]"),
  )
  ```
- В `ItemUpdate` поле `images` НЕ добавлять (управляется только через photo-endpoint, чтобы PUT случайно не затёр массив).
- `ItemPublic` наследует `images` от `ItemBase` автоматически.

### 2. Конфиг — `backend/app/core/config.py`

Добавить в `Settings`:
```python
STATIC_DIR: Path = Path("/app/backend/static")
ITEM_PHOTO_DIR_NAME: str = "item-photo"
MAX_UPLOAD_SIZE_MB: int = 5
ALLOWED_IMAGE_MIME_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]
```

### 3. StaticFiles mount — `backend/app/main.py`

Между CORS-middleware (строка 31) и `include_router` (строка 33):
```python
from fastapi.staticfiles import StaticFiles

settings.STATIC_DIR.mkdir(parents=True, exist_ok=True)
(settings.STATIC_DIR / settings.ITEM_PHOTO_DIR_NAME).mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")
```

### 4. Файловые утилиты — новый модуль `backend/app/utils_files.py`

(`app/utils.py` уже существует и экспортирует email-helpers — не превращаем в пакет, чтобы не ломать импорты.)

Сигнатуры:
```python
def slugify(value: str) -> str:
    # unicodedata NFKD → ASCII, lower, [^a-z0-9]+ -> "-", strip "-"
    # если итог пустой — вернуть "" (caller подставит fallback)

def build_item_dir(item: Item) -> Path:
    # base = settings.STATIC_DIR / settings.ITEM_PHOTO_DIR_NAME
    # name = f"{slug(brand or '')}_{slug(title)}_{uuid4().hex[:8]}"
    # mkdir(parents=True, exist_ok=True), вернуть Path

def get_existing_item_dir(item: Item) -> Path | None:
    # если item.images пуст → None
    # иначе settings.STATIC_DIR / dirname(item.images[0])

def save_item_photos(item: Item, files: list[UploadFile]) -> list[str]:
    # validate mime + size для каждого файла
    # dir = get_existing_item_dir(item) or build_item_dir(item)
    # для каждого: filename = f"{uuid4().hex}{ext_for(mime)}"
    # вернуть НОВЫЕ относительные пути (item-photo/<dir>/<file>)
    # caller должен сделать item.images = item.images + new_paths

def delete_item_photo_file(relative_path: str) -> None:
    # (settings.STATIC_DIR / relative_path).unlink(missing_ok=True)

def delete_item_directory(item: Item) -> None:
    # shutil.rmtree(get_existing_item_dir(item), ignore_errors=True)
```

Валидация в `save_item_photos`:
- `file.content_type in settings.ALLOWED_IMAGE_MIME_TYPES` → иначе `HTTPException(415)`
- размер: после `await file.read()` проверить `len() <= MAX_UPLOAD_SIZE_MB * 1024 * 1024`, иначе `HTTPException(413)`. После `read()` сделать `await file.seek(0)` или писать прямо из прочитанных байт.

### 5. Routes — `backend/app/api/routes/items.py`

Добавить два endpoint-а перед `delete_item` (строка 162):

```python
@router.post("/{id}/photos", response_model=ItemPublic)
async def upload_item_photos(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    files: list[UploadFile] = File(...),
) -> Any:
    item = session.get(Item, id)
    # 404 если нет, 403 если не owner и не superuser (как в update_item)
    new_paths = await save_item_photos(item, files)
    item.images = list(item.images) + new_paths   # переприсвоение нужно для JSONB-tracking
    session.add(item); session.commit(); session.refresh(item)
    return item

@router.delete("/{id}/photos", response_model=ItemPublic)
def delete_item_photo(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    path: str,                           # query param
) -> Any:
    item = session.get(Item, id)
    # 404 / 403 как обычно
    if path not in item.images:
        raise HTTPException(status_code=404, detail="Photo not found")
    delete_item_photo_file(path)
    item.images = [p for p in item.images if p != path]
    session.add(item); session.commit(); session.refresh(item)
    return item
```

В существующем `delete_item` (строка 162) добавить ДО `session.delete(item)`:
```python
delete_item_directory(item)
```

### 6. Сидинг — `backend/app/core/db.py`

- В каждом dict `SEED_ITEMS` удалить ключ `"image_url"`.
- В `_seed_items` (строки 155-178) удалить присваивания/упоминания `image_url`.
- Поле `images` для seed-товаров НЕ задавать — server_default `[]::jsonb` подставится.

### 7. Тесты — `backend/tests/api/routes/test_items.py`

- Удалить упоминания `image_url` из payload-фикстур и assertion-ов.
- Добавить тесты:
  - `test_upload_item_photos_creates_directory_and_paths` — multipart с одним и несколькими файлами, проверить `item.images` и физическое наличие.
  - `test_upload_invalid_mime_returns_415`.
  - `test_upload_oversize_returns_413` (5 MB+1 байт).
  - `test_delete_item_photo_removes_file_and_path`.
  - `test_delete_item_removes_directory`.
  - `test_upload_other_user_item_forbidden`.
- В `tests/utils/item.py` — убрать `image_url` если он там встречается.

## Alembic миграция

```bash
docker compose exec backend alembic revision --autogenerate -m "items_replace_image_url_with_images_jsonb"
```

Что autogenerate должен задетектить: drop_column `image_url`, add_column `images`. Проблема: NOT NULL без default валится на existing rows. Поэтому **вручную переписать `upgrade()` на трёхступенчатый**:

```python
op.add_column('item', sa.Column('images',
    postgresql.JSONB(astext_type=sa.Text()), nullable=True))
op.execute("UPDATE item SET images = '[]'::jsonb")
op.alter_column('item', 'images',
    nullable=False, server_default=sa.text("'[]'::jsonb"))
op.drop_column('item', 'image_url')
```

В `downgrade()` — обратная цепочка.

Применить: `docker compose exec backend alembic upgrade head`.

## Регенерация SDK

После backend-изменений и ребута контейнера:
```bash
bash scripts/generate-client.sh
```
Должны появиться `itemsUploadItemPhotos` и `itemsDeleteItemPhoto` (имена с учётом `custom_generate_unique_id` → tag-route_name → strip tag prefix). У upload — `mediaType: "multipart/form-data"` через `formDataBodySerializer` (`frontend/src/client/core/bodySerializer.ts:37-56`).

## Docker

В `compose.override.yml` (dev), сервис `backend`, в секцию `volumes` добавить:
```yaml
- ./backend/static:/app/backend/static
```

В `compose.yml` (prod), сервис `backend`: добавить named volume `app-static-data` к `/app/backend/static`, объявить в верхнеуровневом `volumes:`.

В `.gitignore` добавить:
```
backend/static/item-photo/
```
Создать `backend/static/.gitkeep` чтобы директория попала в git.

Traefik labels не нужны — `/static` обслуживается тем же backend-сервисом по тому же host. Frontend nginx не трогаем.

## Frontend

### Зависимости

```bash
cd frontend
bunx shadcn@latest add carousel        # установит embla-carousel-react + создаст src/components/ui/carousel.tsx
bun add react-zoom-pan-pinch
```

### Helper `frontend/src/lib/photo.ts` (новый)

```ts
export const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/placeholder/600/600"

export function getPhotoUrl(relativePath: string): string {
  return `${import.meta.env.VITE_API_URL}/static/${relativePath.replace(/^\/+/, "")}`
}

export function firstPhotoOrPlaceholder(images?: string[] | null): string {
  return images && images.length > 0 ? getPhotoUrl(images[0]) : PLACEHOLDER_IMAGE
}
```

### Новые компоненты

**`frontend/src/components/Catalog/ProductGallery.tsx`** — основная карусель на детальной странице:
- Props: `images: string[]`, `title: string`.
- Если массив пуст — отрендерить placeholder одним кадром.
- shadcn `<Carousel>` с `<CarouselPrevious>` / `<CarouselNext>`. Под ним полоса thumbnails (мелкие кнопки → `api.scrollTo(index)` через `setApi`).
- Клик по основному кадру → открыть `<ProductLightbox>` с `initialIndex={current}`.

**`frontend/src/components/Catalog/ProductLightbox.tsx`** — фуллскрин просмотр с зумом:
- shadcn `<Dialog>` с `DialogContent` `className="max-w-screen w-screen h-screen p-0 bg-black/95"`.
- Внутри `<Carousel>` с теми же фото.
- Каждый слайд: `<TransformWrapper><TransformComponent>` из `react-zoom-pan-pinch`. На `<TransformWrapper>` поставить `wrapperProps={{ onPointerDown: (e) => e.stopPropagation() }}` — иначе drag будет триггерить close Dialog.
- `Esc` и клик по фону — close (поведение Dialog).

**`frontend/src/components/Items/ImageUploader.tsx`** — загрузчик в админке:
- Props: `itemId: string`, `currentImages: string[]`.
- Drag-and-drop зона + скрытый `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`.
- Сетка миниатюр текущих фото с кнопкой ❌. На клик — `useMutation(itemsDeleteItemPhoto, { onSuccess: invalidate(["items", id]) })`.
- На выбор файлов — `useMutation(itemsUploadItemPhotos, { body: { files } })`. Optimistic preview через `URL.createObjectURL` пока летит запрос.

### Изменения в существующих компонентах

- **`frontend/src/components/Items/AddItem.tsx`**: двухэтапный flow. Submit формы → `itemsCreateItem` → `onSuccess: setCreatedItemId(res.data.id)`. После — в той же модалке conditional render `<ImageUploader itemId={createdItemId} currentImages={[]} />` + кнопка "Готово".
- **`frontend/src/components/Items/EditItem.tsx`**: вверху формы добавить `<ImageUploader itemId={item.id} currentImages={item.images} />`.
- **`frontend/src/components/Catalog/ProductDetail.tsx`** (строки 54-59): заменить блок `<img src={item.image_url} ...>` на `<ProductGallery images={item.images} title={item.title} />`.
- **`frontend/src/components/Catalog/ProductCard.tsx`** (строка 28): `imgSrc = firstPhotoOrPlaceholder(item.images)`. Опционально badge `+N` если `item.images.length > 1`.
- **`frontend/src/components/Cart/CartItemRow.tsx`** (строка 23): то же.
- **`frontend/src/components/Wishlist/WishlistItemRow.tsx`** (строка 25): то же.
- В этих файлах удалить локальные `PLACEHOLDER_IMAGE` константы, импортировать из `@/lib/photo`.

## Verification

Полный E2E руками:

1. `docker compose down -v && docker compose up -d --build` — чистый старт, миграция применится через `prestart.sh`.
2. Войти superuser-ом → `/admin?tab=items` → Add Item → создать товар без фото → закрыть. Открыть `/catalog` → у нового товара placeholder в `ProductCard`.
3. Edit Item → загрузить 3 фото (drag-drop) → проверить миниатюры.
4. `/catalog/{id}` → проверить карусель: prev/next кнопки, swipe-drag, thumbnails внизу.
5. Клик по основному фото → lightbox в фуллскрине → scroll-zoom мышкой / pinch на тач-устройстве, drag → Esc закрывает.
6. Edit → удалить одно фото (❌) → в каталоге осталось 2.
7. Удалить товар → `docker compose exec backend ls /app/backend/static/item-photo/` → его директория исчезла.
8. Adminer (`http://localhost:8080`) → проверить, что в `item.images` лежат относительные пути (`item-photo/...`), без `/static/` префикса.

Линтеры и тесты:
```bash
bash scripts/lint.sh                    # backend: ruff + mypy + ty
bash scripts/tests-start.sh -x          # backend pytest в контейнере
cd frontend && bun run lint && bun run build
```

## Critical Files

- `backend/app/models/item.py` — модель и схемы
- `backend/app/api/routes/items.py` — два новых endpoint-а + хук в delete_item
- `backend/app/main.py` — StaticFiles mount
- `backend/app/core/config.py` — новые settings
- `backend/app/utils_files.py` — новый модуль (slugify, save/delete файлов)
- `backend/app/core/db.py` — обновить SEED_ITEMS
- `backend/app/alembic/versions/<new>.py` — миграция (autogenerate + ручная правка)
- `compose.override.yml`, `compose.yml`, `.gitignore`, `backend/static/.gitkeep`
- `frontend/src/lib/photo.ts` — новый helper
- `frontend/src/components/Catalog/ProductGallery.tsx` — новый
- `frontend/src/components/Catalog/ProductLightbox.tsx` — новый
- `frontend/src/components/Items/ImageUploader.tsx` — новый
- `frontend/src/components/Items/AddItem.tsx`, `EditItem.tsx` — двухэтапный flow / uploader
- `frontend/src/components/Catalog/ProductCard.tsx`, `ProductDetail.tsx` — переключить на `images[0]`
- `frontend/src/components/Cart/CartItemRow.tsx`, `frontend/src/components/Wishlist/WishlistItemRow.tsx` — то же

## Подводные камни

1. **JSONB NOT NULL миграция** — autogenerate почти наверняка сгенерит `add_column(..., nullable=False)` без UPDATE-step. Ручная трёхступенчатая правка обязательна, иначе `alembic upgrade` упадёт на любом существующем товаре.
2. **JSONB mutation tracking** — `item.images.append(...)` не пометит поле dirty в SQLAlchemy. Всегда переприсваивать: `item.images = list(item.images) + new`.
3. **FastAPI multipart порядок** — `files: list[UploadFile] = File(...)` должен идти ПОСЛЕ всех Path/Depends в сигнатуре.
4. **`react-zoom-pan-pinch` внутри Dialog** — Radix Dialog ловит pointer events, drag для зума будет триггерить close. Решение: `wrapperProps={{ onPointerDown: e => e.stopPropagation() }}` на `TransformWrapper`.
5. **Кириллица в slugify** — `Item.title` часто на русском. Чистый ASCII-fallback (`unicodedata` + regex) для «Кроссовки» даст пустую строку. План: если итог `slug` пуст — использовать только `f"_item_{shortuuid8}"` (директория всё равно уникальна за счёт UUID-суффикса). При желании добавить транслит — `bun add transliterate`-аналог не нужен, можно `python-slugify` (поддерживает unidecode), но это лишняя зависимость; решение по умолчанию — без неё.
6. **`UploadFile.size`** — доступен только если контент полностью прочитан, и можно подделать `Content-Length`. Проверять размер по факту прочитанных байт.
7. **shadcn carousel** — установка автоматически создаст `frontend/src/components/ui/carousel.tsx`; этот файл исключён из Biome (`frontend/biome.json`), редактировать его руками не нужно.
8. **Dev DB cleanup** — после удаления `image_url` старые seed-товары с этим полем останутся (но колонки уже не будет). `docker compose down -v` гарантирует чистый старт; иначе после миграции в `image_url` уже не будет, а `images` подставится `[]` через server_default.
