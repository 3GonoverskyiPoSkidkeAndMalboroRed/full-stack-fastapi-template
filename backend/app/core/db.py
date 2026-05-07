from decimal import Decimal

from sqlmodel import Session, create_engine, func, select

from app import crud
from app.core.config import settings
from app.models import (
    Category,
    CategoryCreate,
    Item,
    ItemCreate,
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
    _seed_items(session, user.id)


SEED_CATEGORIES = [
    "Обувь",
    "Одежда",
    "Аксессуары",
    "Электроника",
    "Спорт",
    "Дом и сад",
]

SEED_ITEMS = [
    {
        "title": "Кроссовки Air Max",
        "description": "Легкие беговые кроссовки",
        "size": "42",
        "brand": "Nike",
        "cost": Decimal("12999.00"),
        "category": "Обувь",
    },
    {
        "title": "Футболка Classic",
        "description": "Хлопковая футболка",
        "size": "M",
        "brand": "Adidas",
        "cost": Decimal("2999.00"),
        "category": "Одежда",
    },
    {
        "title": "Рюкзак Urban",
        "description": "Городской рюкзак для ноутбука",
        "size": "One Size",
        "brand": "Samsonite",
        "cost": Decimal("5499.00"),
        "category": "Аксессуары",
    },
    {
        "title": "Наушники Pro Sound",
        "description": "Беспроводные наушники с шумоподавлением",
        "size": "One Size",
        "brand": "Sony",
        "cost": Decimal("15999.00"),
        "category": "Электроника",
    },
    {
        "title": "Кеды Canvas",
        "description": "Повседневные кеды",
        "size": "43",
        "brand": "Converse",
        "cost": Decimal("6999.00"),
        "category": "Обувь",
    },
    {
        "title": "Куртка Windbreaker",
        "description": "Легкая ветровка",
        "size": "L",
        "brand": "The North Face",
        "cost": Decimal("8999.00"),
        "category": "Одежда",
    },
]


def _seed_categories(session: Session) -> None:
    existing_count = session.exec(select(func.count()).select_from(Category)).one()
    if existing_count > 0:
        return

    for name in SEED_CATEGORIES:
        category_in = CategoryCreate(name=name)
        crud.create_category(session=session, category_in=category_in)


def _seed_items(session: Session, owner_id) -> None:
    existing_count = session.exec(select(func.count()).select_from(Item)).one()
    if existing_count > 0:
        return

    for item_data in SEED_ITEMS:
        data = item_data.copy()
        category_name = data.pop("category")
        category = crud.get_category_by_name(session=session, name=category_name)
        category_id = category.id if category else None

        item_in = ItemCreate(category_id=category_id, **data)
        crud.create_item(session=session, item_in=item_in, owner_id=owner_id)
