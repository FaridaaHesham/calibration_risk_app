"""
routers/risk.py — Risk classification endpoints.

TODO: Risk classification logic and requirements are still to be determined.
      This entire router is a placeholder returning mock data.
      Replace with the real risk scoring model when requirements are finalised.
"""
from fastapi import APIRouter, HTTPException, status
from app.schemas import RiskDataSchema
from app import mock_data

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/{serial_number}", response_model=RiskDataSchema)
async def get_risk_data(serial_number: str):
    """
    Return risk classification scorecard for a device.

    TODO: Implement the real risk scoring algorithm here once requirements
          are finalised. Expected inputs: device history, usage patterns,
          maintenance logs, patient impact score.
          Then persist results to a RiskAssessment table in the DB.
    """
    key = serial_number.upper()
    risk = mock_data.MOCK_RISK_DATA.get(key)
    if risk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No risk data found for serial '{serial_number}'.",
        )
    return risk
