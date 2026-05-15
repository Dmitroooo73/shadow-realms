from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.dnd_service import ExternalApiError, get_random_inspiration
from ai_service import generate_dark_fantasy_image

router = APIRouter(prefix="/api/external", tags=["external"])


@router.get("/inspiration")
async def inspiration():
    try:
        return await get_random_inspiration()
    except ExternalApiError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class ImageRequest(BaseModel):
    prompt: str


@router.post("/generate-image")
async def generate_image(req: ImageRequest):
    image = await generate_dark_fantasy_image(req.prompt[:300])
    if not image:
        raise HTTPException(status_code=503, detail="Image generation unavailable")
    return {"image": image}
