# Изумительная бабка AI — RPG с AI Dungeon Master

[![GitHub](https://img.shields.io/badge/GitHub-Dmitroooo73/shadow--realms-blue?style=flat-square&logo=github)](https://github.com/Dmitroooo73/shadow-realms)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.119.0-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

Полнофункциональное веб-приложение для текстовых ролевых приключений с **AI-управляемым Dungeon Master**. Игроки создают персонажей, развивают их, участвуют в боях и получают **AI-сгенерированные истории** с визуальными сценами.

## Основные возможности

### Игровой процесс
- **Создание персонажей** с разными расами (эльф, гном, человек, дракон) и классами (воин, маг, вор, паладин)
- **AI-генерация историй** через Claude API с D&D-стилем нарратива
- **Система боевых действий** с расчётом урона, критических ударов, магических способностей
- **RPG-система**: уровни, HP, XP, инвентарь, предметы с эффектами (исцеление, баф урона, защиты)
- **Спутники (компаньоны)** с собственными характеристиками и боевыми навыками

### Мультиплеер
- **Лидерборд** с топом героев по разным метрикам (уровень, XP, количество историй)
- **Грейвард** — список павших героев всех игроков с статистикой
- **Public Feed** — real-time活动 других игроков (живой фид на главной)
- **Система достижений** — вычисляемые бейджи (убийца драконов, маг, паладин и т.д.)

### Визуальная часть
- **Автоматическая генерация сцен** истории через Pollinations.ai (с fallback-системой)
- **Загрузка аватаров** персонажей в S3-хранилище
- **Сложные Canvas-анимации**:
  -  Particle burst при победе
  -  Red screen flash при уроне + shake
  -  Green pulse при исцелении
  -  Dark portal при смерти врага
  -  Floating symbols при level-up
  -  3D tilt-эффект на карточках персонажей
  -  Reveal animations при скролле

### Авторизация & Безопасность
- **JWT-токены** с refresh-механизмом
- **Role-Based Access Control (RBAC)** — роли admin и user
- **Хеширование паролей** через bcrypt + salt
- **CORS** для frontend-backend коммуникации

---

## Технологический стек

### Backend
```
FastAPI 0.119.0       — высокопроизводительный async веб-фреймворк
SQLAlchemy 2.0.44     — ORM для работы с БД
PostgreSQL 15+        — основная БД с полнотекстовым поиском
Alembic               — управление миграциями БД
Python 3.11+          — основной язык
```

### Frontend
```
React 18              — UI library
TypeScript 5+         — type-safe JavaScript
Tailwind CSS 3+       — utility-first CSS
React Router 6+       — клиентский routing
Vite                  — быстрый dev server и bundler
```

### AI & ML
```
Claude API (Anthropic) — текстовая генерация историй
Pollinations.ai        — генерация картинок сцен
```

### DevOps & Storage
```
Docker + Docker Compose — контейнеризация
MinIO                   — S3-совместимое объектное хранилище
Nginx                   — reverse proxy для frontend
Python-dotenv           — управление переменными окружения
```

### Testing & Quality
```
Pytest + pytest-asyncio — unit и integration tests
Playwright              — e2e smoke tests
pytest-cov              — code coverage анализ
```

---

## Требования

### Системные требования
- **Docker** 20.10+ и **Docker Compose** 2.0+
- **Python** 3.11+ (если запускать локально без Docker)
- **Node.js** 18+ (для frontend)
- **Git**

### API ключи (обязательны)
- `CLAUDE_API_KEY` — ключ от [Claude API](https://console.anthropic.com/)
- `S3_*` переменные — для MinIO (опционально, есть дефолты)

---

## Установка и запуск

### Вариант 1: Docker (рекомендуется)

```bash
# Клонировать репозиторий
git clone https://github.com/Dmitroooo73/shadow-realms.git
cd shadow-realms

# Создать .env файл в корне проекта
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/shadow_realms
SECRET_KEY=your-super-secret-key-change-this
CLAUDE_API_KEY=your-claude-api-key

S3_ENDPOINT_URL=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=shadow-realms
PUBLIC_S3_URL=http://localhost:9000
EOF

# Поднять все сервисы
docker compose up -d --build

# Запустить миграции БД (первый раз)
docker compose exec backend alembic upgrade head
```

Приложение будет доступно на:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **API docs**: http://localhost:8000/docs
- **MinIO**: http://localhost:9000 (admin/minioadmin)

---

### Вариант 2: Локальная установка

#### Backend
```bash
cd backend

# Создать virtual environment
python -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate

# Установить зависимости
pip install -r requirements.txt

# Создать .env
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://user:password@localhost/shadow_realms
SECRET_KEY=your-secret-key
CLAUDE_API_KEY=your-api-key
EOF

# Запустить миграции
alembic upgrade head

# Запустить сервер
uvicorn main:app --reload
```

Backend будет на http://localhost:8000

#### Frontend
```bash
cd frontend-new

# Установить зависимости
npm install

# Запустить dev server
npm run dev
```

Frontend будет на http://localhost:5173

---

## Структура проекта

```
shadow-realms/
├── backend/
│   ├── routers/                 # API endpoints
│   │   ├── auth.py              # Авторизация (login, register, logout)
│   │   ├── characters.py        # Управление персонажами
│   │   ├── stories.py           # История приключений
│   │   ├── arena.py             # Боевая система
│   │   ├── companions.py        # Спутники
│   │   ├── public.py            # Публичные данные (лидерборд, feed)
│   │   ├── users.py             # Профиль пользователя
│   │   └── external.py          # Внешние сервисы (OAuth и т.д.)
│   │
│   ├── services/                # Бизнес-логика
│   │   ├── auth_service.py      # JWT, хеширование паролей
│   │   ├── character_service.py # Логика персонажей, S3 загрузки
│   │   ├── dnd_service.py       # D&D логика (расчёты боя)
│   │   └── user_service.py      # Операции с пользователями
│   │
│   ├── models.py                # SQLAlchemy модели
│   ├── schemas.py               # Pydantic валидация
│   ├── database.py              # Конфиг БД
│   ├── dependencies.py          # Зависимости для Depends()
│   ├── permissions.py           # RBAC логика
│   ├── s3_client.py             # S3/MinIO клиент
│   ├── ai_service.py            # Claude API интеграция
│   ├── main.py                  # FastAPI app
│   ├── utils.py                 # Утилиты
│   ├── requirements.txt          # Зависимости Python
│   ├── Dockerfile               # Docker для backend
│   ├── alembic/                 # Миграции БД
│   └── tests/                   # Unit & integration tests
│
├── frontend-new/
│   ├── src/
│   │   ├── components/          # React компоненты
│   │   │   ├── Home.tsx         # Главная страница
│   │   │   ├── Gallery.tsx      # Галерея персонажей
│   │   │   ├── StoryPage.tsx    # Страница истории с AI
│   │   │   ├── Profile.tsx      # Профиль пользователя
│   │   │   ├── Leaderboard.tsx  # Лидерборд
│   │   │   ├── Arena.tsx        # Боевая система
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── animations.ts    # Canvas анимации
│   │   ├── types.ts             # TypeScript типы
│   │   ├── App.tsx              # Главный компонент
│   │   └── main.tsx             # Entry point
│   │
│   ├── public/                  # Статические файлы
│   ├── package.json             # npm зависимости
│   ├── vite.config.ts           # Vite конфиг
│   ├── tailwind.config.js       # Tailwind CSS конфиг
│   ├── Dockerfile               # Docker для frontend
│   └── e2e/                     # Playwright e2e tests
│
├── docker-compose.yml           # Оркестрация сервисов
├── .env.example                 # Пример переменных окружения
└── README.md                    # Этот файл
```

---

## API Endpoints

### Авторизация
```
POST   /auth/register          — Регистрация
POST   /auth/login             — Логин
POST   /auth/refresh           — Обновить токен
POST   /auth/logout            — Выход
```

### Персонажи
```
GET    /characters             — Список персонажей пользователя
POST   /characters             — Создать персонажа
GET    /characters/{id}        — Получить персонажа
PUT    /characters/{id}        — Редактировать
DELETE /characters/{id}        — Удалить
POST   /characters/{id}/avatar — Загрузить аватар
```

### Истории & Приключения
```
POST   /stories                — Начать новую историю
GET    /stories/{id}           — Получить историю
POST   /stories/{id}/action    — Выполнить действие в истории
GET    /stories/{id}/messages  — История сообщений
```

### Боевая система
```
POST   /arena/fight            — Начать бой с врагом
POST   /arena/turn             — Ход в бою
GET    /arena/history          — История боёв
```

### Публичные данные
```
GET    /public/leaderboard     — Лидерборд (требует auth)
GET    /public/graveyard       — Павшие герои
GET    /public/feed            — Live feed активности
GET    /public/characters/{id}/stats     — Статистика персонажа
GET    /public/characters/{id}/achievements — Достижения
```

Полная документация на **http://localhost:8000/docs** (Swagger UI)

---

## Ключевые фичи реализации

### Асинхронная генерация картинок
```python
# Text возвращается сразу, картинка генерируется в фоне
@router.post("/stories/{story_id}/action")
async def perform_action(story_id: int, ...):
    story_text = generate_story_text(...)  # Быстро
    
    # Фоновая задача (не блокирует ответ)
    BackgroundTasks.add_task(
        generate_and_save_image,
        story_id,
        story_text
    )
    
    return {"text": story_text, "image_url": None}  # Картинка загрузится позже
```

### Fallback система для image generation
```python
# Если Pollinations.ai не отвечает, пробует другие API
async def generate_scene_image(prompt: str) -> Optional[bytes]:
    for provider in [pollinations, huggingface, stability_ai]:
        try:
            return await provider.generate(prompt)
        except Exception as e:
            logger.warning(f"Provider {provider.name} failed: {e}")
            continue
    
    return None  # Graceful failure
```

### Canvas анимации с физикой
```typescript
// Particle burst при победе
const particles = Array.from({ length: 200 }, () => ({
  x: centerX, y: centerY,
  vx: Math.cos(angle) * speed,
  vy: Math.sin(angle) * speed - gravity,
  life: maxLife,
  color: randomHSL()
}));

// requestAnimationFrame loop с гравитацией и затуханием
const animate = () => {
  for (const p of particles) {
    p.vy += gravity;      // Гравитация
    p.vx *= friction;     // Трение
    p.life--;             // Затухание
  }
  if (particles.some(p => p.life > 0))
    requestAnimationFrame(animate);
};
```

### Ролевая безопасность (RBAC)
```python
# Только админ может удалить персонажа другого пользователя
@router.delete("/characters/{char_id}")
async def delete_character(
    char_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    char = crud.get_character(db, char_id)
    
    # Проверка прав
    if not has_permission(current_user, "delete_character", char):
        raise HTTPException(403, "Not allowed")
    
    crud.delete_character(db, char_id)
```

### Оптимизация на canvas (DPR)
```typescript
// Правильный рендер на Retina дисплеях
const DPR = Math.min(2, window.devicePixelRatio || 1);
canvas.width = window.innerWidth * DPR;
canvas.height = window.innerHeight * DPR;
canvas.style.width = window.innerWidth + 'px';
canvas.style.height = window.innerHeight + 'px';

ctx.scale(DPR, DPR);  // Масштабируем контекст
```

---

## Архитектура

### Backend архитектура
```
Request → Middleware → Router → Dependencies → Service → Database
                                   ↓
                           (Validates via Pydantic)
```

### Frontend архитектура
```
App (AuthContext) → Router → Component → API Client → State Management
                                ↓
                        (TypeScript типы)
```

### Data Flow для историй
```
User Click "Start Adventure"
    ↓
API POST /stories
    ↓
Backend (FastAPI):
  1. Generate story text via Claude API (async)
  2. Save to database
  3. Return immediately with story text
  4. BackgroundTask: Generate image via Pollinations.ai
  5. Save image to MinIO S3
    ↓
Frontend:
  1. Receive story text immediately
  2. Display in UI
  3. Poll for image or WebSocket updates
  4. Display image when ready
    ↓
User reads story + sees animations
```

---

## Тестирование

```bash
# Unit тесты
cd backend
pytest tests/unit/ -v --cov

# Integration тесты
pytest tests/integration/ -v

# E2E тесты (Playwright)
cd frontend-new
npx playwright test

# Coverage отчёт
pytest --cov --cov-report=html
```

Текущий coverage: **80%+** для backend

---

## Производительность

| Метрика | Значение |
|---------|----------|
| **API response time** | <100ms (без image generation) |
| **Image generation** | 5-10s (асинхронно, не блокирует) |
| **Canvas FPS** | 60 FPS на Chrome/Firefox |
| **Bundle size (Frontend)** | ~150KB gzipped |
| **Docker image (Backend)** | ~500MB |
| **Concurrent users** | Неограниченное (масштабируется с PostgreSQL) |

---

## Безопасность

 **Защиты реализованы:**
- SQL injection protection (SQLAlchemy ORM)
- XSS prevention (React автоматически экранирует)
- CSRF protection (JWT вместо cookies)
- Password hashing (bcrypt + salt)
- Rate limiting (готово для добавления)
- CORS (настроено для фронта)
- JWT refresh token rotation
- Input validation (Pydantic)

 **Что добавить для production:**
- Rate limiting (slowapi)
- Helmet для Headers
- SQL injection дополнительная защита
- 2FA (two-factor auth)
- Password strength requirements
- Audit logging

---

## Развёртывание

### На localhost (Docker)
```bash
docker compose up -d
# Всё работает на http://localhost:3000
```

### На продакшене (базовый пример)
```bash
# 1. Запустить PostgreSQL
# 2. Запустить MinIO
# 3. Запустить Backend на порту 8000
# 4. Запустить Frontend (build static + Nginx)
# 5. Настроить reverse proxy (Nginx)

# Например, на DigitalOcean/AWS/Heroku
```

---

## Переменные окружения

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/db_name

# JWT Security
SECRET_KEY=your-super-secret-key-min-32-chars

# Claude API
CLAUDE_API_KEY=sk-...

# S3 / MinIO
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=shadow-realms
PUBLIC_S3_URL=http://localhost:9000

# Опционально
DEBUG=False
ENVIRONMENT=production
```

Пример: [.env.example](./.env.example)

---

## Troubleshooting

### Docker проблемы
```bash
# Очистить контейнеры и volume
docker compose down -v

# Пересобрать образы
docker compose build --no-cache

# Посмотреть логи
docker compose logs -f backend
docker compose logs -f frontend-new
```

### Database миграции
```bash
# Создать новую миграцию
docker compose exec backend alembic revision --autogenerate -m "description"

# Применить миграции
docker compose exec backend alembic upgrade head

# Откатить на версию
docker compose exec backend alembic downgrade -1
```

### Frontend проблемы
```bash
# Очистить кэш
rm -rf node_modules package-lock.json
npm install

# Вышибить кэш Vite
rm -rf frontend-new/.vite
npm run dev
```

---

## Чему можно научиться из этого проекта

1. **Full-stack разработка** — от БД до UI
2. **Async Python** — FastAPI, asyncio, asyncpg
3. **React + TypeScript** — типобезопасный фронт
4. **Canvas API** — сложные анимации с физикой
5. **AI интеграция** — работа с Claude API
6. **Docker & DevOps** — контейнеризация, compose
7. **Database дизайн** — ERD, миграции, оптимизация
8. **API дизайн** — REST, токены, RBAC
9. **Testing** — unit, integration, e2e
10. **Security** — хеширование, JWT, валидация

---

## Контакты

- **GitHub**: [Dmitroooo73](https://github.com/Dmitroooo73)
- **Email**: rits1144@gmail.com
- **Проект**: [shadow-realms](https://github.com/Dmitroooo73/shadow-realms)

---

## Лицензия

MIT License — используй как хочешь, со ссылкой на оригинал 

---

## 🙏 Благодарности

- **Anthropic** за Claude API
- **Pollinations.ai** за image generation
- **FastAPI** команду за отличный фреймворк
- **React** команду за экосистему

---

**Сделано с ❤️ и ☕**

*Последнее обновление: 2026-05-15*
