"""
Адаптер стороннего API D&D 5e (https://www.dnd5eapi.co).
Используется для получения "вдохновения" (случайное заклинание/монстр)
и нормализации ответа под внутренний формат приложения.

Реализовано по лабораторной №4:
- таймауты
- повторные попытки (retry с backoff)
- нормализация ответа
- ключи/базовый URL через переменные окружения
"""
from __future__ import annotations

import asyncio
import os
import random
from typing import Any, Optional

import httpx

DND_API_BASE = os.getenv("DND_API_BASE", "https://www.dnd5eapi.co/api/2014")
DND_API_TIMEOUT = float(os.getenv("DND_API_TIMEOUT", "5.0"))
DND_API_RETRIES = int(os.getenv("DND_API_RETRIES", "2"))


class ExternalApiError(Exception):
    """Сторонний API недоступен или вернул некорректный ответ."""


async def _translate_en_ru(text: str) -> str:
    """Переводит текст en→ru через бесплатный MyMemory API. При ошибке возвращает оригинал."""
    if not text:
        return text
    try:
        async with httpx.AsyncClient() as tr:
            resp = await tr.get(
                "https://api.mymemory.translated.net/get",
                params={"q": text[:500], "langpair": "en|ru"},
                timeout=4.0,
            )
            translated = resp.json().get("responseData", {}).get("translatedText", "")
            return translated if translated else text
    except Exception:
        return text


async def _get_json(client: httpx.AsyncClient, path: str) -> Any:
    last_exc: Optional[Exception] = None
    for attempt in range(DND_API_RETRIES + 1):
        try:
            resp = await client.get(path, timeout=DND_API_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            last_exc = exc
            if attempt < DND_API_RETRIES:
                await asyncio.sleep(0.3 * (attempt + 1))
    raise ExternalApiError(f"D&D API failure: {last_exc}")


def _normalize_spell(raw: dict) -> dict:
    return {
        "kind": "spell",
        "id": raw.get("index", ""),
        "name": raw.get("name", ""),
        "level": raw.get("level"),
        "school": (raw.get("school") or {}).get("name"),
        "description": " ".join(raw.get("desc") or [])[:600],
        "source": "dnd5eapi",
    }


def _normalize_monster(raw: dict) -> dict:
    return {
        "kind": "monster",
        "id": raw.get("index", ""),
        "name": raw.get("name", ""),
        "type": raw.get("type"),
        "challenge_rating": raw.get("challenge_rating"),
        "hit_points": raw.get("hit_points"),
        "description": (raw.get("desc") or "")[:600] if isinstance(raw.get("desc"), str) else "",
        "source": "dnd5eapi",
    }


async def get_random_inspiration() -> dict:
    """
    Случайная сущность из D&D API — заклинание или монстр.
    Возвращается нормализованный словарь.
    """
    async with httpx.AsyncClient(base_url=DND_API_BASE, follow_redirects=True) as client:
        pick_spell = random.random() < 0.5
        resource = "spells" if pick_spell else "monsters"

        listing = await _get_json(client, f"/{resource}")
        results = listing.get("results") or []
        if not results:
            raise ExternalApiError("empty listing from D&D API")

        chosen = random.choice(results)
        index = chosen.get("index")
        if not index:
            raise ExternalApiError("missing index in D&D API item")

        detail = await _get_json(client, f"/{resource}/{index}")
        result = _normalize_spell(detail) if pick_spell else _normalize_monster(detail)

    name_ru, desc_ru = await asyncio.gather(
        _translate_en_ru(result["name"]),
        _translate_en_ru(result.get("description", "")),
    )
    result["name"] = name_ru
    result["description"] = desc_ru
    return result
