import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.item import Item


class SizeBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)


class SizeCreate(SizeBase):
    pass


class SizeUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class Size(SizeBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    items: list["Item"] = Relationship(back_populates="size")


class SizePublic(SizeBase):
    id: uuid.UUID


class SizesPublic(SQLModel):
    data: list[SizePublic]
    count: int
