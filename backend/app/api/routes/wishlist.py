import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Item,
    ItemPublic,
    Message,
    WishlistItem,
    WishlistItemCreate,
    WishlistItemPublic,
    WishlistItemsPublic,
)

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


def _serialize_wishlist_item(wishlist_item: WishlistItem) -> WishlistItemPublic:
    return WishlistItemPublic(
        id=wishlist_item.id,
        item_id=wishlist_item.item_id,
        item=ItemPublic.model_validate(wishlist_item.item)
        if wishlist_item.item
        else None,
        created_at=wishlist_item.created_at,
    )


@router.get("/", response_model=WishlistItemsPublic)
def read_wishlist(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Retrieve current user's wishlist.
    """
    wishlist_items = crud.get_user_wishlist(session=session, user_id=current_user.id)
    data = [_serialize_wishlist_item(wi) for wi in wishlist_items]
    return WishlistItemsPublic(data=data, count=len(data))


@router.post("/", response_model=WishlistItemPublic)
def add_wishlist_item(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    payload: WishlistItemCreate,
) -> Any:
    """
    Add an item to the wishlist (idempotent).
    """
    item = session.get(Item, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    wishlist_item = crud.add_to_wishlist(
        session=session, user_id=current_user.id, item_id=payload.item_id
    )
    session.refresh(wishlist_item)
    wishlist_item.item  # noqa: B018  # eager-load
    return _serialize_wishlist_item(wishlist_item)


@router.delete("/{id}", response_model=Message)
def delete_wishlist_item(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Remove an item from the wishlist.
    """
    wishlist_item = session.get(WishlistItem, id)
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    if wishlist_item.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    crud.delete_wishlist_item(session=session, wishlist_item=wishlist_item)
    return Message(message="Wishlist item removed")
