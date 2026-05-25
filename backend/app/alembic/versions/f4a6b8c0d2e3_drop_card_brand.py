"""drop_card_brand

Revision ID: f4a6b8c0d2e3
Revises: e3f5a7b9c1d2
Create Date: 2026-05-25 12:00:00.000000

Drops the card issuer/brand columns: payment_card.brand and shop_order.card_brand.
The payment flow no longer detects or stores the card's payment system.
"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "f4a6b8c0d2e3"
down_revision = "e3f5a7b9c1d2"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("shop_order", "card_brand")
    op.drop_column("payment_card", "brand")


def downgrade():
    op.add_column(
        "payment_card",
        sa.Column(
            "brand",
            sqlmodel.sql.sqltypes.AutoString(length=32),
            nullable=False,
        ),
    )
    op.add_column(
        "shop_order",
        sa.Column(
            "card_brand",
            sqlmodel.sql.sqltypes.AutoString(length=32),
            nullable=True,
        ),
    )
