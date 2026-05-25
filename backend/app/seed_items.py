"""Seed-скрипт: загружает товары в БД из директории `items/`.

Каждая поддиректория `items/<Бренд>_<Модель>/` должна содержать:
  - `item.json` — параметры товара
    (title, brand, category, size_name, description, cost, stock, images);
  - файлы фотографий (.webp/.jpg/.jpeg/.png), перечисленные в поле `images`.

Скрипт резолвит (или создаёт) бренд, категорию и размер, копирует фотографии
в `STATIC_DIR/item-photo/...` и создаёт записи `Item` с заполненным `images`
в том же порядке, что указан в JSON (первое фото — главное).

Запуск (внутри контейнера; папку items сначала копируем в контейнер):
    docker compose cp ./items backend:/app/items
    docker compose exec backend python -m app.seed_items

Идемпотентность: товары с уже существующим `title` пропускаются.
Флаг --reset удаляет ранее загруженные сидом товары (по `title`) вместе с их
фотографиями, корзинами и вишлистами перед повторной заливкой
(история заказов сохраняется — `orderitem.item_id` обнуляется по SET NULL).
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import uuid
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.models import (
    BrandCreate,
    CategoryCreate,
    Item,
    ItemCreate,
    SizeCreate,
)
from app.utils_files import build_item_dir, delete_item_directory

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("seed_items")

# items/ лежит на два уровня выше пакета app: <repo>/items (локально)
# или /app/items внутри контейнера (после `docker compose cp ./items backend:/app/items`).
DEFAULT_ITEMS_DIR = Path(__file__).resolve().parents[2] / "items"

ITEM_JSON_NAME = "item.json"
ALLOWED_EXTS = {".webp", ".jpg", ".jpeg", ".png"}

# Item.cost хранится как Numeric(8, 2): максимум 999 999.99.
MAX_COST = Decimal("999999.99")

Spec = tuple[Path, dict[str, Any]]


def _load_specs(items_dir: Path) -> list[Spec]:
    """Прочитать item.json из всех поддиректорий items_dir."""
    specs: list[Spec] = []
    for sub in sorted(p for p in items_dir.iterdir() if p.is_dir()):
        meta = sub / ITEM_JSON_NAME
        if not meta.is_file():
            logger.warning("Пропуск %s: нет %s", sub.name, ITEM_JSON_NAME)
            continue
        data: dict[str, Any] = json.loads(meta.read_text(encoding="utf-8"))
        specs.append((sub, data))
    return specs


def _validate(specs: list[Spec]) -> list[str]:
    """Проверить корректность данных до записи в БД. Вернуть список ошибок."""
    errors: list[str] = []
    for sub, data in specs:
        if not data.get("title"):
            errors.append(f"{sub.name}: пустой title")

        cost = data.get("cost")
        if cost not in (None, ""):
            try:
                if Decimal(str(cost)) > MAX_COST:
                    errors.append(
                        f"{sub.name}: cost {cost} превышает лимит "
                        f"Numeric(8,2) = {MAX_COST}"
                    )
            except InvalidOperation:
                errors.append(f"{sub.name}: некорректная цена {cost!r}")

        images = data.get("images", [])
        if not images:
            errors.append(f"{sub.name}: пустой список images")
        for fname in images:
            src = sub / fname
            if not src.is_file():
                errors.append(f"{sub.name}: фото не найдено — {fname}")
            elif src.suffix.lower() not in ALLOWED_EXTS:
                errors.append(f"{sub.name}: неподдерживаемый формат — {fname}")
    return errors


def _get_or_create_brand(session: Session, name: str) -> uuid.UUID:
    brand = crud.get_brand_by_name(session=session, name=name)
    if brand is None:
        brand = crud.create_brand(session=session, brand_in=BrandCreate(name=name))
        logger.info("  + бренд: %s", name)
    return brand.id


def _get_or_create_category(session: Session, name: str) -> uuid.UUID:
    category = crud.get_category_by_name(session=session, name=name)
    if category is None:
        category = crud.create_category(
            session=session, category_in=CategoryCreate(name=name)
        )
        logger.info("  + категория: %s", name)
    return category.id


def _get_or_create_size(session: Session, name: str | None) -> uuid.UUID | None:
    if not name:
        return None
    size = crud.get_size_by_name(session=session, name=name)
    if size is None:
        size = crud.create_size(session=session, size_in=SizeCreate(name=name))
        logger.info("  + размер: %s", name)
    return size.id


def _copy_photos(item: Item, src_dir: Path, filenames: list[str]) -> list[str]:
    """Скопировать фото в STATIC_DIR/item-photo/<slug>_<uuid>/ и вернуть пути."""
    target_dir = build_item_dir(item)
    relatives: list[str] = []
    for fname in filenames:
        src = src_dir / fname
        ext = src.suffix.lower()
        dest_name = f"{uuid.uuid4().hex}{ext}"
        shutil.copyfile(src, target_dir / dest_name)
        relative = target_dir.relative_to(settings.STATIC_DIR) / dest_name
        relatives.append(relative.as_posix())
    return relatives


def _seed_one(
    session: Session, owner_id: uuid.UUID, item_dir: Path, data: dict[str, Any]
) -> bool:
    title = str(data["title"])
    existing = session.exec(select(Item).where(Item.title == title)).first()
    if existing is not None:
        logger.info("= уже есть, пропуск: %s", title)
        return False

    brand_name = data.get("brand")
    category_name = data.get("category")
    brand_id = _get_or_create_brand(session, str(brand_name)) if brand_name else None
    category_id = (
        _get_or_create_category(session, str(category_name)) if category_name else None
    )
    size_id = _get_or_create_size(session, data.get("size_name"))

    raw_cost = data.get("cost")
    cost = Decimal(str(raw_cost)) if raw_cost not in (None, "") else None

    item_in = ItemCreate(
        title=title,
        description=data.get("description"),
        brand_id=brand_id,
        category_id=category_id,
        size_id=size_id,
        cost=cost,
        stock=int(data.get("stock", 0)),
    )
    item = crud.create_item(session=session, item_in=item_in, owner_id=owner_id)

    item.images = _copy_photos(item, item_dir, list(data.get("images", [])))
    session.add(item)
    session.commit()

    logger.info(
        "+ %s — %s (%d фото)",
        brand_name or "—",
        title,
        len(item.images),
    )
    return True


def _reset(session: Session, titles: list[str]) -> None:
    """Удалить ранее загруженные сидом товары (по title) и их фотографии."""
    removed = 0
    for title in titles:
        item = session.exec(select(Item).where(Item.title == title)).first()
        if item is None:
            continue
        delete_item_directory(item)
        session.delete(item)
        removed += 1
        logger.info("- удалён: %s", title)
    session.commit()
    if removed:
        logger.info("Удалено товаров перед заливкой: %d", removed)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--items-dir",
        type=str,
        default=str(DEFAULT_ITEMS_DIR),
        help=f"Путь к директории с товарами (по умолчанию {DEFAULT_ITEMS_DIR}).",
    )
    parser.add_argument(
        "--owner",
        type=str,
        default=settings.FIRST_SUPERUSER,
        help="Email владельца товаров (по умолчанию — первый суперюзер).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Удалить ранее загруженные сидом товары перед заливкой.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    items_dir = Path(args.items_dir)
    if not items_dir.is_dir():
        raise SystemExit(f"Директория не найдена: {items_dir}")

    specs = _load_specs(items_dir)
    if not specs:
        raise SystemExit(f"Не найдено ни одного {ITEM_JSON_NAME} в {items_dir}")

    errors = _validate(specs)
    if errors:
        logger.error("Найдены ошибки в данных — ничего не загружено:")
        for err in errors:
            logger.error("  - %s", err)
        raise SystemExit(1)

    with Session(engine) as session:
        owner = crud.get_user_by_email(session=session, email=args.owner)
        if owner is None:
            raise SystemExit(f"Пользователь-владелец не найден: {args.owner}")

        if args.reset:
            _reset(session, [str(data["title"]) for _, data in specs])

        created = 0
        for item_dir, data in specs:
            if _seed_one(session, owner.id, item_dir, data):
                created += 1

    logger.info("Готово. Добавлено товаров: %d из %d", created, len(specs))


if __name__ == "__main__":
    main()
