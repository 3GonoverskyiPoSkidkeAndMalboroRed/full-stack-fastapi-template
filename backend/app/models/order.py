import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime, Numeric
from sqlmodel import Field, Relationship, SQLModel

from app.models.user import get_datetime_utc

if TYPE_CHECKING:
    from app.models.order_item import OrderItem
    from app.models.user import User


class OrderStatus(str, Enum):
    NEW = "NEW"
    PROCESSED = "PROCESSED"
    PAID = "PAID"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"


class OrderBase(SQLModel):
    recipient_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=32)
    address: str = Field(min_length=1, max_length=1024)
    comment: str | None = Field(default=None, max_length=2000)


class OrderCreate(SQLModel):
    recipient_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=32)
    address: str = Field(min_length=1, max_length=1024)
    comment: str | None = Field(default=None, max_length=2000)


class OrderUpdate(SQLModel):
    status: OrderStatus | None = None


class Order(OrderBase, table=True):
    __tablename__ = "shop_order"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    status: OrderStatus = Field(default=OrderStatus.NEW, index=True)
    total: Decimal = Field(
        sa_column=Column(Numeric(10, 2), nullable=False, default=0),
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    user: Optional["User"] = Relationship(back_populates="orders")
    items: list["OrderItem"] = Relationship(back_populates="order", cascade_delete=True)


class OrderItemPublic(SQLModel):
    id: uuid.UUID
    item_id: uuid.UUID | None
    title_snapshot: str
    price_snapshot: Decimal
    quantity: int


class OrderPublic(OrderBase):
    id: uuid.UUID
    user_id: uuid.UUID
    status: OrderStatus
    total: Decimal
    created_at: datetime | None = None
    items: list[OrderItemPublic] = []


class OrdersPublic(SQLModel):
    data: list[OrderPublic]
    count: int
