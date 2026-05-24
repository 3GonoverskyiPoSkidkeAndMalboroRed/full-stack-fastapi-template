import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    PaymentCardCreate,
    PaymentCardPublic,
    PaymentCardsPublic,
)
from app.payments import CardValidationError, mask_card

router = APIRouter(prefix="/payment-cards", tags=["payment-cards"])


@router.get("/", response_model=PaymentCardsPublic)
def read_payment_cards(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    List the current user's saved (masked) cards.
    """
    cards, count = crud.list_payment_cards(session=session, user_id=current_user.id)
    return PaymentCardsPublic(
        data=[PaymentCardPublic.model_validate(c) for c in cards], count=count
    )


@router.post("/", response_model=PaymentCardPublic)
def create_payment_card(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    card_in: PaymentCardCreate,
) -> Any:
    """
    Save a new card. Only masked data is stored — the PAN and CVC are
    immediately discarded.
    """
    try:
        masked = mask_card(
            card_number=card_in.card_number,
            exp_month=card_in.exp_month,
            exp_year=card_in.exp_year,
            cardholder_name=card_in.cardholder_name,
        )
    except CardValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    card = crud.create_payment_card(
        session=session, user_id=current_user.id, masked=masked
    )
    return card


@router.delete("/{id}", response_model=Message)
def delete_payment_card(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Delete one of the current user's saved cards.
    """
    card = crud.get_payment_card(session=session, card_id=id, user_id=current_user.id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    crud.delete_payment_card(session=session, card=card)
    return Message(message="Card deleted successfully")
