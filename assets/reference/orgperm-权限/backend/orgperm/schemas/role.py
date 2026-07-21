from pydantic import BaseModel
from typing import Optional, List


class RoleCreate(BaseModel):
    code: str
    name: str
    scope: str = "self"
    color: str = "#64748b"
    description: str = ""


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


class PermissionAssign(BaseModel):
    permission_codes: List[str]
