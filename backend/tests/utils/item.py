from decimal import Decimal

from sqlmodel import Session

from app import crud
from app.models import Item, ItemCreate
from tests.utils.brand import create_random_brand
from tests.utils.category import create_random_category
from tests.utils.size import create_random_size
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def create_random_item(db: Session) -> Item:
    user = create_random_user(db)
    owner_id = user.id
    assert owner_id is not None
    title = random_lower_string()
    description = random_lower_string()
    size = create_random_size(db)
    brand = create_random_brand(db)
    cost = Decimal("19.99")
    category = create_random_category(db)
    item_in = ItemCreate(
        title=title,
        description=description,
        size_id=size.id,
        brand_id=brand.id,
        cost=cost,
        category_id=category.id,
    )
    return crud.create_item(session=db, item_in=item_in, owner_id=owner_id)
