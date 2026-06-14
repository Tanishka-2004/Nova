"""Nova Channel Service – FastAPI application entry-point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, send

logging.basicConfig(level=settings.LOG_LEVEL.upper())
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup / shutdown logging."""
    logger.info(
        "🚀 %s starting on port %d",
        settings.SERVICE_NAME,
        settings.SERVICE_PORT,
    )
    yield
    logger.info("👋 %s shutting down", settings.SERVICE_NAME)


app = FastAPI(
    title="Nova Channel Service",
    description="Simulated message delivery service for Nova AI Marketing Co-Pilot",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(send.router, tags=["Messages"])
