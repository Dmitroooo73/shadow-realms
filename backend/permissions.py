from enum import Enum
from typing import Set, Dict

class Role(str, Enum):
    GUEST = "guest"
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"

# Матрица прав: роль → множество разрешённых действий
PERMISSIONS: Dict[str, Set[str]] = {
    Role.GUEST: set(),
    Role.USER: {
        "character:create",
        "character:read_own",
        "character:update_own",
        "character:delete_own",
        "story:read_own",
        "story:generate",
        "profile:read_own",
        "profile:update_own",
    },
    Role.MODERATOR: {
        "character:create",
        "character:read_own",
        "character:update_own",
        "character:delete_own",
        "story:read_own",
        "story:generate",
        "profile:read_own",
        "profile:update_own",
        "user:read_all",        
        "character:read_any",   
        "story:read_any",
    },
    Role.ADMIN: {
        "character:create",
        "character:read_own",
        "character:update_own",
        "character:delete_own",
        "story:read_own",
        "story:generate",
        "profile:read_own",
        "profile:update_own",
        "user:read_all",
        "user:delete",
        "user:update_role",
        "character:read_any",
        "character:delete_any",
        "story:read_any",
    },
}

def has_permission(role: str, permission: str) -> bool:
    return permission in PERMISSIONS.get(role, set())