"""Seed-скрипт: генерирует тестовые заказы с реалистичным распределением.

Запуск:
    docker compose exec backend python -m app.seed_orders --days 180 --end 2026-05-24

Создаёт заказы за указанный период (по умолчанию полгода назад от --end),
случайно распределяя их по часам суток с пиками на обед и вечер,
с разными статусами в зависимости от возраста заказа.
"""

from __future__ import annotations

import argparse
import logging
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlmodel import Session, col, delete, select

from app.core.db import engine
from app.models import Item, Order, OrderItem, OrderStatus, User

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("seed_orders")

MSK = ZoneInfo("Europe/Moscow")

# Веса распределения заказов по часам суток (0..23). Пики — обед (12-14) и вечер (19-21).
HOUR_WEIGHTS: list[int] = [
    1,
    1,
    1,
    1,
    1,
    1,  # 0-5: ночь
    2,
    3,
    5,
    7,
    8,
    10,  # 6-11: утро
    13,
    14,
    12,
    9,
    8,
    10,  # 12-17: день
    13,
    14,
    12,
    8,
    5,
    3,  # 18-23: вечер
]

# Множитель числа заказов по дням недели: пн=0..вс=6.
WEEKDAY_MULTIPLIER: dict[int, float] = {
    0: 1.0,
    1: 1.1,
    2: 1.1,
    3: 1.0,
    4: 1.2,
    5: 1.4,
    6: 1.3,
}


def status_weights(days_old: int) -> dict[OrderStatus, int]:
    """Чем старее заказ, тем больше шанс DELIVERED."""
    if days_old <= 1:
        return {
            OrderStatus.NEW: 50,
            OrderStatus.PROCESSED: 35,
            OrderStatus.CANCELLED: 15,
        }
    if days_old <= 3:
        return {
            OrderStatus.PROCESSED: 25,
            OrderStatus.PAID: 40,
            OrderStatus.SHIPPED: 25,
            OrderStatus.CANCELLED: 10,
        }
    if days_old <= 14:
        return {
            OrderStatus.PAID: 10,
            OrderStatus.SHIPPED: 35,
            OrderStatus.DELIVERED: 45,
            OrderStatus.CANCELLED: 10,
        }
    return {
        OrderStatus.DELIVERED: 88,
        OrderStatus.CANCELLED: 12,
    }


def _weighted_status(days_old: int) -> OrderStatus:
    weights = status_weights(days_old)
    return random.choices(list(weights.keys()), weights=list(weights.values()), k=1)[0]


def _random_msk_dt(day: datetime) -> datetime:
    """Вернуть случайный момент в течение `day` (в МСК) c учётом часовых весов."""
    hour = random.choices(range(24), weights=HOUR_WEIGHTS, k=1)[0]
    return day.replace(
        hour=hour,
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
        microsecond=0,
    )


def _add_order_with_items(
    *,
    session: Session,
    user: User,
    items: list[Item],
    status: OrderStatus,
    created_at_utc: datetime,
) -> None:
    chosen = random.sample(items, k=min(random.randint(1, 4), len(items)))
    pricing: list[tuple[Item, int, Decimal]] = []
    total = Decimal("0")
    for it in chosen:
        qty = random.randint(1, 3)
        price = it.cost if it.cost is not None else Decimal("100")
        pricing.append((it, qty, price))
        total += price * qty

    order = Order(
        user_id=user.id,
        status=status,
        total=total,
        recipient_name="Тестовый Покупатель",
        phone="+71234567890",
        address="г. Москва, ул. Тестовая, д. 1",
        comment=None,
        created_at=created_at_utc,
        cancellation_reason=(
            "Seed: тестовая отмена" if status == OrderStatus.CANCELLED else None
        ),
    )
    session.add(order)
    session.flush()
    for it, qty, price in pricing:
        session.add(
            OrderItem(
                order_id=order.id,
                item_id=it.id,
                title_snapshot=it.title,
                price_snapshot=price,
                quantity=qty,
            )
        )


def seed(
    *,
    session: Session,
    days: int,
    end_date_msk: datetime,
    daily_avg: int,
) -> int:
    users = list(session.exec(select(User).where(col(User.is_active).is_(True))).all())[
        :50
    ]
    if not users:
        raise SystemExit("Нет активных пользователей в БД — нечем заполнять заказы.")
    items = list(session.exec(select(Item)).all())[:50]
    if not items:
        raise SystemExit("Нет товаров в БД — нечем заполнять корзины.")

    logger.info(
        "Пользователей: %d, товаров: %d, дней: %d, среднее заказов/день: %d",
        len(users),
        len(items),
        days,
        daily_avg,
    )

    end_day = end_date_msk.replace(hour=0, minute=0, second=0, microsecond=0)
    created = 0

    for offset in range(days):
        day = end_day - timedelta(days=offset)
        multiplier = WEEKDAY_MULTIPLIER[day.weekday()]
        target = max(0, int(round(daily_avg * multiplier)))
        n_today = random.randint(max(0, target - 3), target + 3)

        for _ in range(n_today):
            created_at_msk = _random_msk_dt(day)
            _add_order_with_items(
                session=session,
                user=random.choice(users),
                items=items,
                status=_weighted_status(offset),
                created_at_utc=created_at_msk.astimezone(timezone.utc),
            )
            created += 1

        if offset and offset % 30 == 0:
            session.commit()
            logger.info("…  обработано дней: %d, заказов: %d", offset, created)

    session.commit()
    logger.info("Готово. Создано заказов: %d", created)
    return created


def reset_orders(session: Session) -> None:
    logger.info("Удаляю существующие заказы…")
    session.exec(delete(OrderItem))
    session.exec(delete(Order))
    session.commit()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--days",
        type=int,
        default=180,
        help="Сколько дней назад заполнять (по умолчанию 180).",
    )
    parser.add_argument(
        "--end",
        type=str,
        default="2026-05-24",
        help="Конечная дата в МСК, YYYY-MM-DD (включительно).",
    )
    parser.add_argument(
        "--daily-avg", type=int, default=8, help="Среднее число заказов в день."
    )
    parser.add_argument(
        "--reset", action="store_true", help="Очистить таблицы заказов перед заливкой."
    )
    parser.add_argument(
        "--seed", type=int, default=42, help="Random seed для воспроизводимости."
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    end_date_msk = datetime.strptime(args.end, "%Y-%m-%d").replace(tzinfo=MSK)

    with Session(engine) as session:
        if args.reset:
            reset_orders(session)
        seed(
            session=session,
            days=args.days,
            end_date_msk=end_date_msk,
            daily_avg=args.daily_avg,
        )


if __name__ == "__main__":
    main()
