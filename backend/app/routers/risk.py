"""
routers/risk.py — Risk classification placeholder.
Logic and requirements are still to be determined.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import RiskDataSchema

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/{serial_number:path}", response_model=RiskDataSchema)
async def get_risk_data(serial_number: str, db: AsyncSession = Depends(get_db)):
    """
    Risk classification is not yet implemented.
    Returns HTTP 501 with a clear message so the frontend can handle it gracefully.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Risk classification logic has not been implemented yet. "
            "This endpoint will be available in a future release."
        ),
    )
