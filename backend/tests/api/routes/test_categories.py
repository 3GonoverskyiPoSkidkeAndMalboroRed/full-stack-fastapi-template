import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.category import create_random_category


def test_create_category(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"name": "Electronics"}
    response = client.post(
        f"{settings.API_V1_STR}/categories/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert "id" in content


def test_create_category_duplicate_name(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    category = create_random_category(db)
    data = {"name": category.name}
    response = client.post(
        f"{settings.API_V1_STR}/categories/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 400


def test_read_categories(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_category(db)
    create_random_category(db)
    response = client.get(
        f"{settings.API_V1_STR}/categories/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2


def test_read_category(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    category = create_random_category(db)
    response = client.get(
        f"{settings.API_V1_STR}/categories/{category.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == category.name


def test_read_category_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/categories/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404


def test_update_category(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    category = create_random_category(db)
    data = {"name": "Updated Category"}
    response = client.put(
        f"{settings.API_V1_STR}/categories/{category.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]


def test_delete_category(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    category = create_random_category(db)
    response = client.delete(
        f"{settings.API_V1_STR}/categories/{category.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Category deleted successfully"


def test_delete_category_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/categories/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
