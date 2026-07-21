from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user
from ..schemas.auth import LoginRequest, ChangePwdRequest
from ..services.auth_service import authenticate, change_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    result = authenticate(db, req.username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"code": 0, "data": result}


@router.post("/change-password")
def change_pwd(req: ChangePwdRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    ok = change_password(db, user, req.old_password, req.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="原密码错误")
    return {"code": 0, "message": "密码修改成功"}


@router.get("/me")
def me(user=Depends(get_current_user)):
    """获取当前登录用户信息 + 权限"""
    user_dict = user.to_dict()
    if user.role and user.role.permissions:
        user_dict["permissions"] = [p.code for p in user.role.permissions]
    else:
        user_dict["permissions"] = []
    return {"code": 0, "data": user_dict}
