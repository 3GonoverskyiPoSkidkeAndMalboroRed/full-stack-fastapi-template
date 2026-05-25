"""Seed-скрипт для статистики: создаёт только записи заказов (без OrderItem).

Генерирует фиксированное число заказов за заданный период, распределяя их
по часам суток с явными пиками во второй половине дня (день + вечер).
Реальные товары не создаются и не привязываются — статистике достаточно
полей `created_at` и `total` (см. crud.get_orders_stats).

Запуск:
    docker compose exec backend python -m app.seed_order_stats --reset
    docker compose exec backend python -m app.seed_order_stats \\
        --count 5000 --start 2025-12-25 --end 2026-05-25 --reset
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
from app.models import Order, OrderItem, OrderStatus, User

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("seed_order_stats")

MSK = ZoneInfo("Europe/Moscow")

# Веса распределения заказов по часам суток (0..23).
# Явные пики во второй половине дня: максимум в 14-21 ч (день и вечер).
HOUR_WEIGHTS: list[int] = [
    1,
    1,
    1,
    1,
    1,
    1,  # 0-5: ночь
    2,
    3,
    4,
    5,
    6,
    8,  # 6-11: утро
    11,
    13,
    18,
    20,
    19,
    21,  # 12-17: день — пик нарастает
    22,
    20,
    16,
    11,
    6,
    3,  # 18-23: вечер — основной пик, затем спад
]

# Множитель числа заказов по дням недели: пн=0..вс=6.
WEEKDAY_MULTIPLIER: list[float] = [1.0, 1.1, 1.1, 1.0, 1.2, 1.4, 1.3]

# Диапазон суммы заказа (₽); распределение смещено к недорогим чекам.
TOTAL_MIN = Decimal("500")
TOTAL_MAX = Decimal("15000")
TOTAL_MODE = 3000.0


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


def _random_total() -> Decimal:
    """Случайная сумма заказа в TOTAL_MIN..TOTAL_MAX со смещением к TOTAL_MODE."""
    value = random.triangular(float(TOTAL_MIN), float(TOTAL_MAX), TOTAL_MODE)
    return Decimal(str(round(value, 2)))


def _random_day(start_day: datetime, span_days: int) -> datetime:
    """Случайный день в [start_day; start_day + span_days] с весом дня недели."""
    while True:
        offset = random.randint(0, span_days)
        day = start_day + timedelta(days=offset)
        if random.random() <= WEEKDAY_MULTIPLIER[day.weekday()] / 1.4:
            return day


def _random_msk_dt(day: datetime) -> datetime:
    """Случайный момент в течение `day` (МСК) с учётом часовых весов."""
    hour = random.choices(range(24), weights=HOUR_WEIGHTS, k=1)[0]
    return day.replace(
        hour=hour,
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
        microsecond=0,
    )


def _make_order(*, user: User, created_at_utc: datetime, days_old: int) -> Order:
    status = _weighted_status(days_old)
    return Order(
        user_id=user.id,
        status=status,
        total=_random_total(),
        recipient_name="Тестовый Покупатель",
        phone="+71234567890",
        address="г. Москва, ул. Тестовая, д. 1",
        comment=None,
        created_at=created_at_utc,
        cancellation_reason=(
            "Seed: тестовая отмена" if status == OrderStatus.CANCELLED else None
        ),
    )


def seed(
    *,
    session: Session,
    count: int,
    start_date_msk: datetime,
    end_date_msk: datetime,
) -> int:
    users = list(session.exec(select(User).where(col(User.is_active).is_(True))).all())[
        :50
    ]
    if not users:
        raise SystemExit("Нет активных пользователей в БД — некому назначить заказы.")

    start_day = start_date_msk.replace(hour=0, minute=0, second=0, microsecond=0)
    end_day = end_date_msk.replace(hour=0, minute=0, second=0, microsecond=0)
    span_days = (end_day - start_day).days
    if span_days < 0:
        raise SystemExit("--start позже --end.")

    logger.info(
        "Пользователей: %d, заказов к созданию: %d, период: %s — %s (%d дн.)",
        len(users),
        count,
        start_day.date(),
        end_day.date(),
        span_days,
    )

    created = 0
    for _ in range(count):
        day = _random_day(start_day, span_days)
        created_at_msk = _random_msk_dt(day)
        days_old = (end_day - day).days
        order = _make_order(
            user=random.choice(users),
            created_at_utc=created_at_msk.astimezone(timezone.utc),
            days_old=days_old,
        )
        session.add(order)
        created += 1

        if created % 500 == 0:
            session.commit()
            logger.info("…  создано заказов: %d", created)

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
        "--count",
        type=int,
        default=5000,
        help="Сколько заказов создать (по умолчанию 5000).",
    )
    parser.add_argument(
        "--start",
        type=str,
        default="2025-12-25",
        help="Начальная дата в МСК, YYYY-MM-DD (включительно).",
    )
    parser.add_argument(
        "--end",
        type=str,
        default="2026-05-25",
        help="Конечная дата в МСК, YYYY-MM-DD (включительно).",
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

    start_date_msk = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=MSK)
    end_date_msk = datetime.strptime(args.end, "%Y-%m-%d").replace(tzinfo=MSK)

    with Session(engine) as session:
        if args.reset:
            reset_orders(session)
        seed(
            session=session,
            count=args.count,
            start_date_msk=start_date_msk,
            end_date_msk=end_date_msk,
        )


if __name__ == "__main__":
    main()
