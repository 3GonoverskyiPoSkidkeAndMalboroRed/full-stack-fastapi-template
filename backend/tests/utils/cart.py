from sqlmodel import Session

from app import crud
from app.models import CartItem, CartItemCreate, Item, User
from tests.utils.item import create_random_item
from tests.utils.user import create_random_user


def create_random_cart_item(
    db: Session,
    *,
    user: User | None = None,
    item: Item | None = None,
    quantity: int = 1,
) -> CartItem:
    if user is None:
        user = create_random_user(db)
    if item is None:
        item = create_random_item(db)
        # ensure stock is sufficient for tests
        item.stock = max(item.stock, quantity + 5)
        db.add(item)
        db.commit()
        db.refresh(item)
    payload = CartItemCreate(item_id=item.id, quantity=quantity)
    return crud.add_to_cart(session=db, user_id=user.id, payload=payload)
