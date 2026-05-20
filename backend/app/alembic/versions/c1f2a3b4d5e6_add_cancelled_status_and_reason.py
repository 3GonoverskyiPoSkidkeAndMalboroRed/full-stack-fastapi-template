"""add_cancelled_status_and_reason

Revision ID: c1f2a3b4d5e6
Revises: 5bec5bdbe60e
Create Date: 2026-05-20 00:00:00.000000

Adds CANCELLED value to the orderstatus enum and a cancellation_reason
column to shop_order.
"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "c1f2a3b4d5e6"
down_revision = "5bec5bdbe60e"
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL 12+ supports ADD VALUE inside a transaction.
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'CANCELLED'")

    op.add_column(
        "shop_order",
        sa.Column(
            "cancellation_reason",
            sqlmodel.sql.sqltypes.AutoString(length=500),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("shop_order", "cancellation_reason")

    # Recreate the enum without CANCELLED. Will fail if any row still uses it.
    op.execute("ALTER TYPE orderstatus RENAME TO orderstatus_old")
    op.execute(
        "CREATE TYPE orderstatus AS ENUM "
        "('NEW', 'PROCESSED', 'PAID', 'SHIPPED', 'DELIVERED')"
    )
    op.execute(
        "ALTER TABLE shop_order ALTER COLUMN status "
        "TYPE orderstatus USING status::text::orderstatus"
    )
    op.execute("DROP TYPE orderstatus_old")
