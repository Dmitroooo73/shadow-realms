# Тестирование (Лабораторная работа №5)

Документ описывает тестовую инфраструктуру MVP, введённую в рамках Лабораторной №5.

## Тестовая модель

### Критические пользовательские сценарии
- Регистрация и вход (access + refresh).
- Ротация refresh-токена, выход (отзыв сессии).
- Ролевая защита: `user`, `moderator`, `admin`.
- Работа со сторонним D&D API (graceful degradation).
- SEO-эндпоинты: `/robots.txt`, `/sitemap.xml`.

### Зоны повышенного риска
- Аутентификация и жизненный цикл токенов.
- RBAC (эндпоинты `/users/*`, смена ролей).
- Валидация ввода (password policy, age limit).
- Интеграция с внешним API (таймауты/ошибки).

---

## Backend (pytest)

### Запуск
```bash
cd backend
pip install -r requirements.txt
pytest                         # все тесты
pytest -m unit                 # только быстрые unit-тесты
pytest -m integration          # только интеграционные
pytest --cov=. --cov-report=term-missing
```

### Структура
```
backend/tests/
  conftest.py                    # in-memory SQLite, TestClient, фабрики
  unit/
    test_permissions.py          # матрица RBAC
    test_utils.py                # хэш паролей, JWT
    test_auth_service.py         # сервисный слой Auth (ротация, отзыв, валидация)
    test_dnd_service.py          # адаптер D&D API (httpx замокан)
  integration/
    test_auth_endpoints.py       # /auth/register, /auth/token, /auth/refresh, /auth/logout
    test_rbac.py                 # 401/403 по ролям
    test_external_and_seo.py     # /api/external/inspiration, /robots.txt, /sitemap.xml
```

### Инфраструктура
- Изолированная in-memory SQLite на каждый тест (`engine` fixture).
- Переопределение `get_db` через `app.dependency_overrides`.
- Мок `ai_service.load_models`, чтобы не грузить тяжёлые модели.
- Мок сторонних HTTP-вызовов через `monkeypatch` (без сети).
- `SECRET_KEY` и `DATABASE_URL` устанавливаются до импорта приложения.

### Маркеры
| marker        | что                                               |
|---------------|---------------------------------------------------|
| `unit`        | быстрые тесты без I/O                             |
| `integration` | TestClient + in-memory БД                         |
| `e2e`         | сквозные (запускаются отдельно через Playwright)  |

---

## Frontend (Vitest + React Testing Library)

### Запуск
```bash
cd frontend-new
npm install
npm test                 # один прогон
npm run test:watch       # watch
npm run test:coverage    # покрытие
```

### Структура
```
frontend-new/src/
  test/setup.ts                            # jest-dom, cleanup, env
  components/__tests__/
    Seo.test.tsx                           # установка title/meta/canonical
    Inspiration.test.tsx                   # loading/success/error/empty/503
    ProtectedRoute.test.tsx                # редиректы по ролям и isLoading
```

### Что покрыто
- Ролевое поведение UI и защита маршрутов.
- Обработка серверных ошибок (503, сеть, пустой ответ).
- Динамические мета-теги и canonical (SEO из Лабы №4).

---

## E2E (Playwright)

### Запуск
```bash
cd frontend-new
npm install
npx playwright install chromium
# Поднять backend и frontend в отдельных терминалах, затем:
npm run test:e2e
```

### Сценарии (`e2e/smoke.spec.ts`)
- Публичные страницы: home, login, canonical link.
- Редирект анонимного пользователя с `/profile` на `/login`.
- Graceful degradation блока «Вдохновение» при 503 от backend (через `page.route`).

---

## Метрики качества

- Разделение тестов: `unit` (быстрые), `integration` (TestClient), `e2e` (Playwright).
- Покрытие контролируется через `pytest-cov` на backend и `@vitest/coverage-v8` на frontend.
- Именование: `test_*.py` / `*.test.tsx`, классы `Test*`, методы `test_*`.
- Каждая фикстура БД пересоздаётся → тесты независимы и детерминированы.
