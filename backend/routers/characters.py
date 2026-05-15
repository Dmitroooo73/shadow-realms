from fastapi import APIRouter, Depends, Body, Query, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import base64, uuid

from dependencies import get_db, get_current_user, require_permission
from schemas import CharacterCreate, CharacterOut, PaginatedCharactersOut, ItemOut
from models import User
from services.character_service import CharacterService
from ai_service import generate_dark_fantasy_image
from s3_client import upload_image_to_s3
from crud import update_story_image
from database import SessionLocal
import crud


async def _generate_image_bg(story_id: int, scene_prompt: str) -> None:
    """Генерирует картинку и сохраняет в БД; запускается как фоновая задача."""
    db = SessionLocal()
    try:
        img_b64 = await generate_dark_fantasy_image(scene_prompt)
        if not img_b64:
            return
        b64_part = img_b64.split(",", 1)[1] if "," in img_b64 else img_b64
        image_bytes = base64.b64decode(b64_part)
        ext = "jpg" if img_b64.startswith("data:image/jpeg") else "png"
        file_name = f"stories/{story_id}/{uuid.uuid4().hex}.{ext}"
        image_key = upload_image_to_s3(image_bytes, file_name)
        if image_key:
            update_story_image(db, story_id, image_key)
    except Exception as exc:
        print(f"⚠️ bg image task failed: {exc}")
    finally:
        db.close()

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("/", response_model=PaginatedCharactersOut)
def read_characters(
    skip: int = Query(0, ge=0, description="Сколько записей пропустить"),
    limit: int = Query(10, ge=1, le=100, description="Сколько записей вернуть"),
    search: str = Query(None, description="Поиск по имени"),
    race: str = Query(None, description="Фильтр по расе"),
    sort_by: str = Query("id", description="Поле сортировки (id, name, race, hp)"),
    order: str = Query("desc", pattern="^(asc|desc)$", description="asc|desc"),
    current_user: User = Depends(require_permission("character:read_own")),
    db: Session = Depends(get_db),
):
    """Список персонажей с пагинацией, фильтрацией и сортировкой (Лаба 3)."""
    service = CharacterService(db)
    return service.get_characters(current_user, skip, limit, search, race, sort_by, order)


@router.post("/", response_model=CharacterOut)
def create_new_character(
    character: CharacterCreate,
    current_user: User = Depends(require_permission("character:create")),
    db: Session = Depends(get_db),
):
    """Создание нового персонажа."""
    service = CharacterService(db)
    return service.create(character, current_user.id)


@router.get("/{character_id}", response_model=CharacterOut)
def read_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получение персонажа по ID."""
    service = CharacterService(db)
    return service.get_character(character_id, current_user)


@router.delete("/{character_id}")
def delete_char(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Удаление персонажа (владелец или admin)."""
    service = CharacterService(db)
    service.delete(character_id, current_user)
    return {"detail": "Deleted"}


@router.post("/generate")
async def generate_story(
    background_tasks: BackgroundTasks,
    input: str = Body(...),
    mode: str = Body(...),
    characterId: int = Body(...),
    current_user: User = Depends(require_permission("story:generate")),
    db: Session = Depends(get_db),
):
    """Генерация текста истории; картинка генерируется в фоне."""
    service = CharacterService(db)
    result = await service.generate_story(characterId, input, mode, current_user)
    story_id = result.pop("_story_id", None)
    scene_prompt = result.pop("_scene_prompt", None)
    if story_id and scene_prompt:
        background_tasks.add_task(_generate_image_bg, story_id, scene_prompt)
    return result


# ── Управление аватарами персонажей (Лаба 3) ──────────────────────────────

@router.post("/{character_id}/avatar")
async def upload_avatar(
    character_id: int,
    file: UploadFile = File(..., description="Изображение (JPEG/PNG/GIF/WebP, макс 5MB)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Загрузка аватара персонажа в объектное хранилище."""
    service = CharacterService(db)
    return await service.upload_avatar(character_id, file, current_user)


@router.delete("/{character_id}/avatar")
def delete_avatar(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Удаление аватара из хранилища и очистка метаданных."""
    service = CharacterService(db)
    service.delete_avatar(character_id, current_user)
    return {"detail": "Avatar deleted"}


# ── Инвентарь ────────────────────────────────────────────────────────────

def _check_char_ownership(db: Session, character_id: int, user: User):
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your character")
    return char


@router.get("/{character_id}/items", response_model=List[ItemOut])
def list_items(
    character_id: int,
    include_used: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Список предметов в инвентаре персонажа."""
    _check_char_ownership(db, character_id, current_user)
    return crud.get_items_by_character(db, character_id, include_used=include_used)


@router.post("/{character_id}/items/{item_id}/use")
def use_item(
    character_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Использовать предмет: применяет эффект на персонажа. Возвращает character + effect_log."""
    char = _check_char_ownership(db, character_id, current_user)
    item = crud.get_item(db, item_id)
    if not item or item.character_id != character_id:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.is_used:
        raise HTTPException(status_code=400, detail="Item already used")
    if not char.is_alive:
        raise HTTPException(status_code=400, detail="Character is dead")

    service = CharacterService(db)
    effect = service.apply_item_effect(char, item)
    crud.mark_item_used(db, item_id)
    db.refresh(char)
    return {"character": service._character_to_dict(char), "effect_log": effect.get("log", "")}


@router.delete("/{character_id}/items/{item_id}")
def drop_item(
    character_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Удалить (выкинуть) предмет из инвентаря."""
    _check_char_ownership(db, character_id, current_user)
    item = crud.get_item(db, item_id)
    if not item or item.character_id != character_id:
        raise HTTPException(status_code=404, detail="Item not found")
    crud.delete_item(db, item_id)
    return {"detail": "Item dropped"}
