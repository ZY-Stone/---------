from pydantic import BaseModel
from typing import Optional


class GroupCreate(BaseModel):
    name: str
    department_id: int
    leader: Optional[str] = ""
    sort_order: int = 0
    is_active: bool = True


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    leader: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
