"""add_payment_cards_and_order_payment_fields

Revision ID: e3f5a7b9c1d2
Revises: a7b3c9d1e2f4
Create Date: 2026-05-24 18:00:00.000000

Adds the payment_card table, payment/return tracking columns to shop_order,
and RECEIVED / REFUNDED values to the orderstatus enum.
"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "e3f5a7b9c1d2"
down_revision = "a7b3c9d1e2f4"
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL 12+ supports ADD VALUE inside a transaction.
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'RECEIVED'")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'REFUNDED'")

    op.create_table(
        "payment_card",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("brand", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("last4", sqlmodel.sql.sqltypes.AutoString(length=4), nullable=False),
        sa.Column("exp_month", sa.Integer(), nullable=False),
        sa.Column("exp_year", sa.Integer(), nullable=False),
        sa.Column(
            "cardholder_name",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_payment_card_user_id"), "payment_card", ["user_id"], unique=False
    )

    op.add_column(
        "shop_order",
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "shop_order",
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "shop_order",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "shop_order",
        sa.Column(
            "card_brand",
            sqlmodel.sql.sqltypes.AutoString(length=32),
            nullable=True,
        ),
    )
    op.add_column(
        "shop_order",
        sa.Column(
            "card_last4",
            sqlmodel.sql.sqltypes.AutoString(length=4),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("shop_order", "card_last4")
    op.drop_column("shop_order", "card_brand")
    op.drop_column("shop_order", "refunded_at")
    op.drop_column("shop_order", "received_at")
    op.drop_column("shop_order", "paid_at")
    op.drop_index(op.f("ix_payment_card_user_id"), table_name="payment_card")
    op.drop_table("payment_card")
    # The RECEIVED / REFUNDED enum values are intentionally left in place:
    # removing enum values in PostgreSQL requires recreating the type and
    # would fail if any row still references them.
