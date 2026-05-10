import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from app.models.item import ItemPublic
from app.models.user import get_datetime_utc

if TYPE_CHECKING:
    from app.models.item import Item
    from app.models.user import User


class CartItemBase(SQLModel):
    quantity: int = Field(default=1, ge=1, le=999)


class CartItemCreate(SQLModel):
    item_id: uuid.UUID
    quantity: int = Field(default=1, ge=1, le=999)


class CartItemUpdate(SQLModel):
    quantity: int = Field(ge=1, le=999)


class CartItem(CartItemBase, table=True):
    __tablename__ = "cartitem"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_cart_user_item"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    item_id: uuid.UUID = Field(
        foreign_key="item.id", nullable=False, ondelete="CASCADE", index=True
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    user: Optional["User"] = Relationship(back_populates="cart_items")
    item: Optional["Item"] = Relationship(back_populates="cart_items")


class CartItemPublic(CartItemBase):
    id: uuid.UUID
    item_id: uuid.UUID
    item: ItemPublic | None = None
    created_at: datetime | None = None


class CartItemsPublic(SQLModel):
    data: list[CartItemPublic]
    count: int
    subtotal: Decimal
