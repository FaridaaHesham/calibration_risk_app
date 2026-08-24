"""
main.py — FastAPI application entry point.

Run with:  uvicorn app.main:app --reload
           (from the backend/app/ directory, with the .venv activated)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, devices, calibrations, risk, tolerances

app = FastAPI(
    title="Adam International Hospital — Calibration & Risk API",
    description=(
        "Backend API for the medical device calibration tracking and "
        "risk classification system. Currently serving mock data."
    ),
    version="0.1.0-mockup",
)

# ---------------------------------------------------------------------------
# CORS — allow the Vite dev server (port 5173) to call this API.
# TODO: Tighten origins in production (remove '*', list allowed domains only).
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(calibrations.router)
app.include_router(risk.router)
app.include_router(tolerances.router)


@app.get("/", tags=["health"])
async def health_check():
    """Quick health-check endpoint."""
    return {"status": "ok", "service": "calibration-api"}
