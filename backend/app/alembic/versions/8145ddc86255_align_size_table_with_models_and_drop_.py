"""align_size_table_with_models_and_drop_item_size_string

Revision ID: 8145ddc86255
Revises: a1b2c3d4e5f6
Create Date: 2026-05-09 06:58:15.690680

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '8145ddc86255'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Clean slate: detach items from sizes, then truncate the table so we can
    # add `name` as NOT NULL without backfilling. Seed will repopulate.
    op.execute("UPDATE item SET size_id = NULL")
    op.execute("DELETE FROM size")

    # Drop the existing string `size` column on item.
    op.drop_column('item', 'size')

    # Replace FK with ondelete=SET NULL so deleting a size detaches items.
    op.drop_constraint(op.f('item_size_id_fkey'), 'item', type_='foreignkey')
    op.create_foreign_key(
        'item_size_id_fkey', 'item', 'size', ['size_id'], ['id'],
        ondelete='SET NULL',
    )

    # Replace size.value (varchar 50) with size.name (varchar 255).
    op.drop_index(op.f('ix_size_value'), table_name='size')
    op.drop_column('size', 'value')
    op.add_column(
        'size',
        sa.Column(
            'name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False,
        ),
    )
    op.create_index(op.f('ix_size_name'), 'size', ['name'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_size_name'), table_name='size')
    op.drop_column('size', 'name')
    op.add_column(
        'size',
        sa.Column('value', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    )
    op.create_index(op.f('ix_size_value'), 'size', ['value'], unique=True)

    op.drop_constraint('item_size_id_fkey', 'item', type_='foreignkey')
    op.create_foreign_key(
        op.f('item_size_id_fkey'), 'item', 'size', ['size_id'], ['id'],
    )

    op.add_column(
        'item',
        sa.Column('size', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    )
