from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional

from dependencies import get_db, get_current_user
from schemas import UserCreateAuth, UserOut, ChangePassword
from utils import REFRESH_TOKEN_EXPIRE_DAYS
from services.auth_service import AuthService
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(user: UserCreateAuth, db: Session = Depends(get_db)):
    """Регистрация нового пользователя."""
    service = AuthService(db)
    return service.register(user)


@router.post("/token")
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Вход: выдаёт access token в теле, refresh token в httpOnly cookie."""
    service = AuthService(db)
    result = service.login(form_data.username, form_data.password)

    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {
        "access_token": result["access_token"],
        "token_type": "bearer",
        "expires_in": result["expires_in"],
    }


@router.post("/refresh")
def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    """Ротация токенов через refresh token из cookie."""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    service = AuthService(db)
    result = service.refresh_session(refresh_token)

    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {"access_token": result["access_token"], "token_type": "bearer"}


@router.post("/change-password")
def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Смена пароля залогиненного пользователя."""
    service = AuthService(db)
    service.change_password(current_user, data.old_password, data.new_password)
    return {"message": "Пароль успешно изменён"}


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    """Выход: отзывает refresh token и удаляет cookie."""
    service = AuthService(db)
    service.logout(refresh_token)
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}
