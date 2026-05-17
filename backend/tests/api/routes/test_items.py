import io
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Item
from tests.utils.category import create_random_category
from tests.utils.item import create_random_item
from tests.utils.size import create_random_size

_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xfc\xff\xff?\x00\x05\xfe\x02\xfe\xa75\x81"
    b"\x84\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_create_item(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Foo", "description": "Fighters"}
    response = client.post(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert "id" in content
    assert "owner_id" in content


def test_read_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.get(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == item.title
    assert content["description"] == item.description
    assert content["id"] == str(item.id)
    assert content["owner_id"] == str(item.owner_id)


def test_read_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_read_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.get(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


def test_read_items(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_item(db)
    create_random_item(db)
    response = client.get(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2


def test_update_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert content["id"] == str(item.id)
    assert content["owner_id"] == str(item.owner_id)


def test_update_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_update_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


def test_delete_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.delete(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Item deleted successfully"


def test_delete_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_delete_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.delete(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


def test_create_item_with_new_fields(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    category = create_random_category(db)
    size = create_random_size(db)
    data = {
        "title": "Foo",
        "description": "Fighters",
        "size_id": str(size.id),
        "brand": "TestBrand",
        "cost": "19.99",
        "category_id": str(category.id),
    }
    response = client.post(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["size_id"] == data["size_id"]
    assert content["brand"] == data["brand"]
    assert content["cost"] == data["cost"]
    assert content["category_id"] == data["category_id"]


def test_create_item_with_invalid_category(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Foo", "category_id": str(uuid.uuid4())}
    response = client.post(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 404


def test_create_item_with_invalid_size(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Foo", "size_id": str(uuid.uuid4())}
    response = client.post(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 404


def test_read_items_public_no_auth(client: TestClient, db: Session) -> None:
    create_random_item(db)
    response = client.get(f"{settings.API_V1_STR}/items/public")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["count"] >= 1


def test_read_items_public_filter_by_category(
    client: TestClient, db: Session
) -> None:
    item = create_random_item(db)
    response = client.get(
        f"{settings.API_V1_STR}/items/public",
        params={"category_id": str(item.category_id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] >= 1
    for entry in body["data"]:
        assert entry["category_id"] == str(item.category_id)


def test_read_item_public_no_auth(client: TestClient, db: Session) -> None:
    item = create_random_item(db)
    response = client.get(f"{settings.API_V1_STR}/items/public/{item.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(item.id)


def test_read_item_public_not_found(client: TestClient) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/items/public/{uuid.uuid4()}"
    )
    assert response.status_code == 404


def test_upload_item_photos_creates_paths_and_files(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.post(
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=superuser_token_headers,
        files=[
            ("files", ("first.png", io.BytesIO(_PNG_BYTES), "image/png")),
            ("files", ("second.png", io.BytesIO(_PNG_BYTES), "image/png")),
        ],
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["images"]) == 2
    for relative in body["images"]:
        assert relative.startswith(f"{settings.ITEM_PHOTO_DIR_NAME}/")
        assert (settings.STATIC_DIR / relative).is_file()


def test_upload_appends_to_same_directory(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    client.post(
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=superuser_token_headers,
        files=[("files", ("a.png", io.BytesIO(_PNG_BYTES), "image/png"))],
    )
    response = client.post(
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=superuser_token_headers,
        files=[("files", ("b.png", io.BytesIO(_PNG_BYTES), "image/png"))],
    )
    body = response.json()
    assert len(body["images"]) == 2
    parents = {Path(p).parent for p in body["images"]}
    assert len(parents) == 1


def test_upload_invalid_mime_returns_415(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.post(
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=superuser_token_headers,
        files=[("files", ("x.txt", io.BytesIO(b"hello"), "text/plain"))],
    )
    assert response.status_code == 415


def test_upload_oversize_returns_413(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    big = b"\x00" * (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 1)
    response = client.post(
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=superuser_token_headers,
        files=[("files", ("big.png", io.BytesIO(big), "image/png"))],
    )
    assert response.status_code == 413


def test_upload_other_user_item_forbidden(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.post(
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=normal_user_token_headers,
        files=[("files", ("x.png", io.BytesIO(_PNG_BYTES), "image/png"))],
    )
    assert response.status_code == 403


def test_delete_item_photo_removes_file_and_path(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    upload = client.post(
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=superuser_token_headers,
        files=[("files", ("a.png", io.BytesIO(_PNG_BYTES), "image/png"))],
    )
    photo_path = upload.json()["images"][0]
    absolute = settings.STATIC_DIR / photo_path
    assert absolute.is_file()

    response = client.request(
        "DELETE",
        f"{settings.API_V1_STR}/items/{item.id}/photos",
        headers=superuser_token_headers,
        params={"path": photo_path},
    )
    assert response.status_code == 200
    assert response.json()["images"] == []
    assert not absolute.exists()


def test_delete_item_removes_directory(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    item_id = item.id
    upload = client.post(
        f"{settings.API_V1_STR}/items/{item_id}/photos",
        headers=superuser_token_headers,
        files=[("files", ("a.png", io.BytesIO(_PNG_BYTES), "image/png"))],
    )
    photo_path = upload.json()["images"][0]
    photo_dir = (settings.STATIC_DIR / photo_path).parent
    assert photo_dir.is_dir()

    response = client.delete(
        f"{settings.API_V1_STR}/items/{item_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    assert not photo_dir.exists()
    db.expire_all()
    assert db.get(Item, item_id) is None
