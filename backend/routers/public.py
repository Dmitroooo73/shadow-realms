from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from dependencies import get_db, get_current_user
from schemas import LeaderboardEntry, GraveyardEntry, CharacterStatsOut, FeedEntry, AchievementOut
from models import User
from s3_client import get_presigned_url
import crud

router = APIRouter(tags=["public"])


def _char_to_leaderboard(char) -> dict:
    return {
        "id": char.id,
        "name": char.name,
        "race": char.race,
        "character_class": getattr(char, "character_class", "warrior") or "warrior",
        "level": char.level or 1,
        "xp": char.xp or 0,
        "hp": char.hp,
        "owner_id": char.owner_id,
        "avatar_url": get_presigned_url(char.avatar_key) if char.avatar_key else None,
    }


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def leaderboard(
    metric: Literal["level", "xp_total", "stories"] = Query("level"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Топ живых героев (требует авторизации)."""
    chars = crud.get_leaderboard(db, limit=limit, metric=metric)
    return [_char_to_leaderboard(c) for c in chars]


@router.get("/graveyard", response_model=List[GraveyardEntry])
def graveyard(
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Павшие герои всех игроков."""
    from models import StoryMessage
    chars = crud.get_graveyard(db, limit=limit)
    result = []
    for c in chars:
        turns = (
            db.query(StoryMessage).filter(StoryMessage.character_id == c.id).count()
        )
        result.append({
            "id": c.id,
            "name": c.name,
            "race": c.race,
            "character_class": getattr(c, "character_class", "warrior") or "warrior",
            "level": c.level or 1,
            "hp": c.hp,
            "owner_id": c.owner_id,
            "avatar_url": get_presigned_url(c.avatar_key) if c.avatar_key else None,
            "created_at": c.created_at,
            "total_turns": turns,
        })
    return result


@router.get("/feed", response_model=List[FeedEntry])
def public_feed(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Последние действия всех игроков (для Home live feed)."""
    rows = crud.get_public_feed(db, limit=limit)
    result = []
    for r in rows:
        r = dict(r)
        image_key = r.pop("image_key", None)
        r["image_url"] = get_presigned_url(image_key) if image_key else None
        result.append(r)
    return result


@router.get("/characters/{character_id}/achievements", response_model=List[AchievementOut])
def character_achievements(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Вычисляемые бейджи-достижения персонажа."""
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return crud.get_character_achievements(db, character_id)


@router.get("/characters/{character_id}/stats", response_model=CharacterStatsOut)
def character_stats(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Детальная статистика персонажа."""
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    # Читает любой авторизованный — статистика нужна в графике лидерборда
    return crud.get_character_stats(db, character_id)
