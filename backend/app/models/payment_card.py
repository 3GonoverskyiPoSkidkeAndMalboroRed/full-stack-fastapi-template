import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.user import get_datetime_utc

if TYPE_CHECKING:
    from app.models.user import User


# Raw card input from the client. NEVER persisted as-is: only masked
# fields (brand, last4, expiry, cardholder name) are stored.
# Card number / expiry / CVC accept any digits; only the cardholder name is
# validated downstream (Latin letters).
class PaymentCardCreate(SQLModel):
    card_number: str = Field(min_length=1, max_length=23)
    exp_month: int
    exp_year: int
    cvc: str = Field(min_length=1, max_length=8)
    cardholder_name: str = Field(min_length=1, max_length=255)


# Masked, storable representation of a card.
class PaymentCardBase(SQLModel):
    brand: str = Field(max_length=32)
    last4: str = Field(max_length=4)
    exp_month: int
    exp_year: int
    cardholder_name: str = Field(max_length=255)


class PaymentCard(PaymentCardBase, table=True):
    __tablename__ = "payment_card"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    user: Optional["User"] = Relationship(back_populates="payment_cards")


class PaymentCardPublic(PaymentCardBase):
    id: uuid.UUID
    created_at: datetime | None = None


class PaymentCardsPublic(SQLModel):
    data: list[PaymentCardPublic]
    count: int
