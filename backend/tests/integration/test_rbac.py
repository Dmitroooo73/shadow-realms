"""Интеграционные тесты ролевой защиты endpoint'ов (Лаба №1 + №5)."""
import pytest


@pytest.mark.integration
class TestUsersListRbac:
    def test_anonymous_cannot_list_users(self, client):
        assert client.get("/users/").status_code == 401

    def test_regular_user_forbidden(self, client, auth_headers):
        headers = auth_headers(email="u@x.io", role="user")
        resp = client.get("/users/", headers=headers)
        assert resp.status_code == 403

    def test_admin_can_list_users(self, client, auth_headers):
        headers = auth_headers(email="a@x.io", role="admin")
        resp = client.get("/users/", headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_moderator_can_list_users(self, client, auth_headers):
        headers = auth_headers(email="m@x.io", role="moderator")
        resp = client.get("/users/", headers=headers)
        assert resp.status_code == 200


@pytest.mark.integration
class TestRoleManagementRbac:
    def test_user_cannot_change_role(self, client, auth_headers, make_user):
        victim = make_user(email="victim@x.io")
        headers = auth_headers(email="u@x.io", role="user")
        resp = client.patch(
            f"/users/{victim.id}/role",
            headers=headers,
            json={"role": "admin"},
        )
        assert resp.status_code == 403

    def test_admin_can_change_role(self, client, auth_headers, make_user):
        victim = make_user(email="victim@x.io")
        headers = auth_headers(email="a@x.io", role="admin")
        resp = client.patch(
            f"/users/{victim.id}/role",
            headers=headers,
            json={"role": "moderator"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "moderator"


@pytest.mark.integration
class TestInvalidToken:
    def test_garbage_token_rejected(self, client):
        resp = client.get("/users/me", headers={"Authorization": "Bearer not.a.jwt"})
        assert resp.status_code == 401

    def test_me_returns_current_user(self, client, auth_headers):
        headers = auth_headers(email="me@x.io", role="user")
        resp = client.get("/users/me", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@x.io"
