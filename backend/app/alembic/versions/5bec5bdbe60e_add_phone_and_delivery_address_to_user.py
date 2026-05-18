"""add phone and delivery_address to user

Revision ID: 5bec5bdbe60e
Revises: 79731975e17a
Create Date: 2026-05-18 15:41:20.783074

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "5bec5bdbe60e"
down_revision = "79731975e17a"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column(
            "phone",
            sqlmodel.sql.sqltypes.AutoString(length=32),
            nullable=True,
        ),
    )
    op.add_column(
        "user",
        sa.Column(
            "delivery_address",
            sqlmodel.sql.sqltypes.AutoString(length=500),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("user", "delivery_address")
    op.drop_column("user", "phone")
