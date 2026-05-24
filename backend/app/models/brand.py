import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.item import Item


# Shared properties
class BrandBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)


# Properties to receive via API on creation
class BrandCreate(BrandBase):
    pass


# Properties to receive via API on update
class BrandUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


# Database model for Brand
class Brand(BrandBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    items: list["Item"] = Relationship(back_populates="brand")


# Properties to return via API
class BrandPublic(BrandBase):
    id: uuid.UUID


class BrandsPublic(SQLModel):
    data: list[BrandPublic]
    count: int
