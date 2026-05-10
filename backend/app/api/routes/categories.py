import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    CategoriesPublic,
    Category,
    CategoryCreate,
    CategoryPublic,
    CategoryUpdate,
    Message,
)

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/public", response_model=CategoriesPublic)
def read_categories_public(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Public categories listing — no authentication required.
    """
    count_statement = select(func.count()).select_from(Category)
    count = session.exec(count_statement).one()
    statement = select(Category).offset(skip).limit(limit)
    categories = session.exec(statement).all()
    categories_public = [CategoryPublic.model_validate(c) for c in categories]
    return CategoriesPublic(data=categories_public, count=count)


@router.get(
    "/",
    response_model=CategoriesPublic,
    dependencies=[Depends(get_current_user)],
)
def read_categories(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve categories.
    """
    count_statement = select(func.count()).select_from(Category)
    count = session.exec(count_statement).one()
    statement = select(Category).offset(skip).limit(limit)
    categories = session.exec(statement).all()
    categories_public = [CategoryPublic.model_validate(c) for c in categories]
    return CategoriesPublic(data=categories_public, count=count)


@router.get(
    "/{id}",
    response_model=CategoryPublic,
    dependencies=[Depends(get_current_user)],
)
def read_category(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get category by ID.
    """
    category = session.get(Category, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post(
    "/",
    response_model=CategoryPublic,
    dependencies=[Depends(get_current_user)],
)
def create_category(
    *,
    session: SessionDep,
    category_in: CategoryCreate,
) -> Any:
    """
    Create new category.
    """
    existing = crud.get_category_by_name(session=session, name=category_in.name)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A category with this name already exists.",
        )
    category = crud.create_category(session=session, category_in=category_in)
    return category


@router.put(
    "/{id}",
    response_model=CategoryPublic,
    dependencies=[Depends(get_current_user)],
)
def update_category(
    *,
    session: SessionDep,
    id: uuid.UUID,
    category_in: CategoryUpdate,
) -> Any:
    """
    Update a category.
    """
    category = session.get(Category, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category_in.name:
        existing = crud.get_category_by_name(session=session, name=category_in.name)
        if existing and existing.id != id:
            raise HTTPException(
                status_code=400,
                detail="A category with this name already exists.",
            )
    category = crud.update_category(
        session=session, db_category=category, category_in=category_in
    )
    return category


@router.delete(
    "/{id}",
    response_model=Message,
    dependencies=[Depends(get_current_user)],
)
def delete_category(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Delete a category.
    """
    category = session.get(Category, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    session.delete(category)
    session.commit()
    return Message(message="Category deleted successfully")
