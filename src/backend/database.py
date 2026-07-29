"""SQLAlchemy 2.0 engine + session factory"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    """FastAPI dependency injection: yield a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _ensure_columns() -> None:
    """启动时自动检测并补全模型定义中有但数据库表缺失的列。

    SQLAlchemy create_all() 不会修改已存在的表，新加的列需要手动补齐。
    这个函数对比 ORM 模型字段与数据库实际列，自动 ALTER TABLE ADD COLUMN。
    """
    from models import tenant, department, group, user, product_dict, sales_data, import_record, audit_log, permission  # noqa: F401
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    for table_cls in Base.__subclasses__():
        table_name = getattr(table_cls, '__tablename__', None)
        if not table_name or table_name not in table_names:
            continue

        existing_cols = {c['name'] for c in inspector.get_columns(table_name)}
        mapper_cols = {c.name for c in table_cls.__table__.columns}

        missing = mapper_cols - existing_cols
        if not missing:
            continue

        print(f'[init_db] 表 {table_name} 缺少列: {missing}，尝试自动补全...')
        with engine.connect() as conn:
            for col_name in missing:
                col = table_cls.__table__.columns[col_name]
                col_type = col.type.compile(engine.dialect)
                nullable = 'NOT NULL' if not col.nullable else ''
                default_val = ''
                if col.default and hasattr(col.default, 'arg'):
                    default_val = f"DEFAULT '{col.default.arg}'"
                elif col.server_default:
                    d = col.server_default.arg
                    default_val = f"DEFAULT {d}" if d else ''
                sql = f'ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type} {nullable} {default_val}'
                try:
                    conn.execute(text(sql))
                    conn.commit()
                    print(f'[init_db] ✓ 已添加 {table_name}.{col_name} {col_type}')
                except Exception as e:
                    print(f'[init_db] ✗ 添加 {table_name}.{col_name} 失败: {e}')

def init_db() -> None:
    """Create all tables from ORM metadata, then auto-add missing columns."""
    from models import tenant, department, group, user, product_dict, sales_data, import_record, audit_log, permission  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
