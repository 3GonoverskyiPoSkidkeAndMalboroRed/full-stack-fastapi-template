import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    CartItem,
    CartItemCreate,
    CartItemPublic,
    CartItemsPublic,
    CartItemUpdate,
    Item,
    ItemPublic,
    Message,
)

router = APIRouter(prefix="/cart", tags=["cart"])


def _serialize_cart_item(cart_item: CartItem) -> CartItemPublic:
    return CartItemPublic(
        id=cart_item.id,
        item_id=cart_item.item_id,
        quantity=cart_item.quantity,
        item=ItemPublic.model_validate(cart_item.item) if cart_item.item else None,
        created_at=cart_item.created_at,
    )


@router.get("/", response_model=CartItemsPublic)
def read_cart(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Retrieve current user's cart.
    """
    cart_items = crud.get_user_cart(session=session, user_id=current_user.id)
    data = [_serialize_cart_item(ci) for ci in cart_items]
    subtotal = Decimal("0")
    for ci in cart_items:
        if ci.item is not None and ci.item.cost is not None:
            subtotal += ci.item.cost * ci.quantity
    return CartItemsPublic(data=data, count=len(data), subtotal=subtotal)


@router.post("/", response_model=CartItemPublic)
def add_cart_item(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    payload: CartItemCreate,
) -> Any:
    """
    Add an item to the current user's cart (or increase quantity if it exists).
    """
    item = session.get(Item, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = crud.get_cart_item(
        session=session, user_id=current_user.id, item_id=payload.item_id
    )
    requested_total = (existing.quantity if existing else 0) + payload.quantity
    if requested_total > item.stock:
        raise HTTPException(status_code=409, detail="Недостаточно товара на складе")

    cart_item = crud.add_to_cart(
        session=session, user_id=current_user.id, payload=payload
    )
    session.refresh(cart_item)
    cart_item.item  # noqa: B018  # eager-load
    return _serialize_cart_item(cart_item)


@router.patch("/{id}", response_model=CartItemPublic)
def update_cart_item(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    payload: CartItemUpdate,
) -> Any:
    """
    Update quantity of a cart item.
    """
    cart_item = session.get(CartItem, id)
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    if cart_item.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    item = session.get(Item, cart_item.item_id)
    if item is not None and payload.quantity > item.stock:
        raise HTTPException(status_code=409, detail="Недостаточно товара на складе")

    updated = crud.update_cart_quantity(
        session=session, cart_item=cart_item, quantity=payload.quantity
    )
    return _serialize_cart_item(updated)


@router.delete("/{id}", response_model=Message)
def delete_cart_item(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Remove a cart item.
    """
    cart_item = session.get(CartItem, id)
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    if cart_item.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    crud.delete_cart_item(session=session, cart_item=cart_item)
    return Message(message="Cart item removed")


@router.delete("/", response_model=Message)
def clear_cart(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Clear the current user's cart.
    """
    crud.clear_cart(session=session, user_id=current_user.id)
    return Message(message="Cart cleared")
