from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
import models
import schemas
from s3_client import get_presigned_url


def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreateAuth):
    db_user = models.User(
        email=user.email,
        hashed_password=user.password,
        name=user.name,
        age=user.age
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: int):
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False


def get_characters_by_user(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 10,
    search: str = None,
    race: str = None,
    sort_by: str = "id",      # Новое поле для Лабы 3
    order: str = "desc"       # Новое поле для Лабы 3
):
    query = db.query(models.Character).filter(models.Character.owner_id == user_id)

    if race:
        query = query.filter(models.Character.race == race)

    if search:
        query = query.filter(models.Character.name.ilike(f"%{search}%"))

    total_count = query.count()

    # Динамическая сортировка
    sort_column = getattr(models.Character, sort_by, models.Character.id)
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    items = query.offset(skip).limit(limit).all()

    return {"items": items, "total": total_count}


def get_character(db: Session, character_id: int):
    return db.query(models.Character).filter(models.Character.id == character_id).first()


def create_character(db: Session, character: schemas.CharacterCreate, user_id: int):
    db_character = models.Character(**character.dict(), owner_id=user_id)
    db.add(db_character)
    db.commit()
    db.refresh(db_character)
    return db_character


def update_character(db: Session, character_id: int, character: schemas.CharacterBase):
    db_char = get_character(db, character_id)
    if not db_char:
        return None
    for key, value in character.dict(exclude_unset=True).items():
        setattr(db_char, key, value)
    db.commit()
    db.refresh(db_char)
    return db_char


def delete_character(db: Session, character_id: int):
    db_char = get_character(db, character_id)
    if db_char:
        db.delete(db_char)
        db.commit()
        return True
    return False


def update_story_image(db: Session, story_id: int, image_key: str) -> None:
    msg = db.query(models.StoryMessage).filter(models.StoryMessage.id == story_id).first()
    if msg:
        msg.image_key = image_key
        db.commit()


def create_story_message(db: Session, character_id: int, user_input: str, ai_response: str, image_key: str = None):
    db_story = models.StoryMessage(
        character_id=character_id,
        user_input=user_input,
        ai_response=ai_response,
        image_key=image_key
    )
    db.add(db_story)
    db.commit()
    db.refresh(db_story)
    return db_story


def get_story_by_character(db: Session, character_id: int, current_user_id: int | None = None):
    stories = db.query(models.StoryMessage).filter(models.StoryMessage.character_id == character_id).all()
    ids = [s.id for s in stories]
    counts = rating_counts_bulk(db, ids)
    my = get_user_ratings_bulk(db, current_user_id, ids) if current_user_id else {}

    result = []
    for story in stories:
        c = counts.get(story.id, {"likes": 0, "skulls": 0, "fires": 0})
        story_dict = {
            "id": story.id,
            "character_id": story.character_id,
            "user_input": story.user_input,
            "ai_response": story.ai_response,
            "timestamp": story.timestamp,
            "image_url": get_presigned_url(story.image_key) if story.image_key else None,
            **c,
            "my_rating": my.get(story.id),
        }
        result.append(story_dict)

    return result

