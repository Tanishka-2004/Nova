"""Health-check endpoint."""

from fastapi import APIRouter

from app.config import settings
from app.schemas.message import HealthResponse
from app.services.delivery_simulator import get_active_simulation_count

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return service health status and the number of active simulations."""
    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        active_simulations=get_active_simulation_count(),
    )
