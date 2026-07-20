from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from ..dependencies import get_db, get_current_user
from ..models.group import Group
from ..schemas.group import GroupCreate, GroupUpdate
from ..services.org_service import can_manage_group

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("")
def list_groups(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(Group).filter(Group.is_active == True)
    if department_id is not None:
        q = q.filter(Group.department_id == department_id)
    groups = q.order_by(Group.sort_order).all()
    return {"code": 0, "data": [g.to_dict() for g in groups]}


@router.get("/{group_id}")
def get_group(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="组不存在")
    return {"code": 0, "data": g.to_dict()}


@router.post("")
def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_manage_group(user):
        raise HTTPException(status_code=403, detail="无权限管理组")
    from ..models.department import Department
    if not db.query(Department).filter(Department.id == body.department_id).first():
        raise HTTPException(status_code=400, detail="部门不存在")
    existing = db.query(Group).filter(Group.name == body.name, Group.department_id == body.department_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="该部门下已存在同名组")
    g = Group(**body.dict())
    db.add(g)
    db.commit()
    db.refresh(g)
    return {"code": 0, "data": g.to_dict()}


@router.put("/{group_id}")
def update_group(
    group_id: int,
    body: GroupUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_manage_group(user):
        raise HTTPException(status_code=403, detail="无权限管理组")
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="组不存在")
    for k, v in body.dict(exclude_unset=True).items():
        setattr(g, k, v)
    db.commit()
    return {"code": 0, "message": "更新成功"}


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_manage_group(user):
        raise HTTPException(status_code=403, detail="无权限管理组")
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="组不存在")
    from ..models.user import User
    user_count = db.query(User).filter(User.group_id == group_id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"该组下有 {user_count} 个用户，请先迁移后再删除")
    db.delete(g)
    db.commit()
    return {"code": 0, "message": "删除成功"}
