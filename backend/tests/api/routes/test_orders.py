import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import CartItem, CartItemCreate, Item, OrderStatus
from tests.utils.item import create_random_item
from tests.utils.order import create_random_order
from tests.utils.user import create_random_user


def _ensure_stock(db: Session, item_id: uuid.UUID, stock: int) -> None:
    item = db.get(Item, item_id)
    assert item is not None
    item.stock = stock
    db.add(item)
    db.commit()


def _checkout_payload() -> dict[str, str]:
    return {
        "recipient_name": "Иван Иванов",
        "phone": "+71234567890",
        "address": "г. Москва, ул. Тверская, 1",
        "comment": None,  # type: ignore[dict-item]
    }


def test_create_order_empty_cart(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    # Ensure cart is empty for the test user
    user = crud.get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    crud.clear_cart(session=db, user_id=user.id)

    r = client.post(
        f"{settings.API_V1_STR}/orders/",
        json=_checkout_payload(),
        headers=normal_user_token_headers,
    )
    assert r.status_code == 400


def test_create_order_insufficient_stock(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    user = crud.get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    crud.clear_cart(session=db, user_id=user.id)

    item = create_random_item(db)
    _ensure_stock(db, item.id, 5)
    crud.add_to_cart(
        session=db,
        user_id=user.id,
        payload=CartItemCreate(item_id=item.id, quantity=2),
    )
    # drop stock below requested quantity
    _ensure_stock(db, item.id, 1)

    r = client.post(
        f"{settings.API_V1_STR}/orders/",
        json=_checkout_payload(),
        headers=normal_user_token_headers,
    )
    assert r.status_code == 400


def test_create_order_success(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    user = crud.get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    crud.clear_cart(session=db, user_id=user.id)

    item = create_random_item(db)
    _ensure_stock(db, item.id, 10)
    initial_stock = 10
    crud.add_to_cart(
        session=db,
        user_id=user.id,
        payload=CartItemCreate(item_id=item.id, quantity=3),
    )

    r = client.post(
        f"{settings.API_V1_STR}/orders/",
        json=_checkout_payload(),
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == OrderStatus.NEW.value
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 3
    assert body["items"][0]["title_snapshot"] == item.title
    expected_total = (item.cost or Decimal("0")) * 3
    assert Decimal(body["total"]) == expected_total

    db.refresh(item)
    assert item.stock == initial_stock - 3

    # cart cleared
    cart_items = (
        db.query(CartItem).filter(CartItem.user_id == user.id).all()  # type: ignore[attr-defined]
    )
    assert cart_items == []


def test_list_orders_user_only_sees_own(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    other = create_random_user(db)
    create_random_order(db, user=other)

    r = client.get(
        f"{settings.API_V1_STR}/orders/", headers=normal_user_token_headers
    )
    assert r.status_code == 200
    body = r.json()
    user = crud.get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    for order in body["data"]:
        assert order["user_id"] == str(user.id)


def test_list_orders_superuser_sees_all(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    other = create_random_user(db)
    create_random_order(db, user=other)

    r = client.get(
        f"{settings.API_V1_STR}/orders/", headers=superuser_token_headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1


def test_read_order_forbidden_for_others(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    other = create_random_user(db)
    order = create_random_order(db, user=other)

    r = client.get(
        f"{settings.API_V1_STR}/orders/{order.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403


def test_update_status_requires_superuser(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    user = crud.get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    order = create_random_order(db, user=user, status=OrderStatus.NEW)

    r = client.patch(
        f"{settings.API_V1_STR}/orders/{order.id}/status",
        json={"status": "PROCESSED"},
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403


def test_update_status_happy_path(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    user = create_random_user(db)
    order = create_random_order(db, user=user, status=OrderStatus.NEW)
    r = client.patch(
        f"{settings.API_V1_STR}/orders/{order.id}/status",
        json={"status": "PROCESSED"},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "PROCESSED"


def test_update_status_invalid_transition(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    user = create_random_user(db)
    order = create_random_order(db, user=user, status=OrderStatus.NEW)
    # NEW -> PAID skips PROCESSED, must fail
    r = client.patch(
        f"{settings.API_V1_STR}/orders/{order.id}/status",
        json={"status": "PAID"},
        headers=superuser_token_headers,
    )
    assert r.status_code == 400


def test_update_status_rollback_forbidden(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    user = create_random_user(db)
    order = create_random_order(db, user=user, status=OrderStatus.PROCESSED)
    r = client.patch(
        f"{settings.API_V1_STR}/orders/{order.id}/status",
        json={"status": "NEW"},
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
