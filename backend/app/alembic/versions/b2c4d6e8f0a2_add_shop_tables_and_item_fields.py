"""add_shop_tables_and_item_fields

Revision ID: b2c4d6e8f0a2
Revises: 8145ddc86255
Create Date: 2026-05-10 00:00:00.000000

Adds image_url and stock columns to item, plus four new tables for the shop:
shop_order, orderitem, cartitem, wishlistitem. Creates an `orderstatus` enum
type used by shop_order.status.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "b2c4d6e8f0a2"
down_revision = "8145ddc86255"
branch_labels = None
depends_on = None


# create_type=False: we'll create/drop the type explicitly with checkfirst=True
# so the migration is idempotent if the type already exists from a prior run.
order_status_enum = postgresql.ENUM(
    "NEW",
    "PROCESSED",
    "PAID",
    "SHIPPED",
    "DELIVERED",
    name="orderstatus",
    create_type=False,
)


def upgrade():
    bind = op.get_bind()

    # 1. Item: image_url + stock
    op.add_column(
        "item",
        sa.Column(
            "image_url",
            sqlmodel.sql.sqltypes.AutoString(length=2048),
            nullable=True,
        ),
    )
    op.add_column(
        "item",
        sa.Column(
            "stock",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # 2. orderstatus enum (idempotent — survives a partially-applied prior run)
    order_status_enum.create(bind, checkfirst=True)

    # 3. shop_order
    op.create_table(
        "shop_order",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "recipient_name",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column(
            "phone",
            sqlmodel.sql.sqltypes.AutoString(length=32),
            nullable=False,
        ),
        sa.Column(
            "address",
            sqlmodel.sql.sqltypes.AutoString(length=1024),
            nullable=False,
        ),
        sa.Column(
            "comment",
            sqlmodel.sql.sqltypes.AutoString(length=2000),
            nullable=True,
        ),
        sa.Column(
            "status",
            order_status_enum,
            nullable=False,
            server_default="NEW",
        ),
        sa.Column(
            "total",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_shop_order_status"), "shop_order", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_shop_order_user_id"), "shop_order", ["user_id"], unique=False
    )

    # 4. orderitem
    op.create_table(
        "orderitem",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=True),
        sa.Column(
            "title_snapshot",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column(
            "price_snapshot",
            sa.Numeric(precision=8, scale=2),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["item_id"], ["item.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["order_id"], ["shop_order.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_orderitem_order_id"), "orderitem", ["order_id"], unique=False
    )
    op.create_index(
        op.f("ix_orderitem_item_id"), "orderitem", ["item_id"], unique=False
    )

    # 5. cartitem
    op.create_table(
        "cartitem",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["item.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "item_id", name="uq_cart_user_item"
        ),
    )
    op.create_index(
        op.f("ix_cartitem_user_id"), "cartitem", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_cartitem_item_id"), "cartitem", ["item_id"], unique=False
    )

    # 6. wishlistitem
    op.create_table(
        "wishlistitem",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["item.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "item_id", name="uq_wishlist_user_item"
        ),
    )
    op.create_index(
        op.f("ix_wishlistitem_user_id"),
        "wishlistitem",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_wishlistitem_item_id"),
        "wishlistitem",
        ["item_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_wishlistitem_item_id"), table_name="wishlistitem"
    )
    op.drop_index(
        op.f("ix_wishlistitem_user_id"), table_name="wishlistitem"
    )
    op.drop_table("wishlistitem")

    op.drop_index(op.f("ix_cartitem_item_id"), table_name="cartitem")
    op.drop_index(op.f("ix_cartitem_user_id"), table_name="cartitem")
    op.drop_table("cartitem")

    op.drop_index(op.f("ix_orderitem_item_id"), table_name="orderitem")
    op.drop_index(op.f("ix_orderitem_order_id"), table_name="orderitem")
    op.drop_table("orderitem")

    op.drop_index(op.f("ix_shop_order_user_id"), table_name="shop_order")
    op.drop_index(op.f("ix_shop_order_status"), table_name="shop_order")
    op.drop_table("shop_order")

    order_status_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_column("item", "stock")
    op.drop_column("item", "image_url")
