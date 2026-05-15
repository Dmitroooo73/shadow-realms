from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db, get_current_user
from schemas import CompanionCreate, CompanionOut
from models import User
import crud

router = APIRouter(prefix="/characters/{character_id}/companion", tags=["companions"])


def _owned_character(db: Session, character_id: int, user: User):
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your character")
    return char


@router.get("", response_model=CompanionOut | None)
def get_companion(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_character(db, character_id, current_user)
    return crud.get_companion(db, character_id)


@router.post("", response_model=CompanionOut)
def create_companion(
    character_id: int,
    payload: CompanionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_character(db, character_id, current_user)
    if crud.get_companion(db, character_id):
        raise HTTPException(status_code=400, detail="У персонажа уже есть компаньон")
    return crud.create_companion(db, character_id, payload.kind, payload.name)


@router.delete("")
def delete_companion(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_character(db, character_id, current_user)
    ok = crud.delete_companion(db, character_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Компаньон не найден")
    return {"detail": "Компаньон отпущен"}
