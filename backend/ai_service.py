try:
    import torch
    from transformers import GPT2LMHeadModel, GPT2Tokenizer
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

from PIL import Image, ImageDraw
import io
import base64
import random
import hashlib
import os
import httpx

import urllib.parse

HF_TOKEN = os.getenv("HF_TOKEN", "")
POLLINATIONS_API = "https://image.pollinations.ai/prompt/{encoded}?width=512&height=512&nologo=true&model=flux"


# ── Генерация подсказок действий (A/B/C) ──────────────────────────────────

_HINT_POOLS: dict[str, list[str]] = {
    "aggressive": [
        "Атакую врага изо всех сил",
        "Бросаюсь в бой с яростью",
        "Наношу сокрушительный удар",
        "Рублю с разворота",
        "Колю прямо в сердце",
    ],
    "clever": [
        "Осматриваю местность",
        "Ищу скрытые ловушки",
        "Крадусь в тени",
        "Пытаюсь договориться",
        "Читаю древние руны",
        "Прислушиваюсь к шорохам",
    ],
    "escape": [
        "Отступаю в безопасное место",
        "Прячусь за обломками",
        "Бегу прочь что есть сил",
        "Зову на помощь",
        "Делаю обманный манёвр",
    ],
    "explore": [
        "Иду глубже в подземелья",
        "Поднимаю древний артефакт",
        "Зажигаю факел",
        "Открываю тяжёлую дверь",
        "Спускаюсь по тёмной лестнице",
    ],
}

_CLASS_HINTS: dict[str, list[str]] = {
    "berserker": [
        "Впадаю в кровавую ярость",
        "Рвусь вперёд, не обращая внимания на боль",
    ],
    "necromancer": [
        "Призываю духа павшего воина",
        "Высасываю жизнь из противника",
    ],
    "rogue": [
        "Бью в спину из тени",
        "Бросаю отравленный кинжал",
    ],
    "warrior": [],
}


def generate_action_hints(
    user_action: str,
    event_text: str,
    character_class: str = "warrior",
    hp: int = 100,
) -> list[str]:
    """Возвращает 3 коротких варианта действий для следующего хода.

    Контекст определяется по последнему действию/событию: бой, исследование, соц.
    Обязательно включаются вариант «агрессивный», «умный», «отступить»,
    плюс редкий классовый вариант заменяет один из слотов.
    """
    action = (user_action or "").lower()
    event = (event_text or "").lower()

    combat_keywords = ("атак", "бью", "удар", "руб", "враг", "призрак", "демон", "паук", "некромант", "ловушк")
    explore_keywords = ("иду", "захожу", "вижу", "осматр", "ищу", "открыв", "руины", "подземел", "лестниц")

    in_combat = any(w in action for w in combat_keywords) or any(w in event for w in combat_keywords)
    exploring = any(w in action for w in explore_keywords) or any(w in event for w in explore_keywords)

    if in_combat:
        aggressive = random.choice(_HINT_POOLS["aggressive"])
        clever = random.choice(_HINT_POOLS["clever"])
        escape = random.choice(_HINT_POOLS["escape"])
    elif exploring:
        aggressive = random.choice(_HINT_POOLS["aggressive"])
        clever = random.choice(_HINT_POOLS["explore"])
        escape = random.choice(_HINT_POOLS["clever"])
    else:
        aggressive = random.choice(_HINT_POOLS["aggressive"])
        clever = random.choice(_HINT_POOLS["clever"])
        escape = random.choice(_HINT_POOLS["escape"])

    hints = [aggressive, clever, escape]

    # В 35% случаев подменяем один слот на классовую подсказку
    class_pool = _CLASS_HINTS.get(character_class, [])
    if class_pool and random.random() < 0.35:
        slot = random.randint(0, 2)
        hints[slot] = random.choice(class_pool)

    # При низком HP один слот — точно «отступить»
    if hp <= 25 and all("беги" not in h.lower() and "отступ" not in h.lower() for h in hints):
        hints[2] = "Отступаю и лечу раны"

    # Уникализируем
    seen: set[str] = set()
    unique: list[str] = []
    for h in hints:
        if h not in seen:
            seen.add(h)
            unique.append(h)
    while len(unique) < 3:
        extra = random.choice(_HINT_POOLS["clever"])
        if extra not in seen:
            seen.add(extra)
            unique.append(extra)
    return unique[:3]


