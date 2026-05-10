import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Message,
    Size,
    SizeCreate,
    SizePublic,
    SizesPublic,
    SizeUpdate,
)

router = APIRouter(prefix="/sizes", tags=["sizes"])


@router.get("/public", response_model=SizesPublic)
def read_sizes_public(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Public sizes listing — no authentication required.
    """
    count_statement = select(func.count()).select_from(Size)
    count = session.exec(count_statement).one()
    statement = select(Size).offset(skip).limit(limit)
    sizes = session.exec(statement).all()
    sizes_public = [SizePublic.model_validate(s) for s in sizes]
    return SizesPublic(data=sizes_public, count=count)


@router.get(
    "/",
    response_model=SizesPublic,
    dependencies=[Depends(get_current_user)],
)
def read_sizes(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve sizes.
    """
    count_statement = select(func.count()).select_from(Size)
    count = session.exec(count_statement).one()
    statement = select(Size).offset(skip).limit(limit)
    sizes = session.exec(statement).all()
    sizes_public = [SizePublic.model_validate(s) for s in sizes]
    return SizesPublic(data=sizes_public, count=count)


@router.get(
    "/{id}",
    response_model=SizePublic,
    dependencies=[Depends(get_current_user)],
)
def read_size(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get size by ID.
    """
    size = session.get(Size, id)
    if not size:
        raise HTTPException(status_code=404, detail="Size not found")
    return size


@router.post(
    "/",
    response_model=SizePublic,
    dependencies=[Depends(get_current_user)],
)
def create_size(
    *,
    session: SessionDep,
    size_in: SizeCreate,
) -> Any:
    """
    Create new size.
    """
    existing = crud.get_size_by_name(session=session, name=size_in.name)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A size with this name already exists.",
        )
    size = crud.create_size(session=session, size_in=size_in)
    return size


@router.put(
    "/{id}",
    response_model=SizePublic,
    dependencies=[Depends(get_current_user)],
)
def update_size(
    *,
    session: SessionDep,
    id: uuid.UUID,
    size_in: SizeUpdate,
) -> Any:
    """
    Update a size.
    """
    size = session.get(Size, id)
    if not size:
        raise HTTPException(status_code=404, detail="Size not found")
    if size_in.name:
        existing = crud.get_size_by_name(session=session, name=size_in.name)
        if existing and existing.id != id:
            raise HTTPException(
                status_code=400,
                detail="A size with this name already exists.",
            )
    size = crud.update_size(session=session, db_size=size, size_in=size_in)
    return size


@router.delete(
    "/{id}",
    response_model=Message,
    dependencies=[Depends(get_current_user)],
)
def delete_size(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Delete a size.
    """
    size = session.get(Size, id)
    if not size:
        raise HTTPException(status_code=404, detail="Size not found")
    session.delete(size)
    session.commit()
    return Message(message="Size deleted successfully")
