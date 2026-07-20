from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from .config import JWT_SECRET, JWT_ALGORITHM
from .database import SessionLocal

security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_db)):
    """从 JWT 中解析当前用户"""
    from .models.user import User
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or disabled")
    return user


def require_role(*roles):
    """检查当前用户角色（按 code 匹配）"""
    def checker(user=Depends(get_current_user)):
        user_role_code = user.role.code if user.role else "person"
        if user_role_code not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return checker


def require_permission(*permissions):
    """检查当前用户是否拥有指定权限"""
    def checker(user=Depends(get_current_user)):
        if not user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No role assigned")
        user_perms = {p.code for p in user.role.permissions} if user.role.permissions else set()
        for perm in permissions:
            if perm not in user_perms:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {perm}")
        return user
    return checker