def create_refresh_token_db(db: Session, user_id: int, jti: str, expires_at: datetime):
    """Записываем jti токена в базу"""
    db_token = models.RefreshToken(
        jti=jti,
        user_id=user_id,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token

def get_refresh_token(db: Session, jti: str):
    """Ищем токен в базе по его уникальному ID"""
    return db.query(models.RefreshToken).filter(models.RefreshToken.jti == jti).first()

def revoke_refresh_token(db: Session, jti: str):
    """Отзываем токен (ставим флаг is_revoked)"""
    db_token = get_refresh_token(db, jti)
    if db_token:
        db_token.is_revoked = True
        db.commit()
    return True

def update_user_role(db: Session, user_id: int, role: str):
    """Смена роли юзера (для админки из Лабы 1)"""
    db_user = get_user(db, user_id)
    if db_user:
        db_user.role = role
        db.commit()
        db.refresh(db_user)
    return db_user


# ── Inventory ─────────────────────────────────────────────────────────────

def get_items_by_character(db: Session, character_id: int, include_used: bool = False):
    query = db.query(models.Item).filter(models.Item.character_id == character_id)
    if not include_used:
        query = query.filter(models.Item.is_used == False)
    return query.order_by(models.Item.created_at.desc()).all()


def get_item(db: Session, item_id: int):
    return db.query(models.Item).filter(models.Item.id == item_id).first()


def create_item(db: Session, character_id: int, item: schemas.ItemCreate):
    db_item = models.Item(
        character_id=character_id,
        name=item.name,
        description=item.description,
        effect_type=item.effect_type,
        effect_value=item.effect_value,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def mark_item_used(db: Session, item_id: int):
    db_item = get_item(db, item_id)
    if db_item:
        db_item.is_used = True
        db.commit()
        db.refresh(db_item)
    return db_item


def delete_item(db: Session, item_id: int):
    db_item = get_item(db, item_id)
    if db_item:
        db.delete(db_item)
        db.commit()
        return True
    return False


# ── Companions ────────────────────────────────────────────────────────────

_COMPANION_DEFAULT_NAMES = {
    "wolf": "Сумрачный Волк",
    "skeleton": "Костяной Страж",
    "spirit": "Павший Дух",
}


def get_companion(db: Session, character_id: int):
    return (
        db.query(models.Companion)
        .filter(models.Companion.character_id == character_id)
        .first()
    )


def create_companion(db: Session, character_id: int, kind: str, name: str | None = None):
    existing = get_companion(db, character_id)
    if existing:
        return existing
    display_name = (name or _COMPANION_DEFAULT_NAMES.get(kind, kind.capitalize())).strip()
    db_comp = models.Companion(
        character_id=character_id,
        kind=kind,
        name=display_name,
        hp=20,
        is_alive=True,
    )
    db.add(db_comp)
    db.commit()
    db.refresh(db_comp)
    return db_comp


def delete_companion(db: Session, character_id: int) -> bool:
    comp = get_companion(db, character_id)
    if not comp:
        return False
    db.delete(comp)
    db.commit()
    return True


# ── Admin stats ───────────────────────────────────────────────────────────

def get_admin_stats(db: Session):
    from datetime import datetime as _dt, time as _time
    total_users = db.query(models.User).count()
    total_characters = db.query(models.Character).count()
    alive = db.query(models.Character).filter(models.Character.is_alive == True).count()
    dead = total_characters - alive
    total_stories = db.query(models.StoryMessage).count()

    start_of_day = _dt.combine(_dt.utcnow().date(), _time.min)
    stories_today = (
        db.query(models.StoryMessage)
        .filter(models.StoryMessage.timestamp >= start_of_day)
        .count()
    )

    roles = db.query(models.User.role).all()
    by_role: dict[str, int] = {}
    for (r,) in roles:
        key = r or "user"
        by_role[key] = by_role.get(key, 0) + 1

    return {
        "total_users": total_users,
        "total_characters": total_characters,
        "alive_characters": alive,
        "dead_characters": dead,
        "stories_today": stories_today,
        "total_stories": total_stories,
        "by_role": by_role,
    }


# ── Story ratings & feed ──────────────────────────────────────────────────

def get_rating_counts(db: Session, message_id: int) -> dict:
    """Агрегаты по рейтингам одного сообщения."""
    from sqlalchemy import func
    rows = (
        db.query(models.StoryRating.kind, func.count(models.StoryRating.id))
        .filter(models.StoryRating.message_id == message_id)
        .group_by(models.StoryRating.kind)
        .all()
    )
    out = {"likes": 0, "skulls": 0, "fires": 0}
    mapping = {"like": "likes", "skull": "skulls", "fire": "fires"}
    for kind, cnt in rows:
        key = mapping.get(kind)
        if key:
            out[key] = cnt
    return out


def rating_counts_bulk(db: Session, message_ids: list[int]) -> dict[int, dict]:
    """Агрегаты по рейтингам для кучи сообщений. Возвращает {message_id: {likes, skulls, fires}}."""
    if not message_ids:
        return {}
    from sqlalchemy import func
    rows = (
        db.query(
            models.StoryRating.message_id,
            models.StoryRating.kind,
            func.count(models.StoryRating.id),
        )
        .filter(models.StoryRating.message_id.in_(message_ids))
        .group_by(models.StoryRating.message_id, models.StoryRating.kind)
        .all()
    )
    mapping = {"like": "likes", "skull": "skulls", "fire": "fires"}
    out: dict[int, dict] = {mid: {"likes": 0, "skulls": 0, "fires": 0} for mid in message_ids}
    for mid, kind, cnt in rows:
        key = mapping.get(kind)
        if key:
            out[mid][key] = cnt
    return out


def get_user_ratings_bulk(db: Session, user_id: int, message_ids: list[int]) -> dict[int, str]:
    """Возвращает {message_id: kind} — как этот юзер оценил каждое сообщение."""
    if not message_ids:
        return {}
    rows = (
        db.query(models.StoryRating.message_id, models.StoryRating.kind)
        .filter(
            models.StoryRating.user_id == user_id,
            models.StoryRating.message_id.in_(message_ids),
        )
        .all()
    )
    return {mid: kind for mid, kind in rows}


def toggle_rating(db: Session, message_id: int, user_id: int, kind: str) -> dict:
    """Переключение голоса: добавить / поменять / снять. Возвращает агрегаты + my_rating."""
    existing = (
        db.query(models.StoryRating)
        .filter(
            models.StoryRating.message_id == message_id,
            models.StoryRating.user_id == user_id,
        )
        .first()
    )
    my_rating: str | None = kind
    if existing is None:
        new = models.StoryRating(message_id=message_id, user_id=user_id, kind=kind)
        db.add(new)
    elif existing.kind == kind:
        # тот же клик — снимаем
        db.delete(existing)
        my_rating = None
    else:
        existing.kind = kind
    db.commit()

    counts = get_rating_counts(db, message_id)
    return {"message_id": message_id, "my_rating": my_rating, **counts}


def get_public_feed(db: Session, limit: int = 30) -> list[dict]:
    """Последние N ai-ответов всех игроков, без игрового мусора."""
    rows = (
        db.query(models.StoryMessage)
        .join(models.Character, models.Character.id == models.StoryMessage.character_id)
        .join(models.User, models.User.id == models.Character.owner_id)
        .order_by(models.StoryMessage.id.desc())
        .limit(limit)
        .all()
    )
    msg_ids = [r.id for r in rows]
    counts = rating_counts_bulk(db, msg_ids)

    feed = []
    for r in rows:
        char = r.character
        owner = char.owner if char else None
        c = counts.get(r.id, {"likes": 0, "skulls": 0, "fires": 0})
        feed.append({
            "message_id": r.id,
            "character_id": char.id if char else 0,
            "character_name": char.name if char else "???",
            "race": char.race if char else "unknown",
            "character_class": (getattr(char, "character_class", "warrior") if char else "warrior") or "warrior",
            "owner_id": owner.id if owner else 0,
            "owner_name": owner.name if owner else "???",
            "user_input": r.user_input or "",
            "ai_response": r.ai_response or "",
            "image_key": r.image_key,
            "timestamp": r.timestamp,
            **c,
        })
    return feed


# ── Leaderboard / Graveyard / Character stats ─────────────────────────────

def get_leaderboard(db: Session, limit: int = 50, metric: str = "level"):
    """Топ живых персонажей. metric: level | xp_total | stories."""
    q = db.query(models.Character).filter(models.Character.is_alive == True)  # noqa: E712
    if metric == "level":
        q = q.order_by(models.Character.level.desc(), models.Character.xp.desc())
    elif metric == "xp_total":
        # Грубая метрика: level*100 + xp (стабильная сортировка)
        q = q.order_by(
            (models.Character.level * 100 + models.Character.xp).desc()
        )
    elif metric == "stories":
        from sqlalchemy import func
        sub = (
            db.query(
                models.StoryMessage.character_id.label("cid"),
                func.count(models.StoryMessage.id).label("cnt"),
            )
            .group_by(models.StoryMessage.character_id)
            .subquery()
        )
        q = (
            db.query(models.Character)
            .outerjoin(sub, sub.c.cid == models.Character.id)
            .filter(models.Character.is_alive == True)  # noqa: E712
            .order_by(func.coalesce(sub.c.cnt, 0).desc())
        )
    return q.limit(limit).all()


def get_graveyard(db: Session, limit: int = 50):
    """Павшие герои, отсортированные по дате смерти (по created_at desc как прокси)."""
    return (
        db.query(models.Character)
        .filter(models.Character.is_alive == False)  # noqa: E712
        .order_by(models.Character.id.desc())
        .limit(limit)
        .all()
    )


def get_character_stats(db: Session, character_id: int) -> dict:
    """Детальная статистика персонажа: ходы, предметы использованы/выкинуты, дропы по типам."""
    from sqlalchemy import func
    char = get_character(db, character_id)
    if not char:
        return {}
    total_turns = (
        db.query(models.StoryMessage)
        .filter(models.StoryMessage.character_id == character_id)
        .count()
    )
    items_used = (
        db.query(models.Item)
        .filter(models.Item.character_id == character_id, models.Item.is_used == True)  # noqa: E712
        .count()
    )
    items_in_bag = (
        db.query(models.Item)
        .filter(models.Item.character_id == character_id, models.Item.is_used == False)  # noqa: E712
        .count()
    )
    by_effect_rows = (
        db.query(models.Item.effect_type, func.count(models.Item.id))
        .filter(models.Item.character_id == character_id)
        .group_by(models.Item.effect_type)
        .all()
    )
    by_effect = {etype or "none": cnt for etype, cnt in by_effect_rows}

    return {
        "character_id": character_id,
        "name": char.name,
        "level": char.level or 1,
        "xp": char.xp or 0,
        "is_alive": char.is_alive,
        "total_turns": total_turns,
        "items_used": items_used,
        "items_in_bag": items_in_bag,
        "items_by_effect": by_effect,
        "created_at": char.created_at,
    }


# ── XP/Level ──────────────────────────────────────────────────────────────

def xp_threshold(level: int) -> int:
    """XP нужно для следующего уровня. Простая квадратичная кривая."""
    return 50 + (level - 1) * 75


def _grant_levelup_item(db: Session, character: models.Character):
    import random
    level = character.level
    if level <= 4:
        pool = [
            ("Зелье восстановления", "heal", 12, "Награда за упорство — исцеляет раны"),
            ("Эликсир крепости", "stat_boost", 1, "+1 к силе. Варится из корней древнего дуба"),
            ("Настойка выносливости", "heal", 10, "Стандартная боевая настойка"),
        ]
    elif level <= 9:
        pool = [
            ("Кровь дракона", "berserk", 5, "Мощный эликсир ярости для опытных воинов"),
            ("Фиал высшего исцеления", "heal", 25, "Редкое зелье высшего качества"),
            ("Тёмный амулет силы", "stat_boost", 2, "+2 к силе. Артефакт тёмных руин"),
            ("Эссенция берсерка", "berserk", 4, "Усиливает ярость до предела"),
        ]
    else:
        pool = [
            ("Философский камень", "heal", 50, "Легендарный артефакт алхимиков. Исцеляет всё"),
            ("Кровь Бездны", "berserk", 10, "Сила самой тьмы — невероятная, опасная ярость"),
            ("Рунный амулет мощи", "stat_boost", 3, "+3 к силе. Выкован в пламени дракона"),
            ("Сердце Феникса", "heal", 40, "Восстанавливает даже смертельные раны"),
        ]
    name, etype, eval_, desc = random.choice(pool)
    create_item(db, character.id, schemas.ItemCreate(
        name=name, description=f"🎁 Получен за повышение до {level} уровня. {desc}",
        effect_type=etype, effect_value=eval_,
    ))


def add_xp_and_maybe_levelup(db: Session, character: models.Character, xp_gain: int) -> dict:
    """Начисляет XP; если перевалило за порог — повышает уровень, бафает статы и даёт предмет."""
    if not character.is_alive:
        return {"xp_gained": 0, "leveled_up": False}

    character.xp = (character.xp or 0) + xp_gain
    leveled_up = False
    levels_gained = 0

    while character.xp >= xp_threshold(character.level):
        character.xp -= xp_threshold(character.level)
        character.level += 1
        character.hp += 3
        character.strength += 1
        character.dexterity += 1
        leveled_up = True
        levels_gained += 1
        _grant_levelup_item(db, character)

    db.commit()
    db.refresh(character)
    return {"xp_gained": xp_gain, "leveled_up": leveled_up, "levels_gained": levels_gained}


# ── Achievements (derived) ────────────────────────────────────────────────

_ACHIEVEMENTS = [
    ("FIRST_BLOOD",     "Первая кровь",       "Сделай первый ход в истории",                "🩸"),
    ("VETERAN_10",      "Ветеран",             "10 ходов истории",                           "🎖️"),
    ("EPIC_50",         "Эпос",                "50 ходов истории",                           "📜"),
    ("RISING_STAR",     "Восходящая звезда",   "Достигни 3-го уровня",                       "⭐"),
    ("LEGEND_10",       "Легенда",             "Достигни 10-го уровня",                      "👑"),
    ("PACK_LEADER",     "Вожак стаи",          "Заведи живого компаньона",                   "🐾"),
    ("ARENA_WARRIOR",   "Воин арены",          "Выиграй первый PvP-бой",                     "⚔️"),
    ("ARENA_CHAMPION",  "Чемпион арены",       "Выиграй 5 PvP-боёв",                         "🏆"),
    ("SURVIVOR",        "Выживший",            "Остаться живым с 5+ ходами истории",         "💪"),
    ("NECRO_BOND",      "Связь с бездной",     "Некромант + скелет-компаньон",                "💀"),
]


def get_character_achievements(db: Session, character_id: int):
    char = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not char:
        return []
    turns = db.query(models.StoryMessage).filter(models.StoryMessage.character_id == character_id).count()
    level = char.level or 1
    companion = db.query(models.Companion).filter(models.Companion.character_id == character_id).first()
    arena_wins = db.query(models.ArenaMatch).filter(models.ArenaMatch.winner_id == character_id).count()

    unlocks = {
        "FIRST_BLOOD":    turns >= 1,
        "VETERAN_10":     turns >= 10,
        "EPIC_50":        turns >= 50,
        "RISING_STAR":    level >= 3,
        "LEGEND_10":      level >= 10,
        "PACK_LEADER":    bool(companion and companion.is_alive),
        "ARENA_WARRIOR":  arena_wins >= 1,
        "ARENA_CHAMPION": arena_wins >= 5,
        "SURVIVOR":       bool(char.is_alive) and turns >= 5,
        "NECRO_BOND":     (getattr(char, "character_class", None) == "necromancer") and bool(companion and companion.kind == "skeleton"),
    }

    return [
        {"code": code, "title": title, "description": descr, "icon": icon, "unlocked": unlocks.get(code, False)}
        for code, title, descr, icon in _ACHIEVEMENTS
    ]


# ── Arena ─────────────────────────────────────────────────────────────────

def get_arena_opponents(db: Session, current_user_id: int, limit: int = 30):
    """Живые персонажи других игроков — потенциальные соперники."""
    rows = (
        db.query(models.Character, models.User)
        .join(models.User, models.User.id == models.Character.owner_id)
        .filter(models.Character.is_alive == True)
        .filter(models.Character.owner_id != current_user_id)
        .order_by(models.Character.level.desc(), models.Character.id.desc())
        .limit(limit)
        .all()
    )
    result = []
    for char, owner in rows:
        result.append({
            "id": char.id,
            "name": char.name,
            "race": char.race,
            "character_class": getattr(char, "character_class", "warrior") or "warrior",
            "level": char.level or 1,
            "hp": char.hp,
            "strength": char.strength,
            "dexterity": char.dexterity,
            "owner_id": owner.id,
            "owner_name": owner.name,
            "avatar_url": get_presigned_url(char.avatar_key) if char.avatar_key else None,
        })
    return result


def simulate_arena_fight(db: Session, attacker_id: int, defender_id: int):
    """PvP до смерти: победитель грабит предметы, проигравший умирает навсегда."""
    import random

    atk = db.query(models.Character).filter(models.Character.id == attacker_id).first()
    defn = db.query(models.Character).filter(models.Character.id == defender_id).first()
    if not atk or not defn:
        return None

    a_hp = atk.hp
    d_hp = defn.hp
    atk_comp = atk.companion if (atk.companion and atk.companion.is_alive) else None
    def_comp = defn.companion if (defn.companion and defn.companion.is_alive) else None

    HIT = [
        "{a} наносит удар — {b} получает {dmg} урона (осталось {hp} HP)",
        "{a} бьёт {b} — {dmg} урона, у {b} {hp} HP",
        "{a} атакует и попадает! {b} получает {dmg} урона (HP: {hp})",
        "Удар {a} достигает цели — {b} теряет {dmg} HP (осталось {hp})",
    ]
    MISS = [
        "{b} уклоняется — удар {a} проходит мимо",
        "{a} промахивается, {b} успевает отскочить",
        "{b} вовремя отступает назад, удар {a} режет воздух",
        "{a} бьёт — {b} уходит в сторону",
    ]
    FUMBLE = [
        "{a} спотыкается и теряет равновесие — промах!",
        "Удар {a} уходит в пустоту",
        "{a} поскальзывается — атака не удалась",
    ]
    CRIT = [
        "💥 Сокрушительный удар {a}! {b} получает {dmg} урона (осталось {hp} HP)",
        "💥 {a} бьёт в полную силу — {dmg} урона! У {b} осталось {hp} HP",
        "💥 {a} находит брешь в защите {b} — {dmg} урона (HP: {hp})",
    ]

    log_lines = [
        f"⚔️  {atk.name} против {defn.name}",
        f"   {atk.name}: {a_hp} HP, сила {atk.strength}, ловкость {atk.dexterity}",
        f"   {defn.name}: {d_hp} HP, сила {defn.strength}, ловкость {defn.dexterity}",
    ]
    if atk_comp:
        log_lines.append(f"   Рядом с {atk.name} — {atk_comp.name} ({atk_comp.kind})")
    if def_comp:
        log_lines.append(f"   Рядом с {defn.name} — {def_comp.name} ({def_comp.kind})")
    log_lines.append("")

    def do_attack(attacker, defender, def_hp, comp):
        """Возвращает (new_def_hp, log_line, comp_line|None)."""
        roll = random.randint(1, 20)
        hit_threshold = 10 + defender.dexterity
        line = ""
        if roll == 20:
            dmg = max(1, attacker.strength + roll // 2)
            def_hp -= dmg
            line = random.choice(CRIT).format(a=attacker.name, b=defender.name, dmg=dmg, hp=max(0, def_hp))
        elif roll == 1:
            line = random.choice(FUMBLE).format(a=attacker.name, b=defender.name)
        elif roll + attacker.strength >= hit_threshold:
            dmg = max(1, attacker.strength // 2 + max(0, roll + attacker.strength - hit_threshold) // 3)
            def_hp -= dmg
            line = random.choice(HIT).format(a=attacker.name, b=defender.name, dmg=dmg, hp=max(0, def_hp))
        else:
            line = random.choice(MISS).format(a=attacker.name, b=defender.name)

        comp_line = None
        if comp and def_hp > 0:
            comp_dmg = random.randint(1, 6) + 1
            def_hp -= comp_dmg
            comp_line = f"   🐾 {comp.name} бросается на {defender.name} — {comp_dmg} урона (осталось {max(0, def_hp)} HP)"

        return def_hp, line, comp_line

    rounds = 0
    for r in range(1, 11):
        rounds = r
        log_lines.append(f"── Раунд {r} ──")

        d_hp, line, cline = do_attack(atk, defn, d_hp, atk_comp)
        log_lines.append(line)
        if cline:
            log_lines.append(cline)
        if d_hp <= 0:
            break

        a_hp, line, cline = do_attack(defn, atk, a_hp, def_comp)
        log_lines.append(line)
        if cline:
            log_lines.append(cline)
        if a_hp <= 0:
            break
        log_lines.append("")

    # Определяем победителя
    winner_id = None
    winner_char = None
    loser_char = None
    if d_hp <= 0 and a_hp > 0:
        winner_id, winner_char, loser_char = atk.id, atk, defn
    elif a_hp <= 0 and d_hp > 0:
        winner_id, winner_char, loser_char = defn.id, defn, atk
    elif a_hp != d_hp:
        if a_hp > d_hp:
            winner_id, winner_char, loser_char = atk.id, atk, defn
        else:
            winner_id, winner_char, loser_char = defn.id, defn, atk
        remaining = a_hp if winner_char == atk else d_hp
        other_hp = d_hp if winner_char == atk else a_hp
        log_lines.append("")
        log_lines.append(f"⏱️ 10 раундов. {winner_char.name} выигрывает по очкам ({remaining} против {other_hp} HP).")

    log_lines.append("")
    xp_gained = 0
    looted = []

    if winner_char and loser_char:
        log_lines.append(f"🏳️ {loser_char.name} признаёт поражение!")

        # Победитель забирает один случайный предмет из инвентаря
        loot = (
            db.query(models.Item)
            .filter(models.Item.character_id == loser_char.id, models.Item.is_used == False)
            .limit(1)
            .all()
        )
        for item in loot:
            item.character_id = winner_char.id
            looted.append(item.name)
        if looted:
            log_lines.append(f"💰 {winner_char.name} забирает трофей: {', '.join(looted)}")

        # Штраф проигравшему: потеря 10% XP
        xp_loss = max(0, int((loser_char.xp or 0) * 0.1))
        loser_char.xp = max(0, (loser_char.xp or 0) - xp_loss)
        if xp_loss > 0:
            log_lines.append(f"📉 {loser_char.name} теряет {xp_loss} XP от позора поражения.")

        db.flush()

        # Награда победителю
        xp_gained = 60
        add_xp_and_maybe_levelup(db, winner_char, xp_gained)
        log_lines.append(f"🏆 Победа {winner_char.name}! +{xp_gained} XP")
    else:
        # Ничья — утешительные очки
        log_lines.append("🤝 Ничья — оба выстояли!")
        xp_gained = 15
        add_xp_and_maybe_levelup(db, atk, xp_gained)
        add_xp_and_maybe_levelup(db, defn, 15)

    match = models.ArenaMatch(
        attacker_id=atk.id,
        defender_id=defn.id,
        winner_id=winner_id,
        rounds=rounds,
        log="\n".join(log_lines),
    )
    db.add(match)
    db.commit()
    db.refresh(match)

    return {
        "id": match.id,
        "attacker_id": atk.id,
        "attacker_name": atk.name,
        "defender_id": defn.id,
        "defender_name": defn.name,
        "winner_id": winner_id,
        "winner_name": winner_char.name if winner_char else None,
        "rounds": rounds,
        "log": match.log,
        "xp_gained": xp_gained,
        "created_at": match.created_at,
    }


def get_arena_history(db: Session, user_id: int, limit: int = 20):
    """Последние матчи, где участвовал любой персонаж текущего игрока."""
    my_char_ids = [
        c.id for c in db.query(models.Character).filter(models.Character.owner_id == user_id).all()
    ]
    if not my_char_ids:
        return []
    matches = (
        db.query(models.ArenaMatch)
        .filter(
            or_(
                models.ArenaMatch.attacker_id.in_(my_char_ids),
                models.ArenaMatch.defender_id.in_(my_char_ids),
            )
        )
        .order_by(models.ArenaMatch.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for m in matches:
        atk = db.query(models.Character).filter(models.Character.id == m.attacker_id).first()
        defn = db.query(models.Character).filter(models.Character.id == m.defender_id).first()
        winner_name = None
        if m.winner_id:
            w = db.query(models.Character).filter(models.Character.id == m.winner_id).first()
            if w:
                winner_name = w.name
        result.append({
            "id": m.id,
            "attacker_id": m.attacker_id,
            "attacker_name": atk.name if atk else "???",
            "defender_id": m.defender_id,
            "defender_name": defn.name if defn else "???",
            "winner_id": m.winner_id,
            "winner_name": winner_name,
            "rounds": m.rounds,
            "log": m.log,
            "xp_gained": 0,
            "created_at": m.created_at,
        })
    return result