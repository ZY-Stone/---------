"""
backend/routers/backup.py — 数据备份与恢复 API
"""
import os, shutil
from fastapi import APIRouter, Depends, Request, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from services.backup_service import create_backup, list_backups, restore_backup, delete_backup
from config import BACKUP_DIR

router = APIRouter(prefix="/api/backup", tags=["备份"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


def _check_admin(request: Request):
    u = _user(request)
    if not u or u.get("role") not in ("admin", "gm", "operation"):
        raise HTTPException(status_code=403, detail="仅管理员/运营可操作")


@router.post("/create")
def backup_create(request: Request, db: Session = Depends(get_db), btype: str = "full"):
    """创建备份: btype = accounts | data | full"""
    _check_admin(request)
    u = _user(request)
    try:
        result = create_backup(db, u.get("tenant_id", 1), u.get("user_id", 0), btype)
        return {"message": "备份创建成功", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"备份创建失败: {str(e)}")


@router.get("/list")
def backup_list(request: Request):
    _check_admin(request)
    return list_backups()


@router.post("/restore/{filename}")
def backup_restore(filename: str, request: Request, db: Session = Depends(get_db)):
    _check_admin(request)
    ok = restore_backup(db, filename)
    if not ok:
        raise HTTPException(status_code=404, detail="备份文件不存在")
    return {"message": "数据恢复成功"}


@router.delete("/{filename}")
def backup_delete(filename: str, request: Request):
    _check_admin(request)
    ok = delete_backup(filename)
    if not ok:
        raise HTTPException(status_code=404, detail="备份文件不存在")
    return {"message": "备份删除成功"}


@router.get("/download/{filename}")
def backup_download(filename: str, request: Request):
    _check_admin(request)
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(filepath, filename=filename, media_type="application/json")


@router.post("/upload")
async def backup_upload(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """从上传的备份文件恢复数据"""
    _check_admin(request)
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="请上传 .json 备份文件")
    # 保存上传文件
    filepath = os.path.join(BACKUP_DIR, file.filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    # 执行恢复
    ok = restore_backup(db, file.filename)
    if not ok:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail="备份文件格式错误，恢复失败")
    return {"message": "数据恢复成功", "filename": file.filename}
