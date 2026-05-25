from sqlmodel import Session, create_engine, func, select

from app import crud
from app.core.config import settings
from app.models import (
    Category,
    CategoryCreate,
    Size,
    User,
    UserCreate,
)

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)

    _seed_categories(session)
    _seed_sizes(session)


SEED_CATEGORIES = [
    "Обувь",
    "Одежда",
    "Аксессуары",
]

SEED_SIZES = [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "35",
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "One Size",
]


def _seed_categories(session: Session) -> None:
    existing_count = session.exec(select(func.count()).select_from(Category)).one()
    if existing_count > 0:
        return

    for name in SEED_CATEGORIES:
        category_in = CategoryCreate(name=name)
        crud.create_category(session=session, category_in=category_in)


def _seed_sizes(session: Session) -> None:
    added = False
    for name in SEED_SIZES:
        existing = session.exec(select(Size).where(Size.name == name)).first()
        if existing is None:
            session.add(Size(name=name))
            added = True
    if added:
        session.commit()
