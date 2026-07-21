"""
routers/devices.py — Device info endpoints.

TODO: Replace mock_data lookups with real SQLAlchemy queries:
      device = await db.execute(select(Device).where(Device.serial_number == serial_number))
"""
from fastapi import APIRouter, HTTPException, status
from app.schemas import DeviceSchema
from app import mock_data

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("/{serial_number}", response_model=DeviceSchema)
async def get_device(serial_number: str):
    """
    Return static device info for a given serial number.

    TODO: Replace the mock_data lookup below with a real DB query:
          result = await db.execute(
              select(Device).where(Device.serial_number == serial_number)
          )
          device = result.scalar_one_or_none()
          if not device:
              raise HTTPException(404, "Device not found")
          return device
    """
    key = serial_number.upper()
    device = mock_data.MOCK_DEVICES.get(key)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with serial number '{serial_number}' not found.",
        )
    return device
