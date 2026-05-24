"""add_brand_table_and_brand_id

Revision ID: a7b3c9d1e2f4
Revises: c1f2a3b4d5e6
Create Date: 2026-05-24 12:00:00.000000

"""
import uuid

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "a7b3c9d1e2f4"
down_revision = "c1f2a3b4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "brand",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_brand_name"), "brand", ["name"], unique=True)
    op.add_column("item", sa.Column("brand_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "item_brand_id_fkey",
        "item",
        "brand",
        ["brand_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Data migration: promote existing free-text brand values into the brand table
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT DISTINCT brand FROM item "
            "WHERE brand IS NOT NULL AND brand <> ''"
        )
    ).all()
    for (name,) in rows:
        brand_id = uuid.uuid4()
        bind.execute(
            sa.text("INSERT INTO brand (id, name) VALUES (:id, :name)"),
            {"id": brand_id, "name": name},
        )
        bind.execute(
            sa.text("UPDATE item SET brand_id = :brand_id WHERE brand = :name"),
            {"brand_id": brand_id, "name": name},
        )

    op.drop_column("item", "brand")


def downgrade():
    op.add_column(
        "item",
        sa.Column(
            "brand", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True
        ),
    )
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE item SET brand = brand.name "
            "FROM brand WHERE item.brand_id = brand.id"
        )
    )
    op.drop_constraint("item_brand_id_fkey", "item", type_="foreignkey")
    op.drop_column("item", "brand_id")
    op.drop_index(op.f("ix_brand_name"), table_name="brand")
    op.drop_table("brand")
