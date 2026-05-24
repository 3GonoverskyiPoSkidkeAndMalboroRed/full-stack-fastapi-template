import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.brand import create_random_brand
from tests.utils.utils import random_lower_string


def test_create_brand(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"name": random_lower_string()}
    response = client.post(
        f"{settings.API_V1_STR}/brands/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert "id" in content


def test_create_brand_duplicate_name(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    data = {"name": brand.name}
    response = client.post(
        f"{settings.API_V1_STR}/brands/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 400


def test_read_brands(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_brand(db)
    create_random_brand(db)
    response = client.get(
        f"{settings.API_V1_STR}/brands/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2


def test_read_brand(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    response = client.get(
        f"{settings.API_V1_STR}/brands/{brand.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == brand.name


def test_read_brand_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/brands/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404


def test_update_brand(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    data = {"name": "Updated Brand"}
    response = client.put(
        f"{settings.API_V1_STR}/brands/{brand.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]


def test_delete_brand(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    brand = create_random_brand(db)
    response = client.delete(
        f"{settings.API_V1_STR}/brands/{brand.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Brand deleted successfully"


def test_delete_brand_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/brands/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
