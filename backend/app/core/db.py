import uuid
from decimal import Decimal

from sqlmodel import Session, create_engine, func, select

from app import crud
from app.core.config import settings
from app.models import (
    Brand,
    Category,
    CategoryCreate,
    Item,
    ItemCreate,
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
    _seed_brands(session)
    _seed_items(session, user.id)


SEED_CATEGORIES = [
    "Обувь",
    "Одежда",
    "Аксессуары",
    "Электроника",
    "Спорт",
    "Дом и сад",
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

SEED_ITEMS = [
    {
        "title": "Кроссовки Air Max",
        "description": "Легкие беговые кроссовки",
        "size_name": "42",
        "brand": "Nike",
        "cost": Decimal("12999.00"),
        "category": "Обувь",
        "stock": 25,
    },
    {
        "title": "Футболка Classic",
        "description": "Хлопковая футболка",
        "size_name": "M",
        "brand": "Adidas",
        "cost": Decimal("2999.00"),
        "category": "Одежда",
        "stock": 50,
    },
    {
        "title": "Рюкзак Urban",
        "description": "Городской рюкзак для ноутбука",
        "size_name": "One Size",
        "brand": "Samsonite",
        "cost": Decimal("5499.00"),
        "category": "Аксессуары",
        "stock": 15,
    },
    {
        "title": "Наушники Pro Sound",
        "description": "Беспроводные наушники с шумоподавлением",
        "size_name": "One Size",
        "brand": "Sony",
        "cost": Decimal("15999.00"),
        "category": "Электроника",
        "stock": 10,
    },
    {
        "title": "Кеды Canvas",
        "description": "Повседневные кеды",
        "size_name": "43",
        "brand": "Converse",
        "cost": Decimal("6999.00"),
        "category": "Обувь",
        "stock": 30,
    },
    {
        "title": "Куртка Windbreaker",
        "description": "Легкая ветровка",
        "size_name": "L",
        "brand": "The North Face",
        "cost": Decimal("8999.00"),
        "category": "Одежда",
        "stock": 12,
    },
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


def _seed_brands(session: Session) -> None:
    seed_brand_names = list(dict.fromkeys(str(item["brand"]) for item in SEED_ITEMS))
    added = False
    for name in seed_brand_names:
        existing = session.exec(select(Brand).where(Brand.name == name)).first()
        if existing is None:
            session.add(Brand(name=name))
            added = True
    if added:
        session.commit()


def _seed_items(session: Session, owner_id: uuid.UUID) -> None:
    existing_count = session.exec(select(func.count()).select_from(Item)).one()
    if existing_count > 0:
        return

    for item_data in SEED_ITEMS:
        category = crud.get_category_by_name(
            session=session, name=str(item_data["category"])
        )
        size = crud.get_size_by_name(session=session, name=str(item_data["size_name"]))
        brand = crud.get_brand_by_name(session=session, name=str(item_data["brand"]))
        cost_value = item_data["cost"]
        stock_value = item_data.get("stock", 0)
        item_in = ItemCreate(
            title=str(item_data["title"]),
            description=str(item_data["description"]),
            brand_id=(brand.id if brand else None),
            cost=cost_value if isinstance(cost_value, Decimal) else None,
            category_id=(category.id if category else None),
            size_id=(size.id if size else None),
            stock=int(stock_value) if isinstance(stock_value, int) else 0,
        )
        crud.create_item(session=session, item_in=item_in, owner_id=owner_id)
