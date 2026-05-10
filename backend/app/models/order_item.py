import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, Numeric
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.item import Item
    from app.models.order import Order


class OrderItem(SQLModel, table=True):
    __tablename__ = "orderitem"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_id: uuid.UUID = Field(
        foreign_key="shop_order.id", nullable=False, ondelete="CASCADE", index=True
    )
    item_id: uuid.UUID | None = Field(
        default=None, foreign_key="item.id", ondelete="SET NULL", index=True
    )
    title_snapshot: str = Field(max_length=255)
    price_snapshot: Decimal = Field(
        sa_column=Column(Numeric(8, 2), nullable=False),
    )
    quantity: int = Field(default=1, ge=1)
    order: Optional["Order"] = Relationship(back_populates="items")
    item: Optional["Item"] = Relationship(back_populates="order_items")
