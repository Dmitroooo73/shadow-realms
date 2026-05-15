from typing import List
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db, get_current_user, require_permission
from schemas import StoryMessageOut, StoryRatingCreate, StoryRatingOut
from models import User, StoryMessage
from services.character_service import CharacterService
import crud

router = APIRouter(prefix="/stories", tags=["stories"])


@router.get("/{character_id}", response_model=List[StoryMessageOut])
def get_story(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """История персонажа (владелец или модератор/admin)."""
    service = CharacterService(db)
    return service.get_story(character_id, current_user)


@router.post("/messages/{message_id}/rate", response_model=StoryRatingOut)
def rate_message(
    message_id: int,
    payload: StoryRatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Переключение реакции (like/skull/fire) на сообщении истории. Повторный клик — снимает."""
    msg = db.query(StoryMessage).filter(StoryMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return crud.toggle_rating(db, message_id, current_user.id, payload.kind)


@router.post("/generate")
async def generate_story(
    input: str = Body(...),
    mode: str = Body(...),
    characterId: int = Body(...),
    current_user: User = Depends(require_permission("story:generate")),
    db: Session = Depends(get_db),
):
    """Генерация хода истории (alias для /characters/generate — логически относится к stories)."""
    service = CharacterService(db)
    return await service.generate_story(characterId, input, mode, current_user)
