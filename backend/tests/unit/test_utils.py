"""Модульные тесты утилит безопасности (хэши паролей, JWT)."""
import time

import pytest
from jose import jwt

from utils import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_refresh_token,
)


@pytest.mark.unit
class TestPasswordHashing:
    def test_hash_differs_from_plain(self):
        h = get_password_hash("Passw0rd!")
        assert h != "Passw0rd!"
        assert h.startswith("$2")  # bcrypt

    def test_verify_correct_password(self):
        h = get_password_hash("Passw0rd!")
        assert verify_password("Passw0rd!", h) is True

    def test_verify_wrong_password(self):
        h = get_password_hash("Passw0rd!")
        assert verify_password("nope", h) is False

    def test_same_password_different_salt(self):
        assert get_password_hash("x") != get_password_hash("x")


@pytest.mark.unit
class TestAccessToken:
    def test_access_token_roundtrip(self):
        token = create_access_token({"sub": "a@b.c"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "a@b.c"
        assert payload["type"] == "access"
        assert "exp" in payload


@pytest.mark.unit
class TestRefreshToken:
    def test_refresh_token_returns_jti(self):
        token, jti = create_refresh_token({"sub": "a@b.c"})
        assert token and jti
        email, parsed_jti = verify_refresh_token(token)
        assert email == "a@b.c"
        assert parsed_jti == jti

    def test_refresh_verification_rejects_garbage(self):
        email, jti = verify_refresh_token("not.a.token")
        assert email is None and jti is None

    def test_access_token_rejected_by_refresh_verifier(self):
        # access-token подписан SECRET_KEY, а refresh-верификатор ждёт REFRESH_SECRET_KEY.
        access = create_access_token({"sub": "a@b.c"})
        email, jti = verify_refresh_token(access)
        assert email is None and jti is None
