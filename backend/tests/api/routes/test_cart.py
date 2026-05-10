import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import CartItemCreate, Item, UserCreate
from tests.utils.item import create_random_item
from tests.utils.user import authentication_token_from_email, create_random_user
from tests.utils.utils import random_email, random_lower_string


def _ensure_stock(db: Session, item_id: uuid.UUID, stock: int) -> None:
    item = db.get(Item, item_id)
    assert item is not None
    item.stock = stock
    db.add(item)
    db.commit()


def test_read_empty_cart(
    client: TestClient,
    db: Session,
) -> None:
    email = random_email()
    password = random_lower_string()
    crud.create_user(
        session=db, user_create=UserCreate(email=email, password=password)
    )
    headers = authentication_token_from_email(client=client, email=email, db=db)

    r = client.get(f"{settings.API_V1_STR}/cart/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    assert body["data"] == []
    assert Decimal(body["subtotal"]) == Decimal("0")


def test_add_to_cart_creates_and_increments(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    item = create_random_item(db)
    _ensure_stock(db, item.id, 10)

    payload = {"item_id": str(item.id), "quantity": 2}
    r = client.post(
        f"{settings.API_V1_STR}/cart/", json=payload, headers=normal_user_token_headers
    )
    assert r.status_code == 200, r.text
    first = r.json()
    assert first["quantity"] == 2

    r = client.post(
        f"{settings.API_V1_STR}/cart/", json=payload, headers=normal_user_token_headers
    )
    assert r.status_code == 200
    second = r.json()
    assert second["id"] == first["id"]
    assert second["quantity"] == 4


def test_add_to_cart_insufficient_stock(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    item = create_random_item(db)
    _ensure_stock(db, item.id, 1)

    r = client.post(
        f"{settings.API_V1_STR}/cart/",
        json={"item_id": str(item.id), "quantity": 5},
        headers=normal_user_token_headers,
    )
    assert r.status_code == 409


def test_add_to_cart_item_not_found(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/cart/",
        json={"item_id": str(uuid.uuid4()), "quantity": 1},
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


def test_update_cart_item_forbidden(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    other_user = create_random_user(db)
    item = create_random_item(db)
    _ensure_stock(db, item.id, 5)
    payload = CartItemCreate(item_id=item.id, quantity=1)
    cart_item = crud.add_to_cart(session=db, user_id=other_user.id, payload=payload)

    r = client.patch(
        f"{settings.API_V1_STR}/cart/{cart_item.id}",
        json={"quantity": 2},
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403


def test_delete_cart_item_forbidden(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    other_user = create_random_user(db)
    item = create_random_item(db)
    _ensure_stock(db, item.id, 5)
    payload = CartItemCreate(item_id=item.id, quantity=1)
    cart_item = crud.add_to_cart(session=db, user_id=other_user.id, payload=payload)

    r = client.delete(
        f"{settings.API_V1_STR}/cart/{cart_item.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403


def test_clear_cart(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    item = create_random_item(db)
    _ensure_stock(db, item.id, 10)
    client.post(
        f"{settings.API_V1_STR}/cart/",
        json={"item_id": str(item.id), "quantity": 1},
        headers=normal_user_token_headers,
    )
    r = client.delete(f"{settings.API_V1_STR}/cart/", headers=normal_user_token_headers)
    assert r.status_code == 200

    r = client.get(f"{settings.API_V1_STR}/cart/", headers=normal_user_token_headers)
    assert r.json()["count"] == 0
