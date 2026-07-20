from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from ..dependencies import get_db, get_current_user
from ..models.department import Department
from ..schemas.department import DepartmentCreate, DepartmentUpdate
from ..services.org_service import can_manage_dept, get_dept_groups

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("")
def list_departments(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    depts = db.query(Department).filter(Department.is_active == True).order_by(Department.sort_order).all()
    return {"code": 0, "data": [d.to_dict() for d in depts]}


@router.get("/{dept_id}")
def get_department(dept_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    d = db.query(Department).filter(Department.id == dept_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="部门不存在")
    result = d.to_dict()
    result["groups"] = get_dept_groups(db, dept_id)
    return {"code": 0, "data": result}


@router.post("")
def create_department(
    body: DepartmentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_manage_dept(user):
        raise HTTPException(status_code=403, detail="无权限管理部门")
    if db.query(Department).filter(Department.name == body.name).first():
        raise HTTPException(status_code=400, detail="部门名称已存在")
    d = Department(**body.dict())
    db.add(d)
    db.commit()
    db.refresh(d)
    return {"code": 0, "data": d.to_dict()}


@router.put("/{dept_id}")
def update_department(
    dept_id: int,
    body: DepartmentUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_manage_dept(user):
        raise HTTPException(status_code=403, detail="无权限管理部门")
    d = db.query(Department).filter(Department.id == dept_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="部门不存在")
    for k, v in body.dict(exclude_unset=True).items():
        setattr(d, k, v)
    db.commit()
    return {"code": 0, "message": "更新成功"}


@router.delete("/{dept_id}")
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_manage_dept(user):
        raise HTTPException(status_code=403, detail="无权限管理部门")
    d = db.query(Department).filter(Department.id == dept_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="部门不存在")
    # 检查关联
    from ..models.user import User
    user_count = db.query(User).filter(User.department_id == dept_id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"该部门下有 {user_count} 个用户，请先迁移后再删除")
    from ..models.group import Group
    db.query(Group).filter(Group.department_id == dept_id).delete()
    db.delete(d)
    db.commit()
    return {"code": 0, "message": "删除成功"}
