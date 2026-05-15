"""
Общие фикстуры для тестовой инфраструктуры (Лаба №5, п.5).

Что обеспечивается:
- изолированная in-memory SQLite БД на каждый тест;
- override зависимости get_db у FastAPI;
- TestClient с переопределённой БД;
- фабрики пользователей (user/admin) и auth-заголовков;
- автоочистка состояния между тестами.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Тестовый SECRET_KEY и БД — ставим ДО импорта приложения.
os.environ.setdefault("SECRET_KEY", "test-secret-key-please-change")
os.environ.setdefault("REFRESH_SECRET_KEY", "test-refresh-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

# Позволяем pytest находить код backend (если запускать из корня репо).
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database as db_module
from database import Base
from dependencies import get_db as real_get_db
from utils import get_password_hash


@pytest.fixture
def engine():
    """Свежий in-memory SQLite engine на каждый тест."""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture
def db_session(engine):
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(engine, monkeypatch):
    """TestClient с переопределённой зависимостью get_db."""
    # Подменяем SessionLocal на уровне database.py чтобы и lifespan, и роуты
    # использовали тестовый engine.
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(db_module, "SessionLocal", TestingSession, raising=True)
    monkeypatch.setattr(db_module, "engine", engine, raising=True)

    # ai_service.load_models делает загрузку тяжёлых моделей — замокаем.
    import ai_service
    monkeypatch.setattr(ai_service, "load_models", lambda: None)

    from main import app

    def _override_get_db():
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[real_get_db] = _override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── Фабрики пользователей ─────────────────────────────────────────────────

def _make_user(session, email: str, password: str, role: str, name: str = "Test", age: int = 20):
    from models import User

    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        name=name,
        age=age,
        role=role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture
def make_user(engine):
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _factory(email="user@test.io", password="Passw0rd!", role="user", name="Юзер", age=20):
        s = TestingSession()
        try:
            return _make_user(s, email, password, role, name, age)
        finally:
            s.close()

    return _factory


@pytest.fixture
def auth_headers(client, make_user):
    """Логинит пользователя и возвращает Authorization header."""
    def _factory(email="user@test.io", password="Passw0rd!", role="user"):
        make_user(email=email, password=password, role=role)
        resp = client.post(
            "/auth/token",
            data={"username": email, "password": password},
        )
        assert resp.status_code == 200, resp.text
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _factory
