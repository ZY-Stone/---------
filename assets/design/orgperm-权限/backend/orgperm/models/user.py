from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from ..database import Base


class User(Base):
    __tablename__ = "orgperm_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    name = Column(String(64), nullable=False)
    role_id = Column(Integer, ForeignKey("orgperm_roles.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("orgperm_departments.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("orgperm_groups.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    # 关联
    role = relationship("Role", lazy="joined")
    department = relationship("Department", lazy="joined")
    group = relationship("Group", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "name": self.name,
            "role": self.role.code if self.role else "person",
            "role_name": self.role.name if self.role else "普通用户",
            "role_scope": self.role.scope if self.role else "self",
            "dept": self.department.name if self.department else None,
            "dept_id": self.department_id,
            "grp": self.group.name if self.group else None,
            "group_id": self.group_id,
            "is_active": self.is_active,
        }
