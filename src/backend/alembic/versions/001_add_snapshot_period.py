"""add snapshot_period to width_records

Revision ID: 001
Revises: None (initial)
Create Date: 2026-07-28

背景：
  WidthRecord 模型新增了 snapshot_period 字段（数据快照月份），但 SQLAlchemy
  create_all() 不会修改已存在的表。如果数据库在添加该字段前就已创建，
  该列会缺失，导致后端写入月份值时被 SQLite 静默丢弃，全部数据月份为空。

此迁移确保 width_records 表包含 snapshot_period 列。
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # 检查列是否已存在（SQLite 不支持 IF NOT EXISTS for ADD COLUMN）
    # 使用 try/except 安全添加
    try:
        op.execute("ALTER TABLE width_records ADD COLUMN snapshot_period VARCHAR(7) DEFAULT ''")
        print('[Alembic] ✓ 已添加 width_records.snapshot_period')
    except Exception:
        # 列已存在，跳过
        print('[Alembic] - width_records.snapshot_period 已存在，跳过')


def downgrade():
    # SQLite 不支持 DROP COLUMN，此处仅记录
    print('[Alembic] SQLite 不支持 DROP COLUMN，downgrade 跳过')
