from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import PlainTextResponse, Response
import os
from dotenv import load_dotenv
from sqlalchemy import text

from database import engine, Base, SessionLocal
from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.characters import router as characters_router
from routers.stories import router as stories_router
from routers.external import router as external_router
from routers.companions import router as companions_router
from routers.public import router as public_router
from routers.arena import router as arena_router
from ai_service import load_models

PUBLIC_SITE_URL = os.getenv("PUBLIC_SITE_URL", "http://localhost:5173")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting up...")
    
    Base.metadata.create_all(bind=engine)
    print("✅ Database connected successfully.")
    
    if not str(engine.url).startswith("sqlite"):
        db = SessionLocal()
        try:
            db.execute(text("SET CLIENT_ENCODING TO 'UTF8'"))
            db.execute(text("SET NAMES 'UTF8'"))
            db.commit()
            print("✅ Database encoding set to UTF-8")
        except Exception as e:
            print(f"⚠️ Warning: Could not set encoding: {e}")
        finally:
            db.close()
    
    load_dotenv()
    
    load_models()
    print("✅ AI models loaded.")
    
    yield
    
    print("🛑 Shutting down...")

app = FastAPI(
    title="Shadow Realms AI - Backend",
    description="Backend API for Shadow Realms AI with JWT authentication & AI character system",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(characters_router)
app.include_router(stories_router)
app.include_router(external_router)
app.include_router(companions_router)
app.include_router(public_router)
app.include_router(arena_router)

@app.get("/")
def root():
    return {"message": "Hello from Shadow Realms AI backend 👋"}

@app.get("/ping")
def ping():
    return {"status": "ok"}


@app.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
def robots_txt():
    """robots.txt с правилами обхода для SEO."""
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /profile\n"
        "Disallow: /admin\n"
        "Disallow: /character/\n"
        "Disallow: /story/\n"
        "Disallow: /multiplayer\n"
        "Disallow: /archive\n"
        f"Sitemap: {PUBLIC_SITE_URL}/sitemap.xml\n"
    )
    return body


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap_xml():
    """Sitemap для публичных индексируемых страниц."""
    public_paths = ["/", "/login", "/register"]
    urls = "".join(
        f"<url><loc>{PUBLIC_SITE_URL}{p}</loc><changefreq>weekly</changefreq>"
        f"<priority>{'1.0' if p == '/' else '0.6'}</priority></url>"
        for p in public_paths
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{urls}"
        "</urlset>"
    )
    return Response(content=xml, media_type="application/xml")

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Shadow Realms AI - Backend",
        version="0.1.0",
        description="💀 Это Реальная Грязища",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            method["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi
