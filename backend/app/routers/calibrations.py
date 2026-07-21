"""
routers/calibrations.py — Calibration history and chart data endpoints.

TODO: Replace mock_data lookups with real SQLAlchemy queries and the
      actual statistical control-chart calculation logic.
"""
from fastapi import APIRouter, HTTPException, status
from app.schemas import CalibrationRecordSchema, ChartDataResponse
from app import mock_data

router = APIRouter(prefix="/api/calibrations", tags=["calibrations"])


@router.get("/{serial_number}", response_model=list[CalibrationRecordSchema])
async def get_calibration_history(serial_number: str):
    """
    Return the list of past calibration records for a device.

    TODO: Replace with:
          result = await db.execute(
              select(CalibrationRecord)
              .where(CalibrationRecord.serial_number == serial_number)
              .order_by(CalibrationRecord.year)
          )
          return result.scalars().all()
    """
    key = serial_number.upper()
    records = mock_data.MOCK_CALIBRATION_HISTORY.get(key)
    if records is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No calibration records found for serial '{serial_number}'.",
        )
    return records


@router.get("/{serial_number}/chart", response_model=ChartDataResponse)
async def get_chart_data(serial_number: str):
    """
    Return control chart data points and the calibration recommendation.

    TODO: Replace with real statistical calculation:
          1. Fetch calibration records from DB
          2. Compute mean (CL), UCL = mean + 3*sigma, LCL = mean - 3*sigma
          3. Apply control chart rules (Western Electric / Nelson rules)
          4. Determine stability label (stable / marginal / unstable)
          5. Calculate next recommended calibration date based on stability
          The recommendation block below is the placeholder output.
    """
    key = serial_number.upper()
    chart = mock_data.MOCK_CHART_DATA.get(key)
    if chart is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No chart data found for serial '{serial_number}'.",
        )
    return chart
