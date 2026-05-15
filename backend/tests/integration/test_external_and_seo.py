"""
Интеграционные тесты эндпоинтов внешнего API и SEO (Лаба №4, проверка из Лабы №5).
Внешние зависимости замоканы — тесты не ходят в реальный D&D API.
"""
import pytest

import routers.external as external_module
from services.dnd_service import ExternalApiError


@pytest.mark.integration
class TestExternalInspiration:
    def test_success_returns_normalized_payload(self, client, monkeypatch):
        async def fake_inspire():
            return {
                "kind": "spell",
                "id": "magic-missile",
                "name": "Magic Missile",
                "level": 1,
                "school": "Evocation",
                "description": "three glowing darts",
                "source": "dnd5eapi",
            }

        monkeypatch.setattr(external_module, "get_random_inspiration", fake_inspire)
        resp = client.get("/api/external/inspiration")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Magic Missile"
        assert body["kind"] == "spell"

    def test_external_failure_returns_503(self, client, monkeypatch):
        async def fake_fail():
            raise ExternalApiError("upstream down")

        monkeypatch.setattr(external_module, "get_random_inspiration", fake_fail)
        resp = client.get("/api/external/inspiration")
        assert resp.status_code == 503


@pytest.mark.integration
class TestSeoEndpoints:
    def test_robots_txt(self, client):
        resp = client.get("/robots.txt")
        assert resp.status_code == 200
        assert "User-agent: *" in resp.text
        assert "Disallow: /admin" in resp.text
        assert "Sitemap:" in resp.text

    def test_sitemap_xml(self, client):
        resp = client.get("/sitemap.xml")
        assert resp.status_code == 200
        assert "application/xml" in resp.headers.get("content-type", "")
        assert "<urlset" in resp.text
        assert "<loc>" in resp.text

    def test_ping_ok(self, client):
        assert client.get("/ping").json() == {"status": "ok"}
