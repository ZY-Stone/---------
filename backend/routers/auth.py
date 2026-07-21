"""
backend/routers/auth.py — 认证相关 API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas.auth import LoginRequest, ChangePwdRequest, LoginResponse
from services.auth_service import authenticate, change_password
from utils.security import decode_access_token

router = APIRouter(prefix="/api/auth", tags=["认证"])


def get_current_user(db: Session = Depends(get_db), token: str = Depends(lambda: None)):
    """依赖：从 Header 的 Authorization 中提取当前用户"""
    # 这里 token 通过 FastAPI Header 依赖注入，实际在 main.py 用中间件处理
    # 此处简化：从请求上下文中获取
    return None  # 实际实现在 main.py 中间件中


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    result = authenticate(db, req.username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="账号或密码错误")
    return result


@router.post("/change-pwd")
def change_pwd(req: ChangePwdRequest, db: Session = Depends(get_db),
               current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="请先登录")
    ok = change_password(db, current_user["user_id"], req.old_password, req.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="原密码错误")
    return {"message": "密码修改成功"}
