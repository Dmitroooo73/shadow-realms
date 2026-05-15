from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


class UserCreateAuth(BaseModel):
    email: EmailStr
    password: str
    name: str
    age: int


class UserCreate(UserCreateAuth):
    pass


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    age: int
    role: str
    avatar_key: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class RoleUpdate(BaseModel):
    role: str

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        allowed = {"user", "moderator", "admin"}
        if v not in allowed:
            raise ValueError(f'Роль должна быть одной из: {allowed}')
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None


class ChangePassword(BaseModel):
    old_password: str
    new_password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class TokenData(BaseModel):
    email: Optional[str] = None


ALLOWED_CLASSES = {"warrior", "berserker", "rogue", "necromancer"}


class CharacterBase(BaseModel):
    name: str
    race: str
    weapon: str
    hp: int
    strength: int
    dexterity: int
    character_class: str = "warrior"

    @field_validator("character_class")
    @classmethod
    def validate_class(cls, v):
        if v not in ALLOWED_CLASSES:
            raise ValueError(f"Класс должен быть одним из: {ALLOWED_CLASSES}")
        return v


class CharacterCreate(CharacterBase):
    @field_validator('hp', 'strength', 'dexterity')
    @classmethod
    def check_stat_range(cls, v, info):
        if v < 1 or v > 25:
            raise ValueError(f'{info.field_name} должна быть от 1 до 25')
        return v


class CharacterOut(CharacterBase):
    id: int
    owner_id: int
    is_alive: bool
    avatar_key: Optional[str] = None   # Ключ файла в S3
    avatar_url: Optional[str] = None   # Presigned URL (вычисляется сервисом, Лаба 3)
    level: int = 1
    xp: int = 0
    created_at: Optional[datetime] = None
    status_poison: int = 0
    status_bleeding: int = 0
    status_berserk: int = 0
    has_story: bool = False
    companion: Optional['CompanionOut'] = None

    class Config:
        from_attributes = True


# Пагинированный список персонажей (Лаба 3)
class PaginatedCharactersOut(BaseModel):
    items: list[CharacterOut]
    total: int


class StoryMessageOut(BaseModel):
    id: int
    character_id: int
    user_input: str
    ai_response: str
    image_url: Optional[str] = None
    timestamp: datetime
    likes: int = 0
    skulls: int = 0
    fires: int = 0
    my_rating: Optional[str] = None  # 'like' | 'skull' | 'fire' | None

    class Config:
        from_attributes = True


ALLOWED_RATINGS = {"like", "skull", "fire"}


class StoryRatingCreate(BaseModel):
    kind: str

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v):
        if v not in ALLOWED_RATINGS:
            raise ValueError(f"kind должен быть одним из: {ALLOWED_RATINGS}")
        return v


class StoryRatingOut(BaseModel):
    message_id: int
    likes: int
    skulls: int
    fires: int
    my_rating: Optional[str] = None


class FeedEntry(BaseModel):
    message_id: int
    character_id: int
    character_name: str
    race: str
    character_class: str = "warrior"
    owner_id: int
    owner_name: str
    user_input: str
    ai_response: str
    image_url: Optional[str] = None
    timestamp: datetime
    likes: int = 0
    skulls: int = 0
    fires: int = 0


class ItemOut(BaseModel):
    id: int
    character_id: int
    name: str
    description: Optional[str] = None
    effect_type: str
    effect_value: int
    is_used: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    effect_type: str = "none"
    effect_value: int = 0


ALLOWED_COMPANIONS = {"wolf", "skeleton", "spirit"}


class CompanionCreate(BaseModel):
    kind: str
    name: Optional[str] = None

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v):
        if v not in ALLOWED_COMPANIONS:
            raise ValueError(f"Компаньон должен быть одним из: {ALLOWED_COMPANIONS}")
        return v


class CompanionOut(BaseModel):
    id: int
    character_id: int
    kind: str
    name: str
    hp: int
    is_alive: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminStats(BaseModel):
    total_users: int
    total_characters: int
    alive_characters: int
    dead_characters: int
    stories_today: int
    total_stories: int
    by_role: dict[str, int]


CharacterOut.model_rebuild()


class LeaderboardEntry(BaseModel):
    id: int
    name: str
    race: str
    character_class: str = "warrior"
    level: int
    xp: int
    hp: int
    owner_id: int
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class GraveyardEntry(BaseModel):
    id: int
    name: str
    race: str
    character_class: str = "warrior"
    level: int
    hp: int
    owner_id: int
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None
    total_turns: int = 0

    class Config:
        from_attributes = True


class AchievementOut(BaseModel):
    code: str
    title: str
    description: str
    icon: str
    unlocked: bool


class ArenaFightRequest(BaseModel):
    attacker_id: int
    defender_id: int


class ArenaOpponent(BaseModel):
    id: int
    name: str
    race: str
    character_class: str = "warrior"
    level: int
    hp: int
    strength: int
    dexterity: int
    owner_id: int
    owner_name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class ArenaMatchOut(BaseModel):
    id: int
    attacker_id: int
    attacker_name: str
    defender_id: int
    defender_name: str
    winner_id: Optional[int] = None
    winner_name: Optional[str] = None
    rounds: int
    log: str
    xp_gained: int = 0
    created_at: datetime


class CharacterStatsOut(BaseModel):
    character_id: int
    name: str
    level: int
    xp: int
    is_alive: bool
    total_turns: int
    items_used: int
    items_in_bag: int
    items_by_effect: dict[str, int]
    created_at: Optional[datetime] = None
