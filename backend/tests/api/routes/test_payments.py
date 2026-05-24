import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import Item, OrderStatus
from app.payments import CardValidationError, detect_brand, mask_card
from tests.utils.order import create_random_order

VISA = "4242424242424242"


def _test_user_id(db: Session) -> uuid.UUID:
    user = crud.get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    return user.id


def _new_card_payload() -> dict[str, object]:
    return {
        "card_number": VISA,
        "exp_month": 12,
        "exp_year": datetime.now(timezone.utc).year + 3,
        "cvc": "123",
        "cardholder_name": "IVAN IVANOV",
    }


# --- pure helpers ---


def test_detect_brand() -> None:
    assert detect_brand(VISA) == "Visa"
    assert detect_brand("5111111111111111") == "Mastercard"


def test_mask_card_keeps_only_masked_fields() -> None:
    masked = mask_card(
        card_number="4242 4242 4242 4242",
        exp_month=10,
        exp_year=datetime.now(timezone.utc).year + 2,
        cardholder_name="John Doe",
    )
    assert masked.last4 == "4242"
    assert masked.brand == "Visa"
    assert not hasattr(masked, "card_number")
    assert not hasattr(masked, "cvc")


def test_mask_card_accepts_any_digits() -> None:
    # non-Luhn, "expired", short — all accepted now
    masked = mask_card(
        card_number="1111",
        exp_month=99,
        exp_year=2000,
        cardholder_name="John Doe",
    )
    assert masked.last4 == "1111"


def test_mask_card_rejects_non_latin_name() -> None:
    with pytest.raises(CardValidationError):
        mask_card(
            card_number=VISA,
            exp_month=12,
            exp_year=2030,
            cardholder_name="Иван Иванов",
        )


# --- payment cards endpoints ---


def test_create_card_stores_only_masked(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/payment-cards/",
        json=_new_card_payload(),
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["last4"] == "4242"
    assert body["brand"] == "Visa"
    # full PAN / cvc must never be returned or stored
    assert "card_number" not in body
    assert "cvc" not in body


def test_create_card_accepts_any_digits(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    payload = _new_card_payload()
    payload["card_number"] = "1111111111111111"  # non-Luhn — accepted now
    payload["exp_month"] = 99
    r = client.post(
        f"{settings.API_V1_STR}/payment-cards/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["last4"] == "1111"


def test_create_card_rejects_non_latin_name(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    payload = _new_card_payload()
    payload["cardholder_name"] = "Иван Иванов"
    r = client.post(
        f"{settings.API_V1_STR}/payment-cards/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert r.status_code == 400


def test_list_and_delete_card(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    created = client.post(
        f"{settings.API_V1_STR}/payment-cards/",
        json=_new_card_payload(),
        headers=normal_user_token_headers,
    ).json()

    listed = client.get(
        f"{settings.API_V1_STR}/payment-cards/", headers=normal_user_token_headers
    )
    assert listed.status_code == 200
    assert any(c["id"] == created["id"] for c in listed.json()["data"])

    deleted = client.delete(
        f"{settings.API_V1_STR}/payment-cards/{created['id']}",
        headers=normal_user_token_headers,
    )
    assert deleted.status_code == 200


# --- order payment flow ---


def test_pay_order_with_new_card(
    client: TestClient, db: Session, normal_user_token_headers: dict[str, str]
) -> None:
    order = create_random_order(db, status=OrderStatus.NEW)
    # reassign order to the authenticated test user
    order.user_id = _test_user_id(db)
    db.add(order)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/orders/{order.id}/pay",
        json={"card": _new_card_payload(), "save_card": True},
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == OrderStatus.PAID.value
    assert body["card_last4"] == "4242"
    assert body["paid_at"] is not None


def test_pay_order_rejects_non_new(
    client: TestClient, db: Session, normal_user_token_headers: dict[str, str]
) -> None:
    order = create_random_order(db, status=OrderStatus.PAID)
    order.user_id = _test_user_id(db)
    db.add(order)
    db.commit()
    r = client.post(
        f"{settings.API_V1_STR}/orders/{order.id}/pay",
        json={"card": _new_card_payload()},
        headers=normal_user_token_headers,
    )
    assert r.status_code == 400


def test_receive_order(
    client: TestClient, db: Session, normal_user_token_headers: dict[str, str]
) -> None:
    order = create_random_order(db, status=OrderStatus.DELIVERED)
    order.user_id = _test_user_id(db)
    db.add(order)
    db.commit()
    r = client.post(
        f"{settings.API_V1_STR}/orders/{order.id}/receive",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == OrderStatus.RECEIVED.value


def test_refund_within_window_restores_stock(
    client: TestClient, db: Session, normal_user_token_headers: dict[str, str]
) -> None:
    order = create_random_order(db, status=OrderStatus.RECEIVED, with_items=1)
    order.user_id = _test_user_id(db)
    order.received_at = datetime.now(timezone.utc)
    db.add(order)
    db.commit()
    db.refresh(order)

    item_id = order.items[0].item_id
    assert item_id is not None
    item = db.get(Item, item_id)
    assert item is not None
    stock_before = item.stock

    r = client.post(
        f"{settings.API_V1_STR}/orders/{order.id}/refund",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == OrderStatus.REFUNDED.value
    db.refresh(item)
    assert item.stock == stock_before + order.items[0].quantity


def test_refund_outside_window_rejected(
    client: TestClient, db: Session, normal_user_token_headers: dict[str, str]
) -> None:
    order = create_random_order(db, status=OrderStatus.RECEIVED)
    order.user_id = _test_user_id(db)
    order.received_at = datetime.now(timezone.utc) - timedelta(days=20)
    db.add(order)
    db.commit()
    r = client.post(
        f"{settings.API_V1_STR}/orders/{order.id}/refund",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 400
