import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.size import create_random_size


def test_create_size(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"name": "Large"}
    response = client.post(
        f"{settings.API_V1_STR}/sizes/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert "id" in content


def test_create_size_duplicate_name(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    size = create_random_size(db)
    data = {"name": size.name}
    response = client.post(
        f"{settings.API_V1_STR}/sizes/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 400


def test_read_sizes(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_size(db)
    create_random_size(db)
    response = client.get(
        f"{settings.API_V1_STR}/sizes/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2


def test_read_size(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    size = create_random_size(db)
    response = client.get(
        f"{settings.API_V1_STR}/sizes/{size.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == size.name


def test_read_size_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/sizes/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404


def test_update_size(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    size = create_random_size(db)
    data = {"name": "Updated Size"}
    response = client.put(
        f"{settings.API_V1_STR}/sizes/{size.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]


def test_delete_size(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    size = create_random_size(db)
    response = client.delete(
        f"{settings.API_V1_STR}/sizes/{size.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Size deleted successfully"


def test_delete_size_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/sizes/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
