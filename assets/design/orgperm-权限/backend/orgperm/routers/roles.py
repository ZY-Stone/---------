from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_permission
from ..models.role import Role, Permission
from ..schemas.role import RoleCreate, RoleUpdate, PermissionAssign

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.get("")
def list_roles(db: Session = Depends(get_db), user=Depends(get_current_user)):
    roles = db.query(Role).all()
    return {"code": 0, "data": [r.to_dict() for r in roles]}


@router.get("/{role_id}")
def get_role(role_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    return {"code": 0, "data": role.to_dict()}


@router.post("")
def create_role(
    body: RoleCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("role.manage")),
):
    if db.query(Role).filter(Role.code == body.code).first():
        raise HTTPException(status_code=400, detail="角色代码已存在")
    role = Role(**body.dict())
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"code": 0, "data": role.to_dict()}


@router.put("/{role_id}")
def update_role(
    role_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("role.manage")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.is_system and body.scope is not None:
        # 允许修改系统角色的名称和颜色，但不能改 scope
        pass
    for k, v in body.dict(exclude_unset=True).items():
        setattr(role, k, v)
    db.commit()
    return {"code": 0, "message": "更新成功"}


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("role.manage")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.is_system:
        raise HTTPException(status_code=400, detail="系统内置角色不可删除")
    from ..models.user import User
    user_count = db.query(User).filter(User.role_id == role_id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"该角色下有 {user_count} 个用户，请先迁移后再删除")
    db.delete(role)
    db.commit()
    return {"code": 0, "message": "删除成功"}


@router.get("/permissions/list")
def list_permissions(db: Session = Depends(get_db), user=Depends(get_current_user)):
    perms = db.query(Permission).all()
    return {"code": 0, "data": [{"id": p.id, "code": p.code, "name": p.name, "description": p.description} for p in perms]}


@router.get("/{role_id}/permissions")
def get_role_permissions(role_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    return {"code": 0, "data": [p.code for p in role.permissions]}


@router.put("/{role_id}/permissions")
def set_role_permissions(
    role_id: int,
    body: PermissionAssign,
    db: Session = Depends(get_db),
    user=Depends(require_permission("role.manage")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    # 清除现有权限
    db.execute(
        "DELETE FROM orgperm_role_permissions WHERE role_id = :rid",
        {"rid": role_id}
    )
    # 设置新权限
    all_perms = {p.code: p for p in db.query(Permission).all()}
    for code in body.permission_codes:
        if code in all_perms:
            db.execute(
                "INSERT INTO orgperm_role_permissions (role_id, permission_id) VALUES (:rid, :pid)",
                {"rid": role_id, "pid": all_perms[code].id}
            )
    db.commit()
    db.refresh(role)
    return {"code": 0, "data": role.to_dict()}
