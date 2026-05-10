import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime, Numeric
from sqlmodel import Field, Relationship, SQLModel

from app.models.user import get_datetime_utc

if TYPE_CHECKING:
    from app.models.cart import CartItem
    from app.models.category import Category
    from app.models.order_item import OrderItem
    from app.models.size import Size
    from app.models.user import User
    from app.models.wishlist import WishlistItem


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    size_id: uuid.UUID | None = Field(
        default=None, foreign_key="size.id", ondelete="SET NULL"
    )
    brand: str | None = Field(default=None, max_length=255)
    category_id: uuid.UUID | None = Field(default=None, foreign_key="category.id")
    image_url: str | None = Field(default=None, max_length=2048)
    stock: int = Field(default=0, ge=0)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    cost: Decimal | None = Field(default=None)


# Properties to receive on item update
class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    size_id: uuid.UUID | None = Field(
        default=None, foreign_key="size.id", ondelete="SET NULL"
    )
    brand: str | None = Field(default=None, max_length=255)
    cost: Decimal | None = Field(default=None)
    category_id: uuid.UUID | None = Field(default=None, foreign_key="category.id")
    image_url: str | None = Field(default=None, max_length=2048)
    stock: int | None = Field(default=None, ge=0)


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    cost: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(8, 2), nullable=True),
    )
    owner: Optional["User"] = Relationship(back_populates="items")
    category: Optional["Category"] = Relationship(back_populates="items")
    size: Optional["Size"] = Relationship(back_populates="items")
    cart_items: list["CartItem"] = Relationship(
        back_populates="item", cascade_delete=True
    )
    wishlist_items: list["WishlistItem"] = Relationship(
        back_populates="item", cascade_delete=True
    )
    order_items: list["OrderItem"] = Relationship(back_populates="item")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    cost: Decimal | None = None
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int
