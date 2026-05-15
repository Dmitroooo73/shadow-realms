"""Модульные тесты сервисного слоя AuthService (Лаба №2)."""
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import sessionmaker

from schemas import UserCreateAuth
from services.auth_service import AuthService


@pytest.fixture
def service(engine):
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    s = Session()
    try:
        yield AuthService(s)
    finally:
        s.close()


def _payload(**kw):
    data = dict(email="new@test.io", password="Passw0rd!", name="New", age=20)
    data.update(kw)
    return UserCreateAuth(**data)


@pytest.mark.unit
class TestRegister:
    def test_register_new_user(self, service):
        user = service.register(_payload())
        assert user.email == "new@test.io"
        assert user.hashed_password != "Passw0rd!"

    def test_register_rejects_duplicate_email(self, service):
        service.register(_payload())
        with pytest.raises(HTTPException) as ei:
            service.register(_payload())
        assert ei.value.status_code == 400

    def test_register_rejects_short_password(self, service):
        with pytest.raises(HTTPException) as ei:
            service.register(_payload(password="short1"))
        assert ei.value.status_code == 400

    def test_register_rejects_password_without_digit(self, service):
        with pytest.raises(HTTPException) as ei:
            service.register(_payload(password="onlyLetters"))
        assert ei.value.status_code == 400

    def test_register_rejects_underage(self, service):
        with pytest.raises(HTTPException) as ei:
            service.register(_payload(age=10))
        assert ei.value.status_code == 400


@pytest.mark.unit
class TestLoginAndRefresh:
    def test_login_success_returns_tokens(self, service):
        service.register(_payload())
        result = service.login("new@test.io", "Passw0rd!")
        assert result["access_token"]
        assert result["refresh_token"]
        assert result["expires_in"] > 0

    def test_login_wrong_password(self, service):
        service.register(_payload())
        with pytest.raises(HTTPException) as ei:
            service.login("new@test.io", "wrong")
        assert ei.value.status_code == 401

    def test_login_unknown_email(self, service):
        with pytest.raises(HTTPException) as ei:
            service.login("ghost@x.io", "Passw0rd!")
        assert ei.value.status_code == 401

    def test_refresh_rotates_tokens(self, service):
        service.register(_payload())
        first = service.login("new@test.io", "Passw0rd!")
        rotated = service.refresh_session(first["refresh_token"])
        assert rotated["access_token"]
        assert rotated["refresh_token"] != first["refresh_token"]

    def test_refresh_rejects_reused_token(self, service):
        """Rotation: повторное использование отозванного refresh-токена должно падать."""
        service.register(_payload())
        first = service.login("new@test.io", "Passw0rd!")
        service.refresh_session(first["refresh_token"])
        with pytest.raises(HTTPException) as ei:
            service.refresh_session(first["refresh_token"])
        assert ei.value.status_code == 401

    def test_logout_revokes_refresh(self, service):
        service.register(_payload())
        tokens = service.login("new@test.io", "Passw0rd!")
        service.logout(tokens["refresh_token"])
        with pytest.raises(HTTPException):
            service.refresh_session(tokens["refresh_token"])

    def test_logout_with_none_is_noop(self, service):
        service.logout(None)  # не должно падать
