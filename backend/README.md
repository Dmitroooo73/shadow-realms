# Shadow Realms AI

## Запуск бэкенда
```bash
cd backend
venv\Scripts\activate
set PYTHONPATH=.
python -m uvicorn main:app --reload

## Запуск бэкенда

cd frontend
npm install
npm run dev





Ситуация	Команда
Каждое утро / после перезагрузки	docker compose up -d
Поменял код, нужно пересобрать	docker compose build && docker compose up -d
Остановить всё	docker compose down
Посмотреть логи	docker compose logs -f backend
Статус	docker compose ps


Что	Адрес
Фронтенд (SPA)	http://localhost/
Backend Swagger	http://localhost:8000/docs
MinIO консоль	http://localhost:9001
robots.txt	http://localhost:8000/robots.txt
sitemap.xml	http://localhost:8000/sitemap.xml

docker compose up -d

Пересобрать и запустить backend:
docker compose build backend && docker compose up -d backend

Пересобрать и запустить frontend:
docker compose build frontend && docker compose up -d frontend

Пересобрать и запустить оба одновременно:
docker compose build backend frontend && docker compose up -d backend frontend

Или одной командой всё:
docker compose build && docker compose up -d