async def generate_dark_fantasy_image(scene: str) -> str:
    """Генерирует dark fantasy изображение через Pollinations.ai (бесплатно, без ключа).
    Пробует несколько моделей с коротким таймаутом; на неудаче — пусто."""
    prompt = (
        f"dark fantasy art, {scene}, "
        "dramatic lighting, gothic atmosphere, cinematic, highly detailed, "
        "dark medieval fantasy, ominous mood"
    )
    encoded = urllib.parse.quote(prompt)
    seed = random.randint(1, 10_000_000)
    attempts = [
        f"https://image.pollinations.ai/prompt/{encoded}?width=512&height=512&nologo=true&model=turbo&seed={seed}",
        f"https://image.pollinations.ai/prompt/{encoded}?width=512&height=512&nologo=true&seed={seed}",
        f"https://image.pollinations.ai/prompt/{encoded}?width=512&height=512&nologo=true&model=flux&seed={seed}",
    ]
    async with httpx.AsyncClient(timeout=20.0) as client:
        for url in attempts:
            try:
                resp = await client.get(url, follow_redirects=True)
                if resp.status_code == 200 and resp.content and resp.headers.get("content-type", "").startswith("image/"):
                    b64 = base64.b64encode(resp.content).decode()
                    return f"data:image/jpeg;base64,{b64}"
                print(f"⚠️ Pollinations returned {resp.status_code} for {url[:80]}")
            except Exception as exc:
                print(f"⚠️ Pollinations attempt failed: {type(exc).__name__}")
                continue
    return ""

MODEL_NAME = "ai-forever/rugpt3small_based_on_gpt2"

device = "cpu"
print(f"🔧 AI Device: {device} | torch available: {TORCH_AVAILABLE}")

tokenizer = None
model = None

def load_text_model():
    global tokenizer, model
    if not TORCH_AVAILABLE:
        print("⚠️ torch/transformers not installed — AI fallback mode active")
        return
    print(f"🔄 Loading lightweight model ({MODEL_NAME})...")
    tokenizer = GPT2Tokenizer.from_pretrained(MODEL_NAME)
    model = GPT2LMHeadModel.from_pretrained(MODEL_NAME)
    model.to(device)
    model.eval()
    print("✅ Lightweight model loaded")

def generate_story_text(character_name: str, character_race: str, hp: int, strength: int, 
                        user_action: str, event_text: str, mode: str) -> str:
    """AI генерирует текст. Если есть event_text — добавляет его"""
    
    if not TORCH_AVAILABLE or model is None:
        return create_smart_story(character_name, character_race, hp, strength, user_action, event_text, mode)

    genre = "ужасов и безумия" if mode == "horror" else "тёмного фэнтези"
    
    if event_text:
        prompt = f"{character_name} ({character_race}) в мире {genre}. {user_action}. Неожиданно: {event_text}. "
    else:
        prompt = f"{character_name} ({character_race}) в мире {genre}. {user_action}. "
    
    try:
        inputs = tokenizer(prompt, return_tensors="pt", max_length=128, truncation=True).to(device)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=60,
                temperature=0.75,
                top_p=0.92,
                do_sample=True,
                repetition_penalty=1.5,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
        text = generated.replace(prompt, "").strip()
        
        if text and len(text) > 20 and not any(bad in text.lower() for bad in ["http", "www", "©", "...", "продолжение следует"]):
            text = text.split(".")[0] + "."
            
            emoji = "💀" if mode == "horror" else "⚔️"
            result = f"{emoji} {text}"
            
            if hp <= 15:
                result += f" ☠️ HP: {hp} — СМЕРТЬ БЛИЗКО!"
            elif hp <= 40:
                result += f" ⚠️ HP: {hp}"
            elif hp >= 80:
                result += f" ✨ HP: {hp}"
            else:
                result += f" HP: {hp}"
            
            return result[:400]
    
    except Exception as e:
        print(f"❌ AI error: {e}")
    
    return create_smart_story(character_name, character_race, hp, strength, user_action, event_text, mode)

