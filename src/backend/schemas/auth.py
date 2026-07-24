"""
backend/schemas/auth.py
"""
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePwdRequest(BaseModel):
    old_password: str
    new_password: str


class LoginResponse(BaseModel):
    token: str
    user: dict


class UserInfo(BaseModel):
    id: int
    username: str
    name: str
    role: str
    dept_name: str | None = None
    group_name: str | None = None
    dept_id: int | None = None
    group_id: int | None = None
    tenant_id: int
