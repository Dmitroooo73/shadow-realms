from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from models import User
from dependencies import get_db, get_current_user, require_role, require_permission
from schemas import UserOut, UserUpdate, RoleUpdate, AdminStats
from permissions import has_permission
from services.user_service import UserService
import crud

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/stats", response_model=AdminStats)
def admin_stats(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """KPI-сводка для админ-дашборда."""
    return crud.get_admin_stats(db)


@router.get("/", response_model=List[UserOut])
def read_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_permission("user:read_all")),
    db: Session = Depends(get_db),
):
    """Список всех пользователей (только модератор/admin)."""
    service = UserService(db)
    return service.get_all_users(skip, limit)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Текущий пользователь."""
    service = UserService(db)
    return service._user_to_dict(current_user)


@router.put("/{user_id}", response_model=UserOut)
def update_user_endpoint(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Обновление профиля: пользователь обновляет свой, admin — любой."""
    is_self = current_user.id == user_id
    if is_self:
        if not has_permission(current_user.role, "profile:update_own"):
            raise HTTPException(
                status_code=403,
                detail="Missing required permission: profile:update_own",
            )
    else:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Not enough permissions")

    service = UserService(db)
    return service.update_profile(user_id, user_update)


@router.patch("/{user_id}/role", response_model=UserOut)
def change_user_role(
    user_id: int,
    role_data: RoleUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Смена роли пользователя (только admin)."""
    service = UserService(db)
    return service.change_role(user_id, role_data.role)


@router.delete("/{user_id}")
def delete_user_endpoint(
    user_id: int,
    current_user: User = Depends(require_permission("user:delete")),
    db: Session = Depends(get_db),
):
    """Удаление пользователя (только admin)."""
    service = UserService(db)
    service.delete(user_id)
    return {"detail": "User deleted"}


# ── Аватар пользователя ──────────────────────────────────────────────────

@router.post("/me/avatar")
async def upload_user_avatar(
    file: UploadFile = File(..., description="Изображение (JPEG/PNG/GIF/WebP, макс 5MB)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Загрузка аватара текущего пользователя в объектное хранилище."""
    service = UserService(db)
    return await service.upload_avatar(current_user, file)


@router.delete("/me/avatar")
def delete_user_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Удаление аватара текущего пользователя."""
    service = UserService(db)
    service.delete_avatar(current_user)
    return {"detail": "Avatar deleted"}
