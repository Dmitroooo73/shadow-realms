# Развёртывание (Лабораторная работа №6)

Единая воспроизводимая сборка через Docker Compose.

## Сервисы

| Сервис   | Роль                          | Порт (host)      | Healthcheck            |
|----------|-------------------------------|------------------|------------------------|
| postgres | БД                            | —                | `pg_isready`           |
| minio    | S3-совместимое хранилище      | 9000 / 9001 (UI) | `/minio/health/live`   |
| backend  | FastAPI                       | 8000             | `GET /ping`            |
| frontend | Nginx + собранный Vite bundle | 80               | `GET /`                |

Nginx во `frontend` отдаёт SPA и проксирует запросы на backend (`/api-proxy/*`, `/robots.txt`, `/sitemap.xml`).

```
 [browser] --80--> frontend (nginx)
                    |  /api-proxy/*
                    v
                  backend (uvicorn :8000)
                    |
             +------+------+
             v             v
          postgres       minio :9000
```

## Быстрый старт

```bash
# 1. Скопировать пример и задать секреты
cp .env.example .env
#  — отредактировать SECRET_KEY, пароли

# 2. Первая сборка + запуск
docker compose build
docker compose up -d

# 3. Проверка
curl http://localhost:8000/ping
curl http://localhost/
# MinIO консоль: http://localhost:9001  (логин/пароль из .env)
```

## Про твои существующие контейнеры MinIO

У тебя в Docker Desktop сейчас:
- `minio_local` — работает на `0.0.0.0:9000` ✅
- `minio-server` — остановлен, дубликат на том же порту ❌

Перед `docker compose up` нужно освободить порт 9000/9001:

```bash
# Остановить и удалить оба старых контейнера (данные не в них, а в volume / локальной папке)
docker stop minio_local minio-server
docker rm   minio_local minio-server
```

После этого `docker compose up -d` поднимет чистый `shadow_realms_minio` с отдельным volume `minio_data`. Бакет `shadow-realms` создастся автоматически при старте backend (`init_s3_bucket` в `s3_client.py`).

## Переменные окружения

Читаются из корневого `.env`. Пример — `.env.example`. В репозиторий `.env` не коммитится.

## Порядок запуска

`depends_on` + healthchecks гарантируют:
- `backend` стартует, только когда `postgres` и `minio` прошли healthcheck;
- `frontend` стартует, когда `backend` отвечает `/ping`.

## Остановка / очистка

```bash
docker compose down            # остановить, сохранить данные
docker compose down -v         # + удалить volume'ы (БД и MinIO обнулятся)
docker compose logs -f backend # логи конкретного сервиса
```

## CI/CD

GitHub Actions: `.github/workflows/ci.yml`
1. `backend-tests` — pytest + coverage на SQLite in-memory.
2. `frontend-tests` — Vitest + `npm run build`.
3. `docker-build` — сборка обоих образов через Buildx (только если тесты прошли).

Расширяется до push в registry и автодеплоя добавлением шагов с `docker/login-action` + `docker/build-push-action` (`push: true`).

## Что делать, если backend не поднимается

1. `docker compose logs backend` — смотрим traceback.
2. Частые причины:
   - не задан `SECRET_KEY` в `.env` → JWT падает;
   - MinIO ещё не готов → backend ждёт healthcheck, это ок 10–20 секунд;
   - конфликт порта 8000 — выключи локальный `uvicorn`, который запускал вручную.
