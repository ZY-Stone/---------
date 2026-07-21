from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role_code: str = "person"
    department_id: Optional[int] = None
    group_id: Optional[int] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role_code: Optional[str] = None
    department_id: Optional[int] = None
    group_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
