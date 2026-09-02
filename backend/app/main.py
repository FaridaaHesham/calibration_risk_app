"""
main.py — FastAPI application entry point.

Run with:  uvicorn app.main:app --reload
           (from the backend/ directory, with the .venv activated)
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine, Base
from app import models  # noqa: F401
from app.routers import auth, devices, calibrations, risk, tolerances, users
from app.routers.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables and new columns exist on startup
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE equipment_risk_configs ADD COLUMN IF NOT EXISTS equipment_category VARCHAR DEFAULT 'medical'"))
            await conn.execute(text("ALTER TABLE equipment_risk_configs ADD COLUMN IF NOT EXISTS occurrence_value NUMERIC DEFAULT 0.0"))
            await conn.execute(text("ALTER TABLE equipment_risk_configs ADD COLUMN IF NOT EXISTS normalized_probability NUMERIC"))
    except Exception as e:
        print("[Startup Migration Note]:", e)
    yield


app = FastAPI(
    title="Adam International Hospital — Calibration & Risk API",
    description=(
        "Backend API for the medical device calibration tracking and "
        "risk classification system. Deterministic Excel Medical & Non-Medical Risk."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow the Vite dev server (port 5173) to call this API.
# TODO: Tighten origins in production (remove '*', list allowed domains only).
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server default
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(calibrations.router)
app.include_router(risk.router)
app.include_router(tolerances.router)
app.include_router(settings_router)


@app.get("/", tags=["health"])
async def health_check():
    """Quick health-check endpoint."""
    return {"status": "ok", "service": "calibration-api"}
