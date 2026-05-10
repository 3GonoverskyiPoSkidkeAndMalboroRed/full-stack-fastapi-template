from sqlmodel import Session

from app import crud
from app.models import Size, SizeCreate
from tests.utils.utils import random_lower_string


def create_random_size(db: Session) -> Size:
    name = random_lower_string()
    size_in = SizeCreate(name=name)
    return crud.create_size(session=db, size_in=size_in)
