"""
routers/settings.py — Prediction engine settings endpoint.

Settings are persisted in a local JSON file alongside the backend code.
This avoids needing a DB migration while still surviving server restarts.

Gated to admins only, matching the frontend's AdminRoute-protected
Settings page — previously these endpoints had no auth check at all.
"""
import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.models import User
from app.routers.auth import require_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Store settings file next to this router file
_SETTINGS_FILE = Path(__file__).parent.parent / "prediction_settings.json"

_DEFAULTS = {
    "edge_warning_threshold": 75.0,
    "min_trend_increase": 10.0,
    "calibration_month": 10,  # October
    "due_soon_months": 2,     # Show devices due within 2 months in notifications
}


class PredictionSettingsSchema(BaseModel):
    edge_warning_threshold: float  # % — readings above this trigger 1-year interval
    min_trend_increase: float      # % points per year — minimum rise to count as upward trend
    calibration_month: int         # 1–12 — month calibrations are scheduled each year
    due_soon_months: int           # 1–12 — months ahead to consider "due soon" in notifications


def _load_settings() -> dict:
    """Load settings from disk, falling back to defaults for any missing keys."""
    if _SETTINGS_FILE.exists():
        try:
            data = json.loads(_SETTINGS_FILE.read_text())
            # Fill in any keys that might be missing (e.g. newly added keys)
            for k, v in _DEFAULTS.items():
                data.setdefault(k, v)
            return data
        except Exception:
            pass
    return dict(_DEFAULTS)


def _save_settings(data: dict) -> None:
    """Persist settings to disk."""
    _SETTINGS_FILE.write_text(json.dumps(data, indent=2))


@router.get("/prediction", response_model=PredictionSettingsSchema)
async def get_prediction_settings(_admin: User = Depends(require_admin)):
    """Return the current prediction engine settings. Admins only."""
    return _load_settings()


@router.put("/prediction", response_model=PredictionSettingsSchema)
async def update_prediction_settings(
    payload: PredictionSettingsSchema,
    _admin: User = Depends(require_admin),
):
    """Update prediction engine settings. Persisted across server restarts. Admins only."""
    if not (0 < payload.edge_warning_threshold <= 100):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="edge_warning_threshold must be between 0 and 100.",
        )
    if not (0 < payload.min_trend_increase <= 100):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="min_trend_increase must be between 0 and 100.",
        )
    if not (1 <= payload.calibration_month <= 12):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="calibration_month must be between 1 and 12.",
        )
    if not (1 <= payload.due_soon_months <= 12):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="due_soon_months must be between 1 and 12.",
        )
    data = payload.model_dump()
    _save_settings(data)
    return data


def get_settings() -> dict:
    """Helper for other routers to read current settings synchronously."""
    return _load_settings()