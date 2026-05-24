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
    OrderPay,
    OrderPublic,
    OrdersPublic,
    OrderStatsGroupBy,
    OrderStatsResponse,
    OrderStatus,
    OrderUpdate,
)
from app.payments import CardValidationError, mask_card

router = APIRouter(prefix="/orders", tags=["orders"])


# Admin-driven transitions after the order is paid.
_ALLOWED_TRANSITIONS: dict[OrderStatus, OrderStatus] = {
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
        paid_at=order.paid_at,
        received_at=order.received_at,
        refunded_at=order.refunded_at,
        card_brand=order.card_brand,
        card_last4=order.card_last4,
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
    Update order status. Admin-driven transitions: PAID → SHIPPED → DELIVERED.
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


_CANCELLABLE_STATUSES = {OrderStatus.NEW}


@router.post("/{id}/cancel", response_model=OrderPublic)
def cancel_order(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    payload: OrderCancel,
) -> Any:
    """
    Cancel an unpaid order. Allowed only by the order's owner (or superuser)
    while the order is still in NEW (awaiting payment). Returns reserved stock.
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


def _get_owned_order(
    *, session: SessionDep, current_user: CurrentUser, order_id: uuid.UUID
) -> Order:
    order = crud.get_order(session=session, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not current_user.is_superuser and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return order


@router.post("/{id}/pay", response_model=OrderPublic)
def pay_order(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    payload: OrderPay,
) -> Any:
    """
    Pay for an order in NEW status using a saved card or new card data.
    Raw card data (PAN/CVC) is never stored — only brand and last4 are kept.
    """
    order = _get_owned_order(session=session, current_user=current_user, order_id=id)
    if order.status != OrderStatus.NEW:
        raise HTTPException(status_code=400, detail="Этот заказ нельзя оплатить")

    if payload.card_id is not None:
        card = crud.get_payment_card(
            session=session, card_id=payload.card_id, user_id=current_user.id
        )
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        brand, last4 = card.brand, card.last4
    elif payload.card is not None:
        try:
            masked = mask_card(
                card_number=payload.card.card_number,
                exp_month=payload.card.exp_month,
                exp_year=payload.card.exp_year,
                cardholder_name=payload.card.cardholder_name,
            )
        except CardValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        brand, last4 = masked.brand, masked.last4
        if payload.save_card:
            crud.create_payment_card(
                session=session, user_id=current_user.id, masked=masked
            )
    else:
        raise HTTPException(status_code=400, detail="Укажите карту для оплаты")

    updated = crud.pay_order(session=session, order=order, brand=brand, last4=last4)
    return _serialize_order(updated)


@router.post("/{id}/receive", response_model=OrderPublic)
def receive_order(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """
    Buyer confirms receipt of a delivered order (DELIVERED → RECEIVED).
    """
    order = _get_owned_order(session=session, current_user=current_user, order_id=id)
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=400,
            detail="Подтвердить получение можно только доставленный заказ",
        )
    updated = crud.mark_order_received(session=session, order=order)
    return _serialize_order(updated)


@router.post("/{id}/refund", response_model=OrderPublic)
def refund_order(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """
    Refund a received order within the legal return window
    (RECEIVED → REFUNDED). Funds are returned to the card used for payment.
    """
    order = _get_owned_order(session=session, current_user=current_user, order_id=id)
    if order.status != OrderStatus.RECEIVED:
        raise HTTPException(
            status_code=400, detail="Возврат доступен только для полученного заказа"
        )
    if not crud.is_within_refund_window(order):
        raise HTTPException(status_code=400, detail="Срок для возврата средств истёк")
    updated = crud.refund_order(session=session, order=order)
    return _serialize_order(updated)