def create_smart_story(character_name: str, character_race: str, hp: int, strength: int, 
                       user_action: str, event_text: str, mode: str) -> str:
    """Умный fallback с контекстом"""
    
    action = user_action.lower()
    
    if any(w in action for w in ["вижу", "смотрю", "замечаю", "наблюдаю", "вгляд"]):
        stories = [
            f"👁️ {character_name} видит ужасающую картину. ",
            f"🔍 Взгляд {character_name} останавливается на странном. ",
            f"😨 {character_name} замечает что-то пугающее. "
        ]
        
        if event_text:
            return random.choice(stories) + f"{event_text}. HP: {hp}."
        else:
            return random.choice(stories) + f"Тени скрывают тайны. HP: {hp}."
    
    elif any(w in action for w in ["атак", "удар", "напад", "бью", "убива", "руб", "дерусь"]):
        stories = [
            f"⚔️ {character_name} атакует с яростью! ",
            f"💥 Клинок {character_name} рассекает врага! ",
            f"🗡️ {character_name} наносит смертельный удар! "
        ]
        
        if event_text:
            return random.choice(stories) + f"{event_text}. HP: {hp}."
        else:
            return random.choice(stories) + f"Враг корчится от боли. HP: {hp}."
    
    elif any(w in action for w in ["бегу", "убегаю", "отступ", "спасаюсь"]):
        stories = [
            f"🏃 {character_name} мчится прочь от опасности! ",
            f"💨 {character_name} спасается бегством! ",
            f"🌑 {character_name} бежит сквозь тьму! "
        ]
        
        if event_text:
            return random.choice(stories) + f"{event_text}. HP: {hp}."
        else:
            return random.choice(stories) + f"Монстры воют за спиной. HP: {hp}."
    
    elif any(w in action for w in ["иду", "исслед", "вход", "заход", "открыва", "ищу"]):
        stories = [
            f"🌲 {character_name} углубляется в неизвестность. ",
            f"🕯️ {character_name} осторожно идёт вперёд. ",
            f"🚪 {character_name} открывает путь. "
        ]
        
        if event_text:
            return random.choice(stories) + f"{event_text}. HP: {hp}."
        else:
            return random.choice(stories) + f"Мрак сгущается впереди. HP: {hp}."
    
    elif any(w in action for w in ["знаком", "говор", "беседу", "разговор", "встреч"]):
        stories = [
            f"💬 {character_name} встречает странного путника. ",
            f"🗣️ {character_name} вступает в беседу. ",
            f"👤 {character_name} знакомится с незнакомцем. "
        ]
        
        if event_text:
            return random.choice(stories) + f"{event_text}. HP: {hp}."
        else:
            return random.choice(stories) + f"Слова звучат зловеще. HP: {hp}."
    
    elif any(w in action for w in ["защищ", "блок", "парир", "укрыв", "щит"]):
        stories = [
            f"🛡️ {character_name} поднимает щит! ",
            f"⚡ {character_name} блокирует атаку! "
        ]
        
        if event_text:
            return random.choice(stories) + f"{event_text}. HP: {hp}."
        else:
            return random.choice(stories) + f"Удар отражён. HP: {hp}."
    
    else:
        stories = [
            f"🌑 {character_name} действует: {user_action}. ",
            f"💀 {character_name} совершает рискованный шаг. ",
            f"🔥 {character_name} продолжает путь. "
        ]
        
        if event_text:
            return random.choice(stories) + f"{event_text}. HP: {hp}."
        else:
            return random.choice(stories) + f"Судьба непредсказуема. HP: {hp}."

def generate_scene_image(description: str, mode: str) -> str:
    """Генерирует уникальные картинки"""
    
    seed = int(hashlib.md5(description.encode()).hexdigest()[:8], 16)
    random.seed(seed)
    
    img = Image.new('RGB', (512, 512), color=(5, 0, 10))
    draw = ImageDraw.Draw(img)
    
    if mode == "horror":
        colors = [(75, 0, 130), (50, 0, 50), (100, 0, 0), (30, 0, 30), (80, 0, 80)]
        text = "💀 COSMIC HORROR 💀"
        bg = (8, 0, 12)
    else:
        colors = [(80, 0, 0), (50, 20, 80), (100, 50, 0), (60, 10, 40), (90, 30, 20)]
        text = "⚔️ DARK FANTASY ⚔️"
        bg = (12, 5, 18)
    
    for i in range(0, 512, 2):
        for j in range(0, 512, 2):
            noise = random.randint(-25, 25)
            color = tuple(max(0, min(255, c + noise)) for c in bg)
            draw.rectangle([i, j, i+2, j+2], fill=color)
    
    for _ in range(random.randint(100, 180)):
        x, y = random.randint(0, 512), random.randint(0, 512)
        r = random.randint(5, 60)
        shape = random.choice(['circle', 'rect', 'line'])
        color = random.choice(colors)
        
        if shape == 'circle':
            draw.ellipse([x-r, y-r, x+r, y+r], fill=color)
        elif shape == 'rect':
            draw.rectangle([x-r, y-r, x+r, y+r], fill=color)
        else:
            x2, y2 = random.randint(0, 512), random.randint(0, 512)
            draw.line([x, y, x2, y2], fill=color, width=random.randint(2, 5))
    
    try:
        bbox = draw.textbbox((256, 50), text)
        w = bbox[2] - bbox[0]
        draw.rectangle([256-w//2-12, 38, 256+w//2+12, 72], fill=(0, 0, 0))
        draw.text((256-w//2, 45), text, fill=(220, 180, 255))
    except:
        pass
    
    for i in range(512):
        for j in range(512):
            dist = ((i-256)**2 + (j-256)**2)**0.5
            if dist > 210:
                darkness = int((dist-210)/2)
                pixel = img.getpixel((i, j))
                draw.point((i, j), fill=tuple(max(0, c-darkness) for c in pixel))
    
    random.seed()
    
    buffered = io.BytesIO()
    img.save(buffered, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"

def load_models():
    load_text_model()
    print("✅ Smart AI ready")
