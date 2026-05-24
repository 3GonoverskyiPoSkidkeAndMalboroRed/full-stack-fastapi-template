import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import CartItem, CartItemCreate, Item, Order, OrderStatus
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
    order = create_random_order(db, user=user, status=OrderStatus.PAID)
    r = client.patch(
        f"{settings.API_V1_STR}/orders/{order.id}/status",
        json={"status": "SHIPPED"},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "SHIPPED"


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


# --- Order stats endpoint ---

MSK = ZoneInfo("Europe/Moscow")


def _set_order_created_at(db: Session, order: Order, dt: datetime) -> None:
    order.created_at = dt
    db.add(order)
    db.commit()
    db.refresh(order)


def test_orders_stats_requires_superuser(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/orders/stats",
        params={
            "start": "2024-01-01T00:00:00+00:00",
            "end": "2024-01-02T00:00:00+00:00",
            "group_by": "day",
        },
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403


def test_orders_stats_rejects_inverted_range(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/orders/stats",
        params={
            "start": "2024-01-02T00:00:00+00:00",
            "end": "2024-01-01T00:00:00+00:00",
            "group_by": "day",
        },
        headers=superuser_token_headers,
    )
    assert r.status_code == 400


def test_orders_stats_rejects_too_wide_hour_range(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/orders/stats",
        params={
            "start": "2024-01-01T00:00:00+00:00",
            "end": "2024-03-01T00:00:00+00:00",
            "group_by": "hour",
        },
        headers=superuser_token_headers,
    )
    assert r.status_code == 400


def test_orders_stats_aggregates_by_hour_in_moscow_tz(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    user = create_random_user(db)
    # Базовая дата — 2024-01-15, далеко от тестового шума.
    msk_day = datetime(2024, 1, 15, tzinfo=MSK)

    o1 = create_random_order(db, user=user, status=OrderStatus.NEW)
    _set_order_created_at(
        db, o1, msk_day.replace(hour=10, minute=30).astimezone(timezone.utc)
    )
    o2 = create_random_order(db, user=user, status=OrderStatus.PAID)
    _set_order_created_at(
        db, o2, msk_day.replace(hour=10, minute=45).astimezone(timezone.utc)
    )
    o3 = create_random_order(db, user=user, status=OrderStatus.CANCELLED)
    _set_order_created_at(
        db, o3, msk_day.replace(hour=14).astimezone(timezone.utc)
    )

    start = msk_day
    end = msk_day + timedelta(days=1)
    r = client.get(
        f"{settings.API_V1_STR}/orders/stats",
        params={
            "start": start.isoformat(),
            "end": end.isoformat(),
            "group_by": "hour",
        },
        headers=superuser_token_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["group_by"] == "hour"
    assert len(body["points"]) == 24

    by_hour = {datetime.fromisoformat(p["bucket"]).hour: p for p in body["points"]}
    assert by_hour[10]["count"] == 2
    assert by_hour[14]["count"] == 1
    assert by_hour[9]["count"] == 0  # пустой бакет заполнен нулём

    expected_total = (
        Decimal(o1.total) + Decimal(o2.total) + Decimal(o3.total)
    )
    assert Decimal(body["summary"]["total"]) == expected_total.quantize(Decimal("0.01"))
    assert body["summary"]["count"] == 3


def test_orders_stats_aggregates_by_day(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    user = create_random_user(db)
    msk_day = datetime(2024, 2, 1, tzinfo=MSK)

    o1 = create_random_order(db, user=user)
    _set_order_created_at(
        db, o1, msk_day.replace(hour=12).astimezone(timezone.utc)
    )
    o2 = create_random_order(db, user=user)
    _set_order_created_at(
        db, o2, (msk_day + timedelta(days=2, hours=8)).astimezone(timezone.utc)
    )

    start = msk_day
    end = msk_day + timedelta(days=5)
    r = client.get(
        f"{settings.API_V1_STR}/orders/stats",
        params={
            "start": start.isoformat(),
            "end": end.isoformat(),
            "group_by": "day",
        },
        headers=superuser_token_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["points"]) == 5

    counts = [p["count"] for p in body["points"]]
    assert counts == [1, 0, 1, 0, 0]
