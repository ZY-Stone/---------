"""Pydantic v2 schemas — auth"""
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    model_config = {"extra": "forbid"}
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)

class ChangePwdRequest(BaseModel):
    model_config = {"extra": "forbid"}
    old_password: str
    new_password: str = Field(..., min_length=6)

class UserInfo(BaseModel):
    model_config = {"extra": "forbid"}
    id: int
    username: str
    name: str
    role: str
    dept_name: str | None = None
    group_name: str | None = None
    dept_id: int | None = None
    group_id: int | None = None
    tenant_id: int
    must_change_pwd: bool = False

class LoginResponse(BaseModel):
    token: str
    user: UserInfo
