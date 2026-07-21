from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func, UniqueConstraint
from ..database import Base


class Group(Base):
    __tablename__ = "orgperm_groups"
    __table_args__ = (UniqueConstraint("name", "department_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False)
    department_id = Column(Integer, ForeignKey("orgperm_departments.id"), nullable=False)
    leader = Column(String(64), default="")
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "department_id": self.department_id,
            "leader": self.leader,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
        }
