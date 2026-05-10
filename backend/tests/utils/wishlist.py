from sqlmodel import Session

from app import crud
from app.models import Item, User, WishlistItem
from tests.utils.item import create_random_item
from tests.utils.user import create_random_user


def create_random_wishlist_item(
    db: Session,
    *,
    user: User | None = None,
    item: Item | None = None,
) -> WishlistItem:
    if user is None:
        user = create_random_user(db)
    if item is None:
        item = create_random_item(db)
    return crud.add_to_wishlist(session=db, user_id=user.id, item_id=item.id)
