"""SQLAlchemy 2.0 engine + session factory"""
from sqlalchemy import create_engine
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

def init_db() -> None:
    """Create all tables from ORM metadata."""
    from models import tenant, department, group, user, product_dict, sales_data, import_record, audit_log  # noqa: F401
    Base.metadata.create_all(bind=engine)
