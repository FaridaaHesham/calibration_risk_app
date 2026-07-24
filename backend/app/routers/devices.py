"""
routers/devices.py — Device info endpoints.

TODO: Replace mock_data lookups with real SQLAlchemy queries:
      device = await db.execute(select(Device).where(Device.serial_number == serial_number))
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas import DeviceSchema, PredictedDeviceSchema
from app import mock_data

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("/predictions", response_model=list[PredictedDeviceSchema])
async def get_devices_by_prediction(
    interval_years: Optional[int] = Query(None, description="Filter by predicted interval in years (e.g., 1 or 2)"),
    stability: Optional[str] = Query(None, description="Filter by stability ('stable', 'marginal', 'unstable')"),
):
    """
    Return all devices filtered by predicted calibration interval (e.g. 2 years) and/or stability status.
    """
    return mock_data.get_predicted_devices(interval_years=interval_years, stability=stability)


@router.get("/{serial_number}", response_model=DeviceSchema)
async def get_device(serial_number: str):
    """
    Return static device info for a given serial number.
    """
    key = serial_number.upper()
    device = mock_data.MOCK_DEVICES.get(key)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with serial number '{serial_number}' not found.",
        )
    return device

