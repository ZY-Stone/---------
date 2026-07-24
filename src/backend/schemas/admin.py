"""
backend/schemas/admin.py
"""
from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str
    dept_id: int | None = None
    group_id: int | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    dept_id: int | None = None
    group_id: int | None = None
    status: str | None = None


class UserOut(BaseModel):
    id: int
    username: str
    name: str
    role: str
    dept_name: str | None = None
    group_name: str | None = None
    status: str
