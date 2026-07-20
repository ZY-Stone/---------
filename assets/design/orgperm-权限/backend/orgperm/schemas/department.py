from pydantic import BaseModel
from typing import Optional


class DepartmentCreate(BaseModel):
    name: str
    leader: Optional[str] = ""
    sort_order: int = 0
    is_active: bool = True


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    leader: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
