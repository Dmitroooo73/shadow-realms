"""Модульные тесты матрицы RBAC (Лаба №1 / зона риска Лаба №5)."""
import pytest

from permissions import Role, has_permission


@pytest.mark.unit
class TestPermissionMatrix:
    def test_guest_has_no_permissions(self):
        assert not has_permission(Role.GUEST, "character:create")
        assert not has_permission(Role.GUEST, "profile:read_own")

    def test_user_can_manage_own_characters(self):
        assert has_permission(Role.USER, "character:create")
        assert has_permission(Role.USER, "character:read_own")
        assert has_permission(Role.USER, "character:update_own")
        assert has_permission(Role.USER, "character:delete_own")

    def test_user_cannot_read_all_users(self):
        assert not has_permission(Role.USER, "user:read_all")
        assert not has_permission(Role.USER, "user:update_role")

    def test_moderator_can_read_but_not_delete_users(self):
        assert has_permission(Role.MODERATOR, "user:read_all")
        assert has_permission(Role.MODERATOR, "character:read_any")
        assert not has_permission(Role.MODERATOR, "user:delete")
        assert not has_permission(Role.MODERATOR, "user:update_role")

    def test_admin_has_full_user_management(self):
        assert has_permission(Role.ADMIN, "user:delete")
        assert has_permission(Role.ADMIN, "user:update_role")
        assert has_permission(Role.ADMIN, "character:delete_any")

    def test_unknown_role_denied_by_default(self):
        assert not has_permission("hacker", "character:create")

    def test_unknown_permission_denied(self):
        assert not has_permission(Role.ADMIN, "system:shutdown")
