from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from ..database import Base


class Department(Base):
    __tablename__ = "orgperm_departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), unique=True, nullable=False)
    leader = Column(String(64), default="")
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "leader": self.leader,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
        }
