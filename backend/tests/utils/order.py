from decimal import Decimal

from sqlmodel import Session

from app.models import Order, OrderItem, OrderStatus, User
from tests.utils.item import create_random_item
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def create_random_order(
    db: Session,
    *,
    user: User | None = None,
    status: OrderStatus = OrderStatus.NEW,
    with_items: int = 2,
) -> Order:
    if user is None:
        user = create_random_user(db)

    order = Order(
        recipient_name=random_lower_string()[:32],
        phone="+71234567890",
        address=f"г. Москва, ул. {random_lower_string()[:16]}",
        comment=None,
        user_id=user.id,
        status=status,
        total=Decimal("0"),
    )
    db.add(order)
    db.flush()

    total = Decimal("0")
    for _ in range(with_items):
        item = create_random_item(db)
        price = item.cost if item.cost is not None else Decimal("0")
        order_item = OrderItem(
            order_id=order.id,
            item_id=item.id,
            title_snapshot=item.title,
            price_snapshot=price,
            quantity=1,
        )
        db.add(order_item)
        total += price

    order.total = total
    db.add(order)
    db.commit()
    db.refresh(order)
    return order
