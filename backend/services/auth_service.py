import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from crud import (
    get_user_by_email,
    create_user,
    create_refresh_token_db,
    get_refresh_token,
    revoke_refresh_token,
)
from utils import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from schemas import UserCreateAuth


class AuthService:
    """Сервисный слой для аутентификации и управления сессиями (Лаба 2)."""

    def __init__(self, db: Session):
        self.db = db

    # ── Валидация ──────────────────────────────────────────────────────────

    def _validate_password(self, password: str) -> None:
        if len(password) < 8:
            raise HTTPException(
                status_code=400, detail="Пароль должен быть минимум 8 символов"
            )
        if not re.search(r"[A-Za-z]", password):
            raise HTTPException(
                status_code=400, detail="Пароль должен содержать хотя бы одну букву"
            )
        if not re.search(r"\d", password):
            raise HTTPException(
                status_code=400, detail="Пароль должен содержать хотя бы одну цифру"
            )

    # ── Бизнес-операции ────────────────────────────────────────────────────

    def register(self, user_data: UserCreateAuth):
        """Регистрация нового пользователя с валидацией."""
        if get_user_by_email(self.db, email=user_data.email):
            raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

        self._validate_password(user_data.password)

        if user_data.age < 13:
            raise HTTPException(
                status_code=400, detail="Регистрация доступна только с 13 лет"
            )

        user_data.password = get_password_hash(user_data.password)
        return create_user(self.db, user_data)

    def login(self, email: str, password: str) -> dict:
        """Аутентификация пользователя и выдача пары токенов."""
        user = get_user_by_email(self.db, email=email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
            )

        access_token = create_access_token(data={"sub": user.email})
        refresh_token_value, jti = create_refresh_token(data={"sub": user.email})

        expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        create_refresh_token_db(
            self.db, user_id=user.id, jti=jti, expires_at=expires_at
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token_value,
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    def refresh_session(self, refresh_token_value: str) -> dict:
        """Ротация токенов: отзыв старого refresh, выдача новой пары."""
        email, jti = verify_refresh_token(refresh_token_value)
        if not email or not jti:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        db_token = get_refresh_token(self.db, jti)
        if (
            not db_token
            or db_token.is_revoked
            or db_token.expires_at < datetime.utcnow()
        ):
            raise HTTPException(status_code=401, detail="Token revoked or expired")

        user = get_user_by_email(self.db, email=email)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        revoke_refresh_token(self.db, jti)  # Rotation: отзываем старый

        new_access = create_access_token(data={"sub": user.email})
        new_refresh, new_jti = create_refresh_token(data={"sub": user.email})

        new_expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        create_refresh_token_db(
            self.db, user_id=user.id, jti=new_jti, expires_at=new_expires
        )

        return {"access_token": new_access, "refresh_token": new_refresh}

    def logout(self, refresh_token_value: str | None) -> None:
        """Отзыв refresh token при выходе."""
        if refresh_token_value:
            _, jti = verify_refresh_token(refresh_token_value)
            if jti:
                revoke_refresh_token(self.db, jti)

    def change_password(self, user, old_password: str, new_password: str) -> None:
        """Смена пароля с проверкой старого."""
        if not verify_password(old_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Старый пароль неверный")
        self._validate_password(new_password)
        if verify_password(new_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Новый пароль должен отличаться от старого")
        user.hashed_password = get_password_hash(new_password)
        self.db.commit()
