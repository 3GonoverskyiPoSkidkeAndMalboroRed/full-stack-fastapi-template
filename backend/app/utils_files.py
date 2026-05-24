import re
import shutil
import unicodedata
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.models import Item

_MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    lower = ascii_only.lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", lower).strip("-")
    return cleaned


def _short_uuid() -> str:
    return uuid.uuid4().hex[:8]


def _photo_root() -> Path:
    return settings.STATIC_DIR / settings.ITEM_PHOTO_DIR_NAME


def build_item_dir(item: Item) -> Path:
    brand_slug = slugify(item.brand.name if item.brand else "")
    title_slug = slugify(item.title) or "item"
    name_parts = [p for p in (brand_slug, title_slug) if p] or [title_slug]
    name = f"{'_'.join(name_parts)}_{_short_uuid()}"
    target = _photo_root() / name
    target.mkdir(parents=True, exist_ok=True)
    return target


def get_existing_item_dir(item: Item) -> Path | None:
    if not item.images:
        return None
    first_relative = item.images[0]
    return settings.STATIC_DIR / Path(first_relative).parent


async def save_item_photos(item: Item, files: list[UploadFile]) -> list[str]:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    target_dir = get_existing_item_dir(item) or build_item_dir(item)
    target_dir.mkdir(parents=True, exist_ok=True)

    saved: list[str] = []
    for upload in files:
        if upload.content_type not in settings.ALLOWED_IMAGE_MIME_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported media type: {upload.content_type}",
            )
        contents = await upload.read()
        if len(contents) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit",
            )
        ext = _MIME_TO_EXT[upload.content_type]
        filename = f"{uuid.uuid4().hex}{ext}"
        (target_dir / filename).write_bytes(contents)
        relative = target_dir.relative_to(settings.STATIC_DIR) / filename
        saved.append(relative.as_posix())

    return saved


def delete_item_photo_file(relative_path: str) -> None:
    absolute = (settings.STATIC_DIR / relative_path).resolve()
    try:
        absolute.relative_to(settings.STATIC_DIR.resolve())
    except ValueError:
        return
    if absolute.is_file():
        absolute.unlink(missing_ok=True)


def delete_item_directory(item: Item) -> None:
    target = get_existing_item_dir(item)
    if target is None:
        return
    resolved = target.resolve()
    try:
        resolved.relative_to(_photo_root().resolve())
    except ValueError:
        return
    shutil.rmtree(resolved, ignore_errors=True)
