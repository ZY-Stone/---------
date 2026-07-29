"""
backend/routers/auth.py — 认证相关 API
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from schemas.auth import LoginRequest, ChangePwdRequest, LoginResponse
from services.auth_service import authenticate, change_password

router = APIRouter(prefix="/api/auth", tags=["认证"])


def _get_user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    result = authenticate(db, req.username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="账号或密码错误")
    return result


@router.post("/change-password")
def change_pwd(req: ChangePwdRequest, request: Request, db: Session = Depends(get_db)):
    u = _get_user(request)
    user_id = u.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    ok = change_password(db, user_id, req.old_password, req.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="当前密码错误")
    return {"ok": True, "message": "密码修改成功"}

@router.post("/change-pwd")
def change_pwd_legacy(req: ChangePwdRequest, request: Request, db: Session = Depends(get_db)):
    """兼容旧路径"""
    return change_pwd(req, request, db)
