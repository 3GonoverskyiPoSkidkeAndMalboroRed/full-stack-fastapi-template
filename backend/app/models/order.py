import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Literal, Optional

from sqlalchemy import Column, DateTime, Numeric
from sqlmodel import Field, Relationship, SQLModel

from app.models.payment_card import PaymentCardCreate
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
    RECEIVED = "RECEIVED"
    REFUNDED = "REFUNDED"
    CANCELLED = "CANCELLED"


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


class OrderCancel(SQLModel):
    reason: str = Field(min_length=1, max_length=500)


class OrderPay(SQLModel):
    # Pay with a previously saved card...
    card_id: uuid.UUID | None = None
    # ...or with a new card (raw data, never stored — only masked fields persist).
    card: PaymentCardCreate | None = None
    save_card: bool = False


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
    cancellation_reason: str | None = Field(default=None, max_length=500)
    paid_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    received_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    refunded_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    card_last4: str | None = Field(default=None, max_length=4)
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
    cancellation_reason: str | None = None
    paid_at: datetime | None = None
    received_at: datetime | None = None
    refunded_at: datetime | None = None
    card_last4: str | None = None
    created_at: datetime | None = None
    items: list[OrderItemPublic] = []


class OrdersPublic(SQLModel):
    data: list[OrderPublic]
    count: int


OrderStatsGroupBy = Literal["hour", "day", "month"]


class OrderStatsBucket(SQLModel):
    bucket: datetime
    count: int
    total: Decimal
    average: Decimal


class OrderStatsSummary(SQLModel):
    count: int
    total: Decimal
    average: Decimal


class OrderStatsResponse(SQLModel):
    group_by: OrderStatsGroupBy
    start: datetime
    end: datetime
    points: list[OrderStatsBucket]
    summary: OrderStatsSummary
