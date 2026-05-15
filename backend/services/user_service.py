from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
import uuid

from crud import get_user, update_user, delete_user, update_user_role
from schemas import UserUpdate
from s3_client import get_presigned_url, upload_file_to_s3, delete_file_from_s3
import models

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class UserService:
    """Сервисный слой для управления пользователями (Лаба 2)."""

    def __init__(self, db: Session):
        self.db = db

    def _user_to_dict(self, user: models.User) -> dict:
        """Конвертирует ORM-объект в словарь, добавляя avatar_url."""
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "age": user.age,
            "role": user.role,
            "avatar_key": user.avatar_key,
            "avatar_url": get_presigned_url(user.avatar_key) if user.avatar_key else None,
        }

    def get_all_users(self, skip: int = 0, limit: int = 100):
        """Список всех пользователей (только для модератора/админа)."""
        users = self.db.query(models.User).offset(skip).limit(limit).all()
        return [self._user_to_dict(u) for u in users]

    def get_user(self, user_id: int) -> models.User:
        user = get_user(self.db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def update_profile(self, user_id: int, user_update: UserUpdate) -> dict:
        """Обновление профиля пользователя."""
        user = update_user(self.db, user_id, user_update)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return self._user_to_dict(user)

    def change_role(self, user_id: int, role: str) -> dict:
        """Смена роли пользователя (только для admin)."""
        user = update_user_role(self.db, user_id, role)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return self._user_to_dict(user)

    def delete(self, user_id: int) -> None:
        """Удаление пользователя."""
        if not delete_user(self.db, user_id):
            raise HTTPException(status_code=404, detail="User not found")

    # ── Аватар пользователя ───────────────────────────────────────────────

    async def upload_avatar(self, user: models.User, file: UploadFile) -> dict:
        """Загрузка аватара пользователя в S3."""
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Недопустимый тип файла. Разрешены: JPEG, PNG, GIF, WebP",
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="Файл слишком большой. Максимум 5 MB")

        # Удаляем старый аватар
        if user.avatar_key:
            delete_file_from_s3(user.avatar_key)

        ext = file.content_type.split("/")[1]
        file_name = f"user-avatars/{user.id}/{uuid.uuid4().hex}.{ext}"
        key = upload_file_to_s3(content, file_name, file.content_type)
        if not key:
            raise HTTPException(status_code=500, detail="Ошибка загрузки файла в хранилище")

        user.avatar_key = key
        self.db.commit()

        return {"avatar_url": get_presigned_url(key), "avatar_key": key}

    def delete_avatar(self, user: models.User) -> None:
        """Удаление аватара пользователя."""
        if not user.avatar_key:
            raise HTTPException(status_code=404, detail="У вас нет аватара")

        delete_file_from_s3(user.avatar_key)
        user.avatar_key = None
        self.db.commit()
