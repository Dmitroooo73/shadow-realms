"""Интеграционные тесты auth-эндпоинтов (Лаба №5, п.2)."""
import pytest


@pytest.mark.integration
class TestRegisterEndpoint:
    def test_register_returns_201_user(self, client):
        resp = client.post(
            "/auth/register",
            json={"email": "e@x.io", "password": "Passw0rd!", "name": "E", "age": 21},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "e@x.io"

    def test_register_validation_error(self, client):
        resp = client.post(
            "/auth/register",
            json={"email": "e@x.io", "password": "short", "name": "E", "age": 21},
        )
        assert resp.status_code == 400


@pytest.mark.integration
class TestLoginEndpoint:
    def test_login_success_sets_cookie(self, client, make_user):
        make_user(email="l@x.io", password="Passw0rd!")
        resp = client.post(
            "/auth/token",
            data={"username": "l@x.io", "password": "Passw0rd!"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["token_type"] == "bearer"
        assert "refresh_token" in resp.cookies

    def test_login_wrong_password(self, client, make_user):
        make_user(email="l@x.io", password="Passw0rd!")
        resp = client.post(
            "/auth/token",
            data={"username": "l@x.io", "password": "wrong"},
        )
        assert resp.status_code == 401


@pytest.mark.integration
class TestRefreshAndLogout:
    def test_refresh_rotates_cookie(self, client, make_user):
        make_user(email="l@x.io", password="Passw0rd!")
        login = client.post(
            "/auth/token", data={"username": "l@x.io", "password": "Passw0rd!"}
        )
        old_rt = login.cookies["refresh_token"]

        resp = client.post("/auth/refresh")
        assert resp.status_code == 200
        assert resp.json()["access_token"]
        new_rt = resp.cookies.get("refresh_token")
        assert new_rt and new_rt != old_rt

    def test_refresh_missing_cookie_returns_401(self, client):
        client.cookies.clear()
        resp = client.post("/auth/refresh")
        assert resp.status_code == 401

    def test_logout_blocks_subsequent_refresh(self, client, make_user):
        make_user(email="l@x.io", password="Passw0rd!")
        client.post("/auth/token", data={"username": "l@x.io", "password": "Passw0rd!"})

        resp = client.post("/auth/logout")
        assert resp.status_code == 200

        # После logout cookie удалён; refresh должен давать 401.
        client.cookies.clear()
        assert client.post("/auth/refresh").status_code == 401
