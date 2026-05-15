"""Модульные тесты адаптера D&D API (Лаба №4). Внешний HTTP замокан."""
import pytest

import services.dnd_service as dnd_module
from services.dnd_service import ExternalApiError, get_random_inspiration


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError("err", request=None, response=None)


class FakeAsyncClient:
    """Мок httpx.AsyncClient с настраиваемыми ответами."""

    def __init__(self, *, base_url=None, responses=None, raise_exc=None):
        self._responses = responses or {}
        self._raise = raise_exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, path, timeout=None):
        if self._raise:
            raise self._raise
        if path not in self._responses:
            raise AssertionError(f"Unexpected path: {path}")
        return self._responses[path]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_inspiration_normalizes_spell(monkeypatch):
    responses = {
        "/spells": FakeResponse({"results": [{"index": "fireball"}]}),
        "/spells/fireball": FakeResponse({
            "index": "fireball",
            "name": "Fireball",
            "level": 3,
            "school": {"name": "Evocation"},
            "desc": ["Bright streak", "flashes to a point"],
        }),
    }

    def fake_client(base_url=None):
        return FakeAsyncClient(responses=responses)

    monkeypatch.setattr(dnd_module.httpx, "AsyncClient", fake_client)
    # Детерминируем выбор заклинания.
    monkeypatch.setattr(dnd_module.random, "random", lambda: 0.1)
    monkeypatch.setattr(dnd_module.random, "choice", lambda xs: xs[0])

    result = await get_random_inspiration()
    assert result["kind"] == "spell"
    assert result["name"] == "Fireball"
    assert result["level"] == 3
    assert result["school"] == "Evocation"
    assert result["source"] == "dnd5eapi"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_inspiration_raises_on_network_error(monkeypatch):
    import httpx

    def fake_client(base_url=None):
        return FakeAsyncClient(raise_exc=httpx.ConnectError("boom"))

    monkeypatch.setattr(dnd_module.httpx, "AsyncClient", fake_client)
    # Уменьшим retries для скорости теста.
    monkeypatch.setattr(dnd_module, "DND_API_RETRIES", 1)

    with pytest.raises(ExternalApiError):
        await get_random_inspiration()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_inspiration_empty_listing(monkeypatch):
    responses = {"/spells": FakeResponse({"results": []})}

    def fake_client(base_url=None):
        return FakeAsyncClient(responses=responses)

    monkeypatch.setattr(dnd_module.httpx, "AsyncClient", fake_client)
    monkeypatch.setattr(dnd_module.random, "random", lambda: 0.1)

    with pytest.raises(ExternalApiError):
        await get_random_inspiration()
