import uuid
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Brand,
    Category,
    Item,
    ItemCreate,
    ItemPublic,
    ItemsPublic,
    ItemUpdate,
    Message,
    Size,
)
from app.utils_files import (
    delete_item_directory,
    delete_item_photo_file,
    save_item_photos,
)

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/public", response_model=ItemsPublic)
def read_items_public(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    category_id: uuid.UUID | None = None,
    size_id: uuid.UUID | None = None,
    brand_id: uuid.UUID | None = None,
    q: str | None = None,
) -> Any:
    """
    Public catalog listing — no authentication required.
    """
    count_statement = select(func.count()).select_from(Item)
    statement = (
        select(Item).order_by(col(Item.created_at).desc()).offset(skip).limit(limit)
    )
    if category_id is not None:
        count_statement = count_statement.where(Item.category_id == category_id)
        statement = statement.where(Item.category_id == category_id)
    if size_id is not None:
        count_statement = count_statement.where(Item.size_id == size_id)
        statement = statement.where(Item.size_id == size_id)
    if brand_id is not None:
        count_statement = count_statement.where(Item.brand_id == brand_id)
        statement = statement.where(Item.brand_id == brand_id)
    if q:
        pattern = f"%{q.strip()}%"
        count_statement = count_statement.where(col(Item.title).ilike(pattern))
        statement = statement.where(col(Item.title).ilike(pattern))
    count = session.exec(count_statement).one()
    items = session.exec(statement).all()
    items_public = [ItemPublic.model_validate(item) for item in items]
    return ItemsPublic(data=items_public, count=count)


@router.get("/public/{id}", response_model=ItemPublic)
def read_item_public(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Public product detail — no authentication required.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.get("/", response_model=ItemsPublic)
def read_items(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve items.
    """

    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Item)
        count = session.exec(count_statement).one()
        statement = (
            select(Item).order_by(col(Item.created_at).desc()).offset(skip).limit(limit)
        )
        items = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Item)
            .where(Item.owner_id == current_user.id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Item)
            .where(Item.owner_id == current_user.id)
            .order_by(col(Item.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
        items = session.exec(statement).all()

    items_public = [ItemPublic.model_validate(item) for item in items]
    return ItemsPublic(data=items_public, count=count)


@router.get("/{id}", response_model=ItemPublic)
def read_item(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get item by ID.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return item


@router.post("/", response_model=ItemPublic)
def create_item(
    *, session: SessionDep, current_user: CurrentUser, item_in: ItemCreate
) -> Any:
    """
    Create new item.
    """
    if item_in.category_id is not None:
        category = session.get(Category, item_in.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    if item_in.size_id is not None:
        size = session.get(Size, item_in.size_id)
        if not size:
            raise HTTPException(status_code=404, detail="Size not found")
    if item_in.brand_id is not None:
        brand = session.get(Brand, item_in.brand_id)
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
    item = Item.model_validate(item_in, update={"owner_id": current_user.id})
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.put("/{id}", response_model=ItemPublic)
def update_item(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    item_in: ItemUpdate,
) -> Any:
    """
    Update an item.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    update_dict = item_in.model_dump(exclude_unset=True)
    if "category_id" in update_dict and update_dict["category_id"] is not None:
        category = session.get(Category, update_dict["category_id"])
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    if "size_id" in update_dict and update_dict["size_id"] is not None:
        size = session.get(Size, update_dict["size_id"])
        if not size:
            raise HTTPException(status_code=404, detail="Size not found")
    if "brand_id" in update_dict and update_dict["brand_id"] is not None:
        brand = session.get(Brand, update_dict["brand_id"])
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
    item.sqlmodel_update(update_dict)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.post("/{id}/photos", response_model=ItemPublic)
async def upload_item_photos(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    files: list[UploadFile] = File(...),
) -> Any:
    """
    Upload one or more photos for an item.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    new_paths = await save_item_photos(item, files)
    item.images = list(item.images) + new_paths
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{id}/photos", response_model=ItemPublic)
def delete_item_photo(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    path: str,
) -> Any:
    """
    Remove a single photo from an item by its relative path.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if path not in item.images:
        raise HTTPException(status_code=404, detail="Photo not found")
    delete_item_photo_file(path)
    item.images = [p for p in item.images if p != path]
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{id}")
def delete_item(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete an item.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    delete_item_directory(item)
    session.delete(item)
    session.commit()
    return Message(message="Item deleted successfully")
