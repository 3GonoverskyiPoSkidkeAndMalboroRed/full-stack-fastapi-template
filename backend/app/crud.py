import uuid
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from zoneinfo import ZoneInfo

from sqlmodel import Session, col, delete, func, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Brand,
    BrandCreate,
    BrandUpdate,
    CartItem,
    CartItemCreate,
    Category,
    CategoryCreate,
    CategoryUpdate,
    Item,
    ItemCreate,
    Order,
    OrderCreate,
    OrderItem,
    OrderStatsBucket,
    OrderStatsGroupBy,
    OrderStatsResponse,
    OrderStatsSummary,
    OrderStatus,
    PaymentCard,
    Size,
    SizeCreate,
    SizeUpdate,
    User,
    UserCreate,
    UserUpdate,
    WishlistItem,
)
from app.payments import MaskedCard

REFUND_WINDOW_DAYS = 14

STATS_TZ = ZoneInfo("Europe/Moscow")
_MONEY_QUANTUM = Decimal("0.01")


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _truncate_to_bucket(dt: datetime, group_by: OrderStatsGroupBy) -> datetime:
    """Усечь datetime до начала бакета по выбранной группировке (в её tz)."""
    if group_by == "hour":
        return dt.replace(minute=0, second=0, microsecond=0)
    if group_by == "day":
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _next_bucket(dt: datetime, group_by: OrderStatsGroupBy) -> datetime:
    if group_by == "hour":
        return dt + timedelta(hours=1)
    if group_by == "day":
        return dt + timedelta(days=1)
    year = dt.year + (1 if dt.month == 12 else 0)
    month = 1 if dt.month == 12 else dt.month + 1
    return dt.replace(year=year, month=month)


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


# Dummy hash to use for timing attack prevention when user is not found
# This is an Argon2 hash of a random password, used to ensure constant-time comparison
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        # Prevent timing attacks by running password verification even when user doesn't exist
        # This ensures the response time is similar whether or not the email exists
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


