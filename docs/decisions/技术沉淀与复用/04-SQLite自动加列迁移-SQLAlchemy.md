# SQLite 自动加列迁移 — SQLAlchemy

> 启动时自动对比 ORM 模型字段与数据库实际列，自动 ALTER TABLE ADD COLUMN 补全缺失列。
> 来源：`src/backend/database.py` `_ensure_columns()`

---

## 🗣 大白话

### 这是什么？

一个"自动补漏"工具。开发过程中你经常会在数据库表里加新字段（比如 User 表加了个 `phone` 列）。但 SQLite 有个毛病：表已经存在的情况下，新加的列不会自动创建。你得手动写 `ALTER TABLE ADD COLUMN`。

这个函数在每次启动时自动检查：代码里定义了哪些列、数据库里实际有哪些列。缺少的就自动补上。省得你每次加字段都要手动改数据库。

### 什么时候用？

- 项目用 SQLite 做开发数据库
- 经常在模型里加字段
- 不想每次加字段都手动写 SQL 迁移脚本（ALTER TABLE...）

### 注意

生产环境（PostgreSQL）还是建议用 Alembic 管理迁移，这个工具主要给开发阶段省时间。

---

## 代码

```python
"""database.py — SQLAlchemy engine + 自修复加列"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI 依赖注入"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_columns() -> None:
    """启动时自动检测并补全模型定义中有但数据库表缺失的列。"""
    # 导入所有模型
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

        print(f'[init_db] 表 {table_name} 缺少列: {missing}，自动补全...')
        with engine.connect() as conn:
            for col_name in missing:
                col = table_cls.__table__.columns[col_name]
                col_type = col.type.compile(engine.dialect)
                nullable = 'NOT NULL' if not col.nullable else ''
                default_val = ''
                if col.default and hasattr(col.default, 'arg'):
                    default_val = f"DEFAULT '{col.default.arg}'"
                elif col.server_default:
                    default_val = f"DEFAULT {col.server_default.arg}" if col.server_default.arg else ''
                sql = f'ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type} {nullable} {default_val}'
                try:
                    conn.execute(text(sql))
                    conn.commit()
                    print(f'[init_db] ✓ {table_name}.{col_name} {col_type}')
                except Exception as e:
                    print(f'[init_db] ✗ {table_name}.{col_name} 失败: {e}')


def init_db() -> None:
    """创建所有新表 + 自动补全已有表的缺失列"""
    from models import tenant, department, group, user, product_dict, sales_data, import_record, audit_log, permission  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
```

## 使用方式

```python
# main.py lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
```

## 局限性

- 只处理 ADD COLUMN，不处理 RENAME / DROP / TYPE CHANGE
- 依赖 SQLAlchemy 的 `compile()` 生成类型字符串
- 生产环境建议用 Alembic migration 替代
