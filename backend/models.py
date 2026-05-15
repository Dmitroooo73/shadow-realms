from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    age = Column(Integer)
    role = Column(String, default="user")
    avatar_key = Column(String, nullable=True)  # Ключ аватара пользователя в S3

    characters = relationship("Character", back_populates="owner")
    refresh_tokens = relationship("RefreshToken", back_populates="user")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, index=True)  
    user_id = Column(Integer, ForeignKey("users.id"))
    is_revoked = Column(Boolean, default=False)    
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="refresh_tokens")

class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String)
    race = Column(String)
    weapon = Column(String)
    hp = Column(Integer)
    strength = Column(Integer)
    dexterity = Column(Integer)
    is_alive = Column(Boolean, default=True)
    avatar_key = Column(String, nullable=True)  # Ключ файла в S3 (Лаба 3)
    character_class = Column(String, default="warrior", nullable=False)
    level = Column(Integer, default=1, nullable=False)
    xp = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status_poison = Column(Integer, default=0, nullable=False)
    status_bleeding = Column(Integer, default=0, nullable=False)
    status_berserk = Column(Integer, default=0, nullable=False)
    owner = relationship("User", back_populates="characters")
    story_messages = relationship("StoryMessage", back_populates="character")
    items = relationship("Item", back_populates="character", cascade="all, delete-orphan")
    companion = relationship(
        "Companion",
        back_populates="character",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    effect_type = Column(String, default="none", nullable=False)  # heal, damage, cure_poison, cursed, berserk, stat_boost
    effect_value = Column(Integer, default=0, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    character = relationship("Character", back_populates="items")

class Companion(Base):
    __tablename__ = "companions"
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(
        Integer,
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    kind = Column(String, nullable=False)  # wolf | skeleton | spirit
    name = Column(String, nullable=False)
    hp = Column(Integer, default=20, nullable=False)
    is_alive = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    character = relationship("Character", back_populates="companion")


class StoryMessage(Base):
    __tablename__ = "story_messages"
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"))
    user_input = Column(String)
    ai_response = Column(String)
    # В таблице StoryMessage заменяем image_base64 на image_key
    image_key = Column(String, nullable=True) # Имя файла в S3
    timestamp = Column(DateTime, default=datetime.utcnow)
    character = relationship("Character", back_populates="story_messages")
    ratings = relationship("StoryRating", back_populates="message", cascade="all, delete-orphan")


class StoryRating(Base):
    __tablename__ = "story_ratings"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(
        Integer, ForeignKey("story_messages.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    kind = Column(String, nullable=False)  # like | skull | fire
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    message = relationship("StoryMessage", back_populates="ratings")


class ArenaMatch(Base):
    __tablename__ = "arena_matches"
    id = Column(Integer, primary_key=True, index=True)
    attacker_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True)
    defender_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True)
    winner_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)
    rounds = Column(Integer, default=0, nullable=False)
    log = Column(Text, default="", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    attacker = relationship("Character", foreign_keys=[attacker_id])
    defender = relationship("Character", foreign_keys=[defender_id])
    winner = relationship("Character", foreign_keys=[winner_id])