def create_category(*, session: Session, category_in: CategoryCreate) -> Category:
    db_obj = Category.model_validate(category_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_category_by_name(*, session: Session, name: str) -> Category | None:
    statement = select(Category).where(Category.name == name)
    return session.exec(statement).first()


def update_category(
    *, session: Session, db_category: Category, category_in: CategoryUpdate
) -> Category:
    category_data = category_in.model_dump(exclude_unset=True)
    db_category.sqlmodel_update(category_data)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category


def create_size(*, session: Session, size_in: SizeCreate) -> Size:
    db_obj = Size.model_validate(size_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_size_by_name(*, session: Session, name: str) -> Size | None:
    statement = select(Size).where(Size.name == name)
    return session.exec(statement).first()


def update_size(*, session: Session, db_size: Size, size_in: SizeUpdate) -> Size:
    size_data = size_in.model_dump(exclude_unset=True)
    db_size.sqlmodel_update(size_data)
    session.add(db_size)
    session.commit()
    session.refresh(db_size)
    return db_size


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


# Cart


def get_user_cart(*, session: Session, user_id: uuid.UUID) -> list[CartItem]:
    statement = (
        select(CartItem)
        .where(col(CartItem.user_id) == user_id)
        .order_by(col(CartItem.created_at).desc())
    )
    return list(session.exec(statement).all())


def get_cart_item(
    *, session: Session, user_id: uuid.UUID, item_id: uuid.UUID
) -> CartItem | None:
    statement = select(CartItem).where(
        CartItem.user_id == user_id, CartItem.item_id == item_id
    )
    return session.exec(statement).first()


def add_to_cart(
    *, session: Session, user_id: uuid.UUID, payload: CartItemCreate
) -> CartItem:
    existing = get_cart_item(session=session, user_id=user_id, item_id=payload.item_id)
    if existing is not None:
        existing.quantity += payload.quantity
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    db_obj = CartItem(
        user_id=user_id, item_id=payload.item_id, quantity=payload.quantity
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_cart_quantity(
    *, session: Session, cart_item: CartItem, quantity: int
) -> CartItem:
    cart_item.quantity = quantity
    session.add(cart_item)
    session.commit()
    session.refresh(cart_item)
    return cart_item


def delete_cart_item(*, session: Session, cart_item: CartItem) -> None:
    session.delete(cart_item)
    session.commit()


def clear_cart(*, session: Session, user_id: uuid.UUID) -> None:
    session.exec(delete(CartItem).where(col(CartItem.user_id) == user_id))
    session.commit()


# Wishlist


def get_user_wishlist(*, session: Session, user_id: uuid.UUID) -> list[WishlistItem]:
    statement = (
        select(WishlistItem)
        .where(col(WishlistItem.user_id) == user_id)
        .order_by(col(WishlistItem.created_at).desc())
    )
    return list(session.exec(statement).all())


def get_wishlist_item_for_user(
    *, session: Session, user_id: uuid.UUID, item_id: uuid.UUID
) -> WishlistItem | None:
    statement = select(WishlistItem).where(
        WishlistItem.user_id == user_id, WishlistItem.item_id == item_id
    )
    return session.exec(statement).first()


def add_to_wishlist(
    *, session: Session, user_id: uuid.UUID, item_id: uuid.UUID
) -> WishlistItem:
    existing = get_wishlist_item_for_user(
        session=session, user_id=user_id, item_id=item_id
    )
    if existing is not None:
        return existing
    db_obj = WishlistItem(user_id=user_id, item_id=item_id)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_wishlist_item(*, session: Session, wishlist_item: WishlistItem) -> None:
    session.delete(wishlist_item)
    session.commit()


# Orders


def list_orders(
    *,
    session: Session,
    user_id: uuid.UUID | None = None,
    status: OrderStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[Order], int]:
    count_statement = select(func.count()).select_from(Order)
    statement = (
        select(Order).order_by(col(Order.created_at).desc()).offset(skip).limit(limit)
    )
    if user_id is not None:
        count_statement = count_statement.where(col(Order.user_id) == user_id)
        statement = statement.where(col(Order.user_id) == user_id)
    if status is not None:
        count_statement = count_statement.where(col(Order.status) == status)
        statement = statement.where(col(Order.status) == status)
    count = session.exec(count_statement).one()
    orders = list(session.exec(statement).all())
    return orders, count


def get_order(*, session: Session, order_id: uuid.UUID) -> Order | None:
    statement = select(Order).where(col(Order.id) == order_id)
    return session.exec(statement).first()


def update_order_status(
    *, session: Session, order: Order, new_status: OrderStatus
) -> Order:
    order.status = new_status
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


def cancel_order(*, session: Session, order: Order, reason: str) -> Order:
    order.status = OrderStatus.CANCELLED
    order.cancellation_reason = reason
    session.add(order)
    _restock_order(session=session, order=order)
    session.commit()
    session.refresh(order)
    return order


def _restock_order(*, session: Session, order: Order) -> None:
    for oi in order.items:
        if oi.item is not None:
            oi.item.stock += oi.quantity
            session.add(oi.item)


def pay_order(*, session: Session, order: Order, last4: str) -> Order:
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(timezone.utc)
    order.card_last4 = last4
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


def mark_order_received(*, session: Session, order: Order) -> Order:
    order.status = OrderStatus.RECEIVED
    order.received_at = datetime.now(timezone.utc)
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


def refund_order(*, session: Session, order: Order) -> Order:
    order.status = OrderStatus.REFUNDED
    order.refunded_at = datetime.now(timezone.utc)
    session.add(order)
    _restock_order(session=session, order=order)
    session.commit()
    session.refresh(order)
    return order


def is_within_refund_window(order: Order) -> bool:
    if order.received_at is None:
        return False
    received = order.received_at
    if received.tzinfo is None:
        received = received.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - received <= timedelta(days=REFUND_WINDOW_DAYS)


# Payment cards


def create_payment_card(
    *, session: Session, user_id: uuid.UUID, masked: MaskedCard
) -> PaymentCard:
    card = PaymentCard(
        user_id=user_id,
        last4=masked.last4,
        exp_month=masked.exp_month,
        exp_year=masked.exp_year,
        cardholder_name=masked.cardholder_name,
    )
    session.add(card)
    session.commit()
    session.refresh(card)
    return card


def list_payment_cards(
    *, session: Session, user_id: uuid.UUID
) -> tuple[list[PaymentCard], int]:
    statement = (
        select(PaymentCard)
        .where(col(PaymentCard.user_id) == user_id)
        .order_by(col(PaymentCard.created_at).desc())
    )
    cards = list(session.exec(statement).all())
    return cards, len(cards)


def get_payment_card(
    *, session: Session, card_id: uuid.UUID, user_id: uuid.UUID
) -> PaymentCard | None:
    card = session.get(PaymentCard, card_id)
    if card is None or card.user_id != user_id:
        return None
    return card


def delete_payment_card(*, session: Session, card: PaymentCard) -> None:
    session.delete(card)
    session.commit()


def create_order_from_cart(
    *, session: Session, user: User, payload: OrderCreate
) -> Order:
    cart_items = get_user_cart(session=session, user_id=user.id)
    if not cart_items:
        raise ValueError("Cart is empty")

    for ci in cart_items:
        if ci.item is None:
            raise ValueError("Cart contains an item that no longer exists")
        if ci.quantity > ci.item.stock:
            raise ValueError(f"Insufficient stock for: {ci.item.title}")

    try:
        total = Decimal("0")
        order = Order(
            recipient_name=payload.recipient_name,
            phone=payload.phone,
            address=payload.address,
            comment=payload.comment,
            user_id=user.id,
            status=OrderStatus.NEW,
            total=Decimal("0"),
        )
        session.add(order)
        session.flush()

        for ci in cart_items:
            assert ci.item is not None
            price = ci.item.cost if ci.item.cost is not None else Decimal("0")
            order_item = OrderItem(
                order_id=order.id,
                item_id=ci.item_id,
                title_snapshot=ci.item.title,
                price_snapshot=price,
                quantity=ci.quantity,
            )
            session.add(order_item)
            ci.item.stock -= ci.quantity
            session.add(ci.item)
            total += price * ci.quantity

        order.total = total
        session.add(order)
        session.exec(delete(CartItem).where(col(CartItem.user_id) == user.id))
        session.commit()
        session.refresh(order)
        return order
    except Exception:
        session.rollback()
        raise


def get_orders_stats(
    *,
    session: Session,
    start: datetime,
    end: datetime,
    group_by: OrderStatsGroupBy,
) -> OrderStatsResponse:
    """Агрегированная статистика заказов по времени в часовом поясе Europe/Moscow.

    Бакеты считаются через PostgreSQL `date_trunc(:group_by, created_at AT TIME ZONE 'Europe/Moscow')`.
    Пустые интервалы заполняются нулями, чтобы area chart не рвался.
    """
    start_utc = _to_utc(start)
    end_utc = _to_utc(end)

    bucket_expr = func.date_trunc(
        group_by,
        func.timezone("Europe/Moscow", Order.created_at),
    )
    total_expr = func.coalesce(func.sum(Order.total), 0)
    count_expr = func.count()

    rows = session.exec(
        select(bucket_expr, count_expr, total_expr)
        .where(col(Order.created_at) >= start_utc)
        .where(col(Order.created_at) < end_utc)
        .group_by(bucket_expr)
        .order_by(bucket_expr)
    ).all()

    data: dict[datetime, tuple[int, Decimal]] = {}
    for bucket, count, total in rows:
        if bucket is None:
            continue
        # date_trunc возвращает naive datetime (по МСК) — навешиваем tz.
        naive = bucket if bucket.tzinfo is None else bucket.replace(tzinfo=None)
        data[naive] = (int(count), Decimal(total))

    points: list[OrderStatsBucket] = []
    cursor = _truncate_to_bucket(
        start.astimezone(STATS_TZ).replace(tzinfo=None), group_by
    )
    boundary = end.astimezone(STATS_TZ).replace(tzinfo=None)
    while cursor < boundary:
        count, total = data.get(cursor, (0, Decimal("0")))
        average = _quantize_money(total / count) if count else Decimal("0.00")
        points.append(
            OrderStatsBucket(
                bucket=cursor.replace(tzinfo=STATS_TZ),
                count=count,
                total=_quantize_money(total),
                average=average,
            )
        )
        cursor = _next_bucket(cursor, group_by)

    summary_row = session.exec(
        select(count_expr, total_expr)
        .where(col(Order.created_at) >= start_utc)
        .where(col(Order.created_at) < end_utc)
    ).one()
    total_count = int(summary_row[0])
    total_sum = Decimal(summary_row[1])
    summary = OrderStatsSummary(
        count=total_count,
        total=_quantize_money(total_sum),
        average=_quantize_money(total_sum / total_count)
        if total_count
        else Decimal("0.00"),
    )

    return OrderStatsResponse(
        group_by=group_by,
        start=start,
        end=end,
        points=points,
        summary=summary,
    )
