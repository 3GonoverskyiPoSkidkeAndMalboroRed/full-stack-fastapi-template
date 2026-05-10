import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from tests.utils.item import create_random_item
from tests.utils.user import create_random_user


def test_add_wishlist_idempotent(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    item = create_random_item(db)
    payload = {"item_id": str(item.id)}
    r1 = client.post(
        f"{settings.API_V1_STR}/wishlist/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert r1.status_code == 200
    r2 = client.post(
        f"{settings.API_V1_STR}/wishlist/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


def test_add_wishlist_item_not_found(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/wishlist/",
        json={"item_id": str(uuid.uuid4())},
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


def test_delete_wishlist_forbidden(
    client: TestClient,
    db: Session,
    normal_user_token_headers: dict[str, str],
) -> None:
    other_user = create_random_user(db)
    item = create_random_item(db)
    wishlist_item = crud.add_to_wishlist(
        session=db, user_id=other_user.id, item_id=item.id
    )
    r = client.delete(
        f"{settings.API_V1_STR}/wishlist/{wishlist_item.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
