import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Brand,
    BrandCreate,
    BrandPublic,
    BrandsPublic,
    BrandUpdate,
    Message,
)

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("/public", response_model=BrandsPublic)
def read_brands_public(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Public brands listing — no authentication required.
    """
    count_statement = select(func.count()).select_from(Brand)
    count = session.exec(count_statement).one()
    statement = select(Brand).offset(skip).limit(limit)
    brands = session.exec(statement).all()
    brands_public = [BrandPublic.model_validate(b) for b in brands]
    return BrandsPublic(data=brands_public, count=count)


@router.get(
    "/",
    response_model=BrandsPublic,
    dependencies=[Depends(get_current_user)],
)
def read_brands(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve brands.
    """
    count_statement = select(func.count()).select_from(Brand)
    count = session.exec(count_statement).one()
    statement = select(Brand).offset(skip).limit(limit)
    brands = session.exec(statement).all()
    brands_public = [BrandPublic.model_validate(b) for b in brands]
    return BrandsPublic(data=brands_public, count=count)


@router.get(
    "/{id}",
    response_model=BrandPublic,
    dependencies=[Depends(get_current_user)],
)
def read_brand(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Get brand by ID.
    """
    brand = session.get(Brand, id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.post(
    "/",
    response_model=BrandPublic,
    dependencies=[Depends(get_current_user)],
)
def create_brand(
    *,
    session: SessionDep,
    brand_in: BrandCreate,
) -> Any:
    """
    Create new brand.
    """
    existing = crud.get_brand_by_name(session=session, name=brand_in.name)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A brand with this name already exists.",
        )
    brand = crud.create_brand(session=session, brand_in=brand_in)
    return brand


@router.put(
    "/{id}",
    response_model=BrandPublic,
    dependencies=[Depends(get_current_user)],
)
def update_brand(
    *,
    session: SessionDep,
    id: uuid.UUID,
    brand_in: BrandUpdate,
) -> Any:
    """
    Update a brand.
    """
    brand = session.get(Brand, id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if brand_in.name:
        existing = crud.get_brand_by_name(session=session, name=brand_in.name)
        if existing and existing.id != id:
            raise HTTPException(
                status_code=400,
                detail="A brand with this name already exists.",
            )
    brand = crud.update_brand(session=session, db_brand=brand, brand_in=brand_in)
    return brand


@router.delete(
    "/{id}",
    response_model=Message,
    dependencies=[Depends(get_current_user)],
)
def delete_brand(session: SessionDep, id: uuid.UUID) -> Any:
    """
    Delete a brand.
    """
    brand = session.get(Brand, id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    session.delete(brand)
    session.commit()
    return Message(message="Brand deleted successfully")
