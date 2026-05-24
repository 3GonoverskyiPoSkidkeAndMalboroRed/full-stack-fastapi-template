import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.models import (
    Order,
    OrderCancel,
    OrderCreate,
    OrderItemPublic,
    OrderPublic,
    OrdersPublic,
    OrderStatsGroupBy,
    OrderStatsResponse,
    OrderStatus,
    OrderUpdate,
)

router = APIRouter(prefix="/orders", tags=["orders"])


_ALLOWED_TRANSITIONS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.NEW: OrderStatus.PROCESSED,
    OrderStatus.PROCESSED: OrderStatus.PAID,
    OrderStatus.PAID: OrderStatus.SHIPPED,
    OrderStatus.SHIPPED: OrderStatus.DELIVERED,
}


def _serialize_order(order: Order) -> OrderPublic:
    return OrderPublic(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        total=order.total,
        cancellation_reason=order.cancellation_reason,
        created_at=order.created_at,
        recipient_name=order.recipient_name,
        phone=order.phone,
        address=order.address,
        comment=order.comment,
        items=[
            OrderItemPublic(
                id=oi.id,
                item_id=oi.item_id,
                title_snapshot=oi.title_snapshot,
                price_snapshot=oi.price_snapshot,
                quantity=oi.quantity,
            )
            for oi in order.items
        ],
    )


@router.post("/", response_model=OrderPublic)
def create_order(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    payload: OrderCreate,
) -> Any:
    """
    Create a new order from the current user's cart.
    """
    try:
        order = crud.create_order_from_cart(
            session=session, user=current_user, payload=payload
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _serialize_order(order)


@router.get("/", response_model=OrdersPublic)
def read_orders(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    status: OrderStatus | None = None,
) -> Any:
    """
    Retrieve orders. Superusers see all, regular users see only their own.
    """
    user_filter = None if current_user.is_superuser else current_user.id
    orders, count = crud.list_orders(
        session=session,
        user_id=user_filter,
        status=status,
        skip=skip,
        limit=limit,
    )
    return OrdersPublic(data=[_serialize_order(o) for o in orders], count=count)


@router.get(
    "/stats",
    response_model=OrderStatsResponse,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_orders_stats(
    session: SessionDep,
    start: datetime,
    end: datetime,
    group_by: OrderStatsGroupBy = "day",
) -> Any:
    """
    Aggregated order statistics by time bucket (hour/day/month) in Europe/Moscow tz.
    Superuser only.
    """
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be after start")
    if group_by == "hour" and (end - start) > timedelta(days=31):
        raise HTTPException(
            status_code=400,
            detail="Для группировки по часам диапазон не более 31 дня",
        )
    return crud.get_orders_stats(
        session=session, start=start, end=end, group_by=group_by
    )


@router.get("/{id}", response_model=OrderPublic)
def read_order(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get order by ID.
    """
    order = crud.get_order(session=session, order_id=id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not current_user.is_superuser and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return _serialize_order(order)


@router.patch(
    "/{id}/status",
    response_model=OrderPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_order_status(
    *,
    session: SessionDep,
    id: uuid.UUID,
    payload: OrderUpdate,
) -> Any:
    """
    Update order status. Allowed transitions: NEW → PROCESSED → PAID → SHIPPED → DELIVERED.
    """
    if payload.status is None:
        raise HTTPException(status_code=400, detail="status is required")

    order = crud.get_order(session=session, order_id=id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed_next = _ALLOWED_TRANSITIONS.get(order.status)
    if allowed_next != payload.status:
        raise HTTPException(status_code=400, detail="Недопустимый переход статуса")

    updated = crud.update_order_status(
        session=session, order=order, new_status=payload.status
    )
    return _serialize_order(updated)


_CANCELLABLE_STATUSES = {OrderStatus.NEW, OrderStatus.PROCESSED, OrderStatus.PAID}


@router.post("/{id}/cancel", response_model=OrderPublic)
def cancel_order(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    payload: OrderCancel,
) -> Any:
    """
    Cancel an order. Allowed only by the order's owner (or superuser) while the
    order is in NEW, PROCESSED, or PAID status. Returns reserved stock back to items.
    """
    order = crud.get_order(session=session, order_id=id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not current_user.is_superuser and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if order.status not in _CANCELLABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Этот заказ нельзя отменить")

    updated = crud.cancel_order(session=session, order=order, reason=payload.reason)
    return _serialize_order(updated)
