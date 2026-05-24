from sqlmodel import Session

from app import crud
from app.models import Brand, BrandCreate
from tests.utils.utils import random_lower_string


def create_random_brand(db: Session) -> Brand:
    name = random_lower_string()
    brand_in = BrandCreate(name=name)
    return crud.create_brand(session=db, brand_in=brand_in)
