from typing import List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from dependencies import get_db, get_current_user
from schemas import ArenaOpponent, ArenaMatchOut, ArenaFightRequest
from models import User, Character, ArenaMatch
import crud

DAILY_FIGHT_LIMIT = 5

router = APIRouter(prefix="/arena", tags=["arena"])


@router.get("/opponents", response_model=List[ArenaOpponent])
def list_opponents(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Живые соперники других игроков."""
    return crud.get_arena_opponents(db, current_user.id, limit=limit)


@router.post("/fight", response_model=ArenaMatchOut)
def fight(
    payload: ArenaFightRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """PvP-поединок. Атакующий — персонаж текущего игрока, защищающийся — чужой живой."""
    atk = db.query(Character).filter(Character.id == payload.attacker_id).first()
    if not atk:
        raise HTTPException(status_code=404, detail="Атакующий не найден")
    if atk.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Этот персонаж не твой")
    if not atk.is_alive:
        raise HTTPException(status_code=400, detail="Мёртвые не сражаются")

    defn = db.query(Character).filter(Character.id == payload.defender_id).first()
    if not defn:
        raise HTTPException(status_code=404, detail="Соперник не найден")
    if defn.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя биться со своим же персом")
    if not defn.is_alive:
        raise HTTPException(status_code=400, detail="Соперник мёртв")

    # Лимит 5 дуэлей в день с одного аккаунта
    my_char_ids = [
        c.id for c in db.query(Character).filter(Character.owner_id == current_user.id).all()
    ]
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    fights_today = (
        db.query(ArenaMatch)
        .filter(ArenaMatch.attacker_id.in_(my_char_ids))
        .filter(ArenaMatch.created_at >= today_start)
        .count()
    )
    if fights_today >= DAILY_FIGHT_LIMIT:
        raise HTTPException(status_code=429, detail=f"Лимит {DAILY_FIGHT_LIMIT} дуэлей в день исчерпан. Возвращайся завтра.")

    result = crud.simulate_arena_fight(db, payload.attacker_id, payload.defender_id)
    if not result:
        raise HTTPException(status_code=500, detail="Бой не состоялся")
    return result


@router.get("/history", response_model=List[ArenaMatchOut])
def history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """История боёв текущего игрока."""
    return crud.get_arena_history(db, current_user.id, limit=limit)
