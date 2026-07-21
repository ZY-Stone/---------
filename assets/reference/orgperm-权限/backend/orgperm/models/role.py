from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, func
from sqlalchemy.orm import relationship
from ..database import Base

# 角色-权限多对多关联表
role_permissions = Table(
    "orgperm_role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("orgperm_roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("orgperm_permissions.id"), primary_key=True),
)


class Role(Base):
    __tablename__ = "orgperm_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(16), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    scope = Column(String(16), default="self")  # all | dept | group | self
    color = Column(String(7), default="#2563eb")
    is_system = Column(Boolean, default=False)
    description = Column(String(256), default="")
    created_at = Column(DateTime, default=func.now())

    # 关联权限
    permissions = relationship("Permission", secondary=role_permissions, lazy="joined", collection_class=list)

    def to_dict(self, include_permissions=True):
        d = {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "scope": self.scope,
            "color": self.color,
            "is_system": self.is_system,
            "description": self.description,
        }
        if include_permissions:
            d["permissions"] = [p.code for p in self.permissions]
        return d


class Permission(Base):
    __tablename__ = "orgperm_permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    description = Column(String(256), default="")
