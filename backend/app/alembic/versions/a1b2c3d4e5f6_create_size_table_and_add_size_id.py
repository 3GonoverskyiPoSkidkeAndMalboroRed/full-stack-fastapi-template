"""create_size_table_and_add_size_id

Revision ID: a1b2c3d4e5f6
Revises: e8e73185e6a6
Create Date: 2026-05-08 00:00:00.000000

This migration restores the historical record of the previous (manual) state
where a `size` table was created with a `value` column and `item.size_id` was
added as an FK. The actual schema is normalised in the next migration.
"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "e8e73185e6a6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "size",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "value", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_size_value"), "size", ["value"], unique=True
    )
    op.add_column("item", sa.Column("size_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "item_size_id_fkey", "item", "size", ["size_id"], ["id"]
    )


def downgrade():
    op.drop_constraint("item_size_id_fkey", "item", type_="foreignkey")
    op.drop_column("item", "size_id")
    op.drop_index(op.f("ix_size_value"), table_name="size")
    op.drop_table("size")
