import base64
import random
import uuid
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile

from crud import (
    get_characters_by_user,
    get_character,
    create_character,
    delete_character,
    create_story_message,
    get_story_by_character,
    create_item,
    add_xp_and_maybe_levelup,
)
from schemas import CharacterCreate, ItemCreate
from models import Character, Item, User
from permissions import has_permission
from s3_client import upload_image_to_s3, upload_file_to_s3, get_presigned_url, delete_file_from_s3
from ai_service import (
    generate_story_text,
    generate_scene_image,
    generate_dark_fantasy_image,
    generate_action_hints,
)

# Ограничения для загружаемых файлов (Лаба 3)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class CharacterService:
    """Сервисный слой для персонажей, историй и файлов (Лаба 2 + 3)."""

    def __init__(self, db: Session):
        self.db = db

    # ── Вспомогательные методы ─────────────────────────────────────────────

    def _char_to_dict(self, char: Character) -> dict:
        """Конвертирует ORM-объект в словарь, добавляя avatar_url."""
        return {
            "id": char.id,
            "owner_id": char.owner_id,
            "name": char.name,
            "race": char.race,
            "weapon": char.weapon,
            "hp": char.hp,
            "strength": char.strength,
            "dexterity": char.dexterity,
            "is_alive": char.is_alive,
            "avatar_key": char.avatar_key,
            "avatar_url": get_presigned_url(char.avatar_key) if char.avatar_key else None,
            "level": getattr(char, "level", 1) or 1,
            "xp": getattr(char, "xp", 0) or 0,
            "created_at": getattr(char, "created_at", None),
            "status_poison": getattr(char, "status_poison", 0) or 0,
            "status_bleeding": getattr(char, "status_bleeding", 0) or 0,
            "status_berserk": getattr(char, "status_berserk", 0) or 0,
            "character_class": getattr(char, "character_class", "warrior") or "warrior",
            "has_story": any(True for _ in (char.story_messages or [])) if hasattr(char, "story_messages") else False,
            "companion": (
                {
                    "id": char.companion.id,
                    "character_id": char.companion.character_id,
                    "kind": char.companion.kind,
                    "name": char.companion.name,
                    "hp": char.companion.hp,
                    "is_alive": char.companion.is_alive,
                    "created_at": char.companion.created_at,
                }
                if getattr(char, "companion", None)
                else None
            ),
        }

    # Alias для роутеров, ожидающих CharacterOut-совместимый словарь
    def _character_to_dict(self, char: Character) -> dict:
        return self._char_to_dict(char)

    # ── Инвентарь: применение эффектов ────────────────────────────────────

    def apply_item_effect(self, char: Character, item: Item) -> dict:
        """Применяет эффект предмета к персонажу. Возвращает описание эффекта."""
        etype = (item.effect_type or "none").lower()
        val = item.effect_value or 0
        log = ""

        # Mystery potion: случайный исход
        if etype == "mystery":
            outcome = random.choice(
                ["big_heal", "small_heal", "damage", "poison", "berserk", "stat_boost", "nothing"]
            )
            if outcome == "big_heal":
                heal = random.randint(12, 20)
                char.hp = min(100, char.hp + heal)
                log = f"✨ Зелье засияло — +{heal} HP!"
            elif outcome == "small_heal":
                heal = random.randint(3, 7)
                char.hp = min(100, char.hp + heal)
                log = f"💧 Лёгкое тепло разлилось — +{heal} HP"
            elif outcome == "damage":
                dmg = random.randint(8, 18)
                char.hp = max(0, char.hp - dmg)
                if char.hp == 0:
                    char.is_alive = False
                log = f"☠️ Зелье оказалось ядом — −{dmg} HP"
            elif outcome == "poison":
                char.status_poison = max(char.status_poison, 3)
                log = "🧪 По венам растекается жгучий яд (яд 3 хода)"
            elif outcome == "berserk":
                char.status_berserk = max(char.status_berserk, 3)
                log = "🔥 Кровь вскипает — берсерк 3 хода!"
            elif outcome == "stat_boost":
                boost = random.randint(1, 3)
                char.strength += boost
                char.dexterity += boost
                log = f"⚡ Мышцы укрепляются — +{boost} STR, +{boost} DEX"
            else:
                log = "💨 Зелье выдохлось и не дало никакого эффекта"
        elif etype == "heal":
            heal = max(1, val)
            char.hp = min(100, char.hp + heal)
            log = f"❤️ +{heal} HP"
        elif etype == "damage":
            dmg = max(1, val)
            char.hp = max(0, char.hp - dmg)
            if char.hp == 0:
                char.is_alive = False
            log = f"💥 −{dmg} HP"
        elif etype == "cure_poison":
            had_poison = char.status_poison > 0 or char.status_bleeding > 0
            char.status_poison = 0
            char.status_bleeding = 0
            log = "🩹 Яд и кровотечение сняты" if had_poison else "🩹 Чистая кровь"
        elif etype == "berserk":
            char.status_berserk = max(char.status_berserk, max(3, val))
            log = f"🔥 Берсерк {max(3, val)} ходов"
        elif etype == "cursed":
            dmg = max(2, val)
            char.hp = max(0, char.hp - dmg)
            char.status_bleeding = max(char.status_bleeding, 2)
            if char.hp == 0:
                char.is_alive = False
            log = f"💀 Проклятие: −{dmg} HP, кровотечение 2 хода"
        elif etype == "stat_boost":
            boost = max(1, val)
            char.strength += boost
            char.dexterity += boost
            log = f"⚡ +{boost} STR, +{boost} DEX"
        else:
            log = "📜 Предмет не дал механического эффекта"

        self.db.commit()
        return {"log": log, "hp": char.hp, "is_alive": char.is_alive}

    # ── Персонажи ──────────────────────────────────────────────────────────

    def get_characters(
        self,
        user: User,
        skip: int,
        limit: int,
        search: str | None,
        race: str | None,
        sort_by: str,
        order: str,
    ) -> dict:
        """Получение списка персонажей с пагинацией и фильтрацией."""
        if has_permission(user.role, "character:read_any") and search == "ALL_USERS":
            total = self.db.query(Character).count()
            items = self.db.query(Character).offset(skip).limit(limit).all()
            return {"items": [self._char_to_dict(c) for c in items], "total": total}

        result = get_characters_by_user(
            self.db, user.id, skip, limit, search, race, sort_by, order
        )
        return {
            "items": [self._char_to_dict(c) for c in result["items"]],
            "total": result["total"],
        }

    def get_character(self, character_id: int, user: User) -> dict:
        """Получение персонажа с проверкой прав доступа."""
        char = get_character(self.db, character_id)
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")

        is_owner = char.owner_id == user.id
        can_read_any = has_permission(user.role, "character:read_any")
        if not (is_owner or can_read_any):
            raise HTTPException(status_code=403, detail="Access denied")

        return self._char_to_dict(char)

    def create(self, character: CharacterCreate, user_id: int) -> dict:
        char = create_character(self.db, character, user_id)
        return self._char_to_dict(char)

    def delete(self, character_id: int, user: User) -> None:
        """Удаление персонажа с очисткой файлов из S3."""
        char = get_character(self.db, character_id)
        if not char:
            raise HTTPException(status_code=404, detail="Not found")

        is_owner = char.owner_id == user.id
        if is_owner:
            if not has_permission(user.role, "character:delete_own"):
                raise HTTPException(
                    status_code=403,
                    detail="Missing required permission: character:delete_own",
                )
        else:
            if not has_permission(user.role, "character:delete_any"):
                raise HTTPException(
                    status_code=403,
                    detail="Missing required permission: character:delete_any",
                )

        # Удаляем аватар из S3 если есть
        if char.avatar_key:
            delete_file_from_s3(char.avatar_key)

        delete_character(self.db, character_id)

    # ── Истории ────────────────────────────────────────────────────────────

    async def generate_story(
        self, character_id: int, user_input: str, mode: str, user: User
    ) -> dict:
        """Генерация текста истории + загрузка сцены в S3."""
        character = get_character(self.db, character_id)
        if not character or character.owner_id != user.id:
            raise HTTPException(
                status_code=404, detail="Character not found or not yours"
            )
        if not character.is_alive:
            raise HTTPException(status_code=400, detail="Персонаж мёртв, создай нового")

        # Классовые пассивки
        char_class = getattr(character, "character_class", "warrior") or "warrior"

        # Берсерк: авто-ярость при HP ≤ 30, если уже не в берсерке
        if char_class == "berserker" and character.hp <= 30 and character.status_berserk == 0:
            character.status_berserk = 3
            self.db.commit()

        # Тик статусов в начале хода
        status_log = ""
        if character.status_poison > 0:
            character.hp = max(0, character.hp - 2)
            character.status_poison -= 1
            status_log += f" ☠️ Яд (-2 HP, осталось {character.status_poison} ходов)"
        if character.status_bleeding > 0:
            character.hp = max(0, character.hp - 1)
            character.status_bleeding -= 1
            status_log += f" 🩸 Кровотечение (-1 HP, осталось {character.status_bleeding} ходов)"
        if character.status_berserk > 0:
            character.status_berserk -= 1
        self.db.commit()

        if character.hp <= 0:
            character.is_alive = False
            self.db.commit()
            final_text = f"💀 {character.name} погиб от ран." + status_log
            create_story_message(self.db, character_id, user_input, final_text, None)
            return {"text": final_text, "hp": 0, "game_over": True}

        # Случайное событие 25%
        event_text = ""
        hp_change = 0
        combat_log = ""  # Лог применения силы/ловкости
        dropped_item: Item | None = None
        if random.random() < 0.25:
            events = [
                # Негативные события (больше опасности)
                ("Внезапно из тени выскакивает призрак", -5, None),
                ("Ловушка срабатывает под ногами", -4, None),
                ("Тёмная энергия пронзает твоё тело, кровь течёт из ран", -6, None),
                ("Некромант насылает порчу — яд растекается по венам", -4, None),
                ("Демоническая лихорадка охватывает тело", -5, None),
                ("Паук плюнул ядом тебе в лицо", -3, ("Противоядие", "cure_poison", 0)),
                ("Проклятый алтарь забирает часть жизненной силы", -6, ("Проклятый талисман", "cursed", 3)),
                ("Шипы ловушки пронзают плечо — кровь не останавливается", -4, None),
                ("Демон вонзает когти в спину", -7, None),
                ("Взрыв магического кристалла обжигает тебя", -5, None),
                # Нейтральные / предметные (без немедленного лечения — предмет даст его сам)
                ("На алтаре лежит странное мерцающее зелье неизвестного состава", 0, ("Загадочное зелье", "mystery", 0)),
                ("Торговец-призрак предлагает обмен на мутное пойло в черепе", -1, ("Пойло Теней", "mystery", 0)),
                ("В сундуке под скелетом — флакон с живой жидкостью", 0, ("Живая кровь", "mystery", 0)),
                ("Свиток с печатью демона — ты решаешься его открыть", 0, ("Свиток Призыва", "mystery", 0)),
                ("В развалинах — фиал наполненный абсолютной тьмой", 0, ("Фиал Тьмы", "mystery", 0)),
                ("Кость некроманта хрустит под ногой — внутри амулет", 0, ("Амулет Некроманта", "mystery", 0)),
                ("Ты находишь зуб вурдалака — он тянет к себе", 0, ("Зуб Вурдалака", "cursed", 5)),
                # Предметные (лечение только через инвентарь, не сразу)
                ("Слёзы умирающей ведьмы в склянке — пригодятся позже", 0, ("Слёзы Ведьмы", "heal", 12)),
                ("Дракониха сбросила чешую — она светится тёплым светом", 0, ("Чешуя Дракона", "heal", 10)),
                ("Перо феникса — редкая находка", 0, ("Перо Феникса", "heal", 18)),
                ("Ты находишь зелье исцеления", 0, ("Зелье исцеления", "heal", 8)),
                ("Ты находишь кристалл душ — он восстанавливает раны", 0, ("Кристалл душ", "heal", 6)),
                # Небольшое позитивное (+2..+3) без предмета
                ("Дух павшего воина делится своей силой", +3, None),
                ("Обломок тёмного камня пульсирует силой", +2, ("Обломок Бездны", "stat_boost", 3)),
                ("Вихрь пыли оставил после себя кинжал из тёмного металла", 0, ("Кинжал Теней", "stat_boost", 2)),
                ("Золотая стрела пронзила тебя, но вместо боли — сила", 0, ("Золотая Стрела", "stat_boost", 2)),
                ("Древний клинок в руинах наполняет тебя энергией", 0, ("Тёмный клинок", "stat_boost", 2)),
                ("Ты нашёл сердце гоблинского шамана — ещё тёплое", 0, ("Сердце Шамана", "berserk", 6)),
                ("Кровавая луна усиливает твою мощь — ты впал в ярость", 0, ("Эликсир берсерка", "berserk", 4)),
                ("Пузырёк с лунным ядом. Пьёшь и чувствуешь как горит изнутри", -3, ("Лунный Яд", "damage", 8)),
                ("Ты находишь древний артефакт силы", 0, ("Амулет Силы", "stat_boost", 1)),
            ]
            event_text, hp_change, item_tpl = random.choice(events)

            # Применяем статусные эффекты от событий
            if "кровь течёт" in event_text:
                character.status_bleeding = max(character.status_bleeding, 3)
            if "яд" in event_text.lower() or "порчу" in event_text.lower():
                character.status_poison = max(character.status_poison, 3)
            if "ярость" in event_text.lower():
                character.status_berserk = max(character.status_berserk, 3)

            # Создаём предмет в инвентаре
            if item_tpl:
                name, etype, eval_ = item_tpl
                dropped_item = create_item(
                    self.db,
                    character.id,
                    ItemCreate(name=name, description=event_text, effect_type=etype, effect_value=eval_),
                )

            # Ловкость: шанс увернуться от урона (dex_roll vs threshold)
            if hp_change < 0:
                rogue_bonus = 5 if char_class == "rogue" else 0
                dex_roll = random.randint(1, 20) + character.dexterity + rogue_bonus
                threshold = 15 + abs(hp_change)
                if dex_roll >= threshold:
                    note = " (Разбойник)" if rogue_bonus else ""
                    combat_log = f" 🏃 Ловкость ({character.dexterity}){note} спасает от урона!"
                    hp_change = 0
                elif dex_roll >= threshold - 5:
                    saved = abs(hp_change) // 2
                    combat_log = f" 💨 Ловкость ({character.dexterity}) смягчает удар (−{saved})"
                    hp_change += saved

        # Сила: бонус к атакующим действиям игрока (берсерк даёт +5)
        action_lower = user_input.lower()
        is_attack = any(w in action_lower for w in ["атак", "бью", "убива", "руб", "удар", "напад"])
        effective_str = character.strength + (5 if character.status_berserk > 0 else 0)
        xp_gain = 5  # базовый опыт за действие

        # Компаньон: помогает в бою (XP бонус, не лечение)
        companion = getattr(character, "companion", None)
        companion_log = ""
        if companion and companion.is_alive and is_attack:
            comp_roll = random.randint(1, 20)
            if comp_roll >= 15:
                xp_gain += 6
                companion_log += f" 🐾 {companion.name} рвёт врага в клочья (+6 XP)"
            elif comp_roll >= 10:
                xp_gain += 3
                companion_log += f" 🐾 {companion.name} отвлекает врага (+3 XP)"
            elif comp_roll <= 3 and hp_change < 0:
                # провал — компаньон принимает удар на себя
                damage_to_comp = min(companion.hp, abs(hp_change))
                companion.hp = max(0, companion.hp - damage_to_comp)
                hp_change += damage_to_comp
                if companion.hp == 0:
                    companion.is_alive = False
                    companion_log += f" 💀 {companion.name} пал, защищая тебя..."
                else:
                    companion_log += f" 🛡️ {companion.name} принял удар (-{damage_to_comp} HP компаньона)"

        if is_attack:
            xp_gain = 10
            if random.random() < 0.45:
                str_roll = random.randint(1, 20) + effective_str
                if str_roll >= 20:
                    xp_gain += 15
                    combat_log += f" ⚔️ Сила ({effective_str}) сокрушает врага! +15 XP"
                    # Некромант: высасывает жизнь на критическом ударе (единственное исключение)
                    if char_class == "necromancer" and random.random() < 0.4:
                        heal = random.randint(2, 4)
                        hp_change += heal
                        combat_log += f" 🩸 Некромант поглощает жизнь врага (+{heal} HP)"
                elif str_roll >= 14:
                    combat_log += f" 💪 Сила ({effective_str}) помогает в бою"
                    xp_gain += 5

        if character.status_berserk > 0:
            combat_log += f" 🔥 Берсерк (+5 STR, {character.status_berserk} ходов)"

        new_hp = max(0, min(100, character.hp + hp_change))
        character.hp = new_hp

        if new_hp <= 0:
            character.is_alive = False
            self.db.commit()
            final_text = f"💀 {character.name} пал. История завершена."
            create_story_message(self.db, character_id, user_input, final_text, None)
            return {"text": final_text, "hp": 0, "game_over": True}

        self.db.commit()

        # Начисляем XP (может поднять уровень)
        level_info = add_xp_and_maybe_levelup(self.db, character, xp_gain)

        try:
            text = generate_story_text(
                character.name,
                character.race,
                new_hp,
                character.strength,
                user_input,
                event_text,
                mode,
            )
        except Exception:
            text = f"{character.name} продолжает путь. HP: {new_hp}."

        if status_log:
            text = text + status_log
        if combat_log:
            text = text + combat_log
        if companion_log:
            text = text + companion_log
        if dropped_item:
            text = text + f"\n🎒 Получен предмет: **{dropped_item.name}** ({dropped_item.effect_type})"
        if level_info.get("leveled_up"):
            text = text + f"\n✨ Уровень повышен! Теперь ур. {character.level}. +3 HP, +1 STR, +1 DEX."

        scene_prompt = f"{character.race}, {user_input}, {event_text or ''}".strip(", ")

        story_entry = create_story_message(self.db, character_id, user_input, text, None)

        hints = generate_action_hints(
            user_action=user_input,
            event_text=event_text,
            character_class=char_class,
            hp=character.hp,
        )

        return {
            "text": text,
            "image_url": None,
            "_story_id": story_entry.id,
            "_scene_prompt": scene_prompt,
            "hp": character.hp,
            "level": character.level,
            "xp": character.xp,
            "xp_gain": xp_gain,
            "leveled_up": level_info.get("leveled_up", False),
            "status_poison": character.status_poison,
            "status_bleeding": character.status_bleeding,
            "status_berserk": character.status_berserk,
            "hints": hints,
        }

    def get_story(self, character_id: int, user: User) -> list:
        """Получение истории персонажа с проверкой прав."""
        char = get_character(self.db, character_id)
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")

        is_owner = char.owner_id == user.id
        if is_owner:
            if not has_permission(user.role, "story:read_own"):
                raise HTTPException(
                    status_code=403,
                    detail="Missing required permission: story:read_own",
                )
        else:
            if not has_permission(user.role, "story:read_any"):
                raise HTTPException(
                    status_code=403,
                    detail="Missing required permission: story:read_any",
                )
        return get_story_by_character(self.db, character_id, current_user_id=user.id)

    # ── Файлы / Аватары (Лаба 3) ───────────────────────────────────────────

    async def upload_avatar(
        self, character_id: int, file: UploadFile, user: User
    ) -> dict:
        """Загрузка аватара персонажа в S3 с валидацией типа и размера."""
        char = get_character(self.db, character_id)
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")

        is_owner = char.owner_id == user.id
        if not is_owner and not has_permission(user.role, "character:delete_any"):
            raise HTTPException(status_code=403, detail="Access denied")

        # Валидация типа файла
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Недопустимый тип файла. Разрешены: JPEG, PNG, GIF, WebP",
            )

        # Чтение и валидация размера
        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400, detail="Файл слишком большой. Максимум 5 MB"
            )

        # Удаляем старый аватар если есть
        if char.avatar_key:
            delete_file_from_s3(char.avatar_key)

        # Загружаем новый
        ext = file.content_type.split("/")[1]
        file_name = f"avatars/{character_id}/{uuid.uuid4().hex}.{ext}"
        key = upload_file_to_s3(content, file_name, file.content_type)
        if not key:
            raise HTTPException(status_code=500, detail="Ошибка загрузки файла в хранилище")

        char.avatar_key = key
        self.db.commit()

        avatar_url = get_presigned_url(key)
        return {"avatar_url": avatar_url, "avatar_key": key}

    def delete_avatar(self, character_id: int, user: User) -> None:
        """Удаление аватара из S3 и очистка метаданных."""
        char = get_character(self.db, character_id)
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")

        is_owner = char.owner_id == user.id
        if not is_owner and not has_permission(user.role, "character:delete_any"):
            raise HTTPException(status_code=403, detail="Access denied")

        if not char.avatar_key:
            raise HTTPException(status_code=404, detail="У персонажа нет аватара")

        delete_file_from_s3(char.avatar_key)
        char.avatar_key = None
        self.db.commit()
