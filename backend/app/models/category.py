import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.item import Item


# Shared properties
class CategoryBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)


# Properties to receive via API on creation
class CategoryCreate(CategoryBase):
    pass


# Properties to receive via API on update
class CategoryUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


# Database model for Category
class Category(CategoryBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    items: list["Item"] = Relationship(back_populates="category")


# Properties to return via API
class CategoryPublic(CategoryBase):
    id: uuid.UUID


class CategoriesPublic(SQLModel):
    data: list[CategoryPublic]
    count: int
