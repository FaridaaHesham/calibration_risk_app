"""
routers/calibrations.py — Calibration history and chart data from real DB.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Device, CalibrationRecord, CalibrationTest
from app.schemas import (
    CalibrationRecordSchema,
    CalibrationRecordCreate,
    TestResultSchema,
    ChartDataResponse,
)
from app.prediction import build_year_scores, predict_calibration_interval, stability_from_rule

router = APIRouter(prefix="/api/calibrations", tags=["calibrations"])


async def _get_device_by_serial(serial_number: str, db: AsyncSession) -> Device:
    result = await db.execute(
        select(Device).where(Device.serial_number == serial_number)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{serial_number}' not found.",
        )
    return device


@router.post("", response_model=CalibrationRecordSchema, status_code=status.HTTP_201_CREATED)
async def create_calibration_record(payload: CalibrationRecordCreate, db: AsyncSession = Depends(get_db)):
    """
    Save a new calibration session (one record + its test rows) for an
    existing device — used by the 'Add Calibration Data' page.
    """
    device = await _get_device_by_serial(payload.serial_number, db)

    if not payload.tests:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one test measurement is required.",
        )

    # If the caller didn't specify an overall result, derive it the same
    # way the UI does everywhere else: pass only if every test's actual
    # value falls within its own [min_value, max_value] range.
    overall_result = payload.result
    if not overall_result:
        all_pass = all(t.min_value <= t.actual_value <= t.max_value for t in payload.tests)
        overall_result = "Pass" if all_pass else "Fail"

    record = CalibrationRecord(
        device_id=device.id,
        calibration_year=payload.calibration_year,
        certificate_num=payload.certificate_num,
        result=overall_result,
        accessory_type=payload.accessory_type,
        accessory_model=payload.accessory_model,
        accessory_serial=payload.accessory_serial,
    )
    db.add(record)
    await db.flush()  # assigns record.id, needed for the test rows below

    for t in payload.tests:
        deviation = t.deviation
        if deviation is None and t.reference_value is not None:
            # Matches the convention already used throughout the existing
            # historical data: deviation = reference_value - actual_value.
            deviation = t.reference_value - t.actual_value

        db.add(CalibrationTest(
            calibration_record_id=record.id,
            test_label=t.test_label,
            test_point_unit=t.test_point_unit,
            reference_value=t.reference_value,
            actual_value=t.actual_value,
            deviation=deviation,
            min_value=t.min_value,
            max_value=t.max_value,
        ))

    await db.commit()

    # Re-fetch with tests eagerly loaded so the response includes them.
    result = await db.execute(
        select(CalibrationRecord)
        .where(CalibrationRecord.id == record.id)
        .options(selectinload(CalibrationRecord.tests))
    )
    saved_record = result.scalar_one()

    return CalibrationRecordSchema(
        id=saved_record.id,
        calibration_year=saved_record.calibration_year,
        certificate_num=saved_record.certificate_num,
        result=saved_record.result,
        accessory_type=saved_record.accessory_type,
        accessory_model=saved_record.accessory_model,
        accessory_serial=saved_record.accessory_serial,
        tests=[
            TestResultSchema(
                id=t.id,
                test_label=t.test_label,
                test_point_unit=t.test_point_unit,
                reference_value=float(t.reference_value) if t.reference_value is not None else None,
                actual_value=float(t.actual_value) if t.actual_value is not None else None,
                deviation=float(t.deviation) if t.deviation is not None else None,
                min_value=float(t.min_value) if t.min_value is not None else None,
                max_value=float(t.max_value) if t.max_value is not None else None,
            )
            for t in saved_record.tests
        ],
    )


@router.get("/{serial_number:path}/chart", response_model=ChartDataResponse)
async def get_chart_data(serial_number: str, db: AsyncSession = Depends(get_db)):
    """
    Return year-by-year closeness scores for the control chart, plus
    the calibration interval prediction and recommendation.
    Data is grouped by accessory_type so different probes/accessories
    (e.g. ultrasound probes swapped year to year) each get their own
    chart and their own recommendation, instead of being mixed together.
    """
    device = await _get_device_by_serial(serial_number, db)

    recs_result = await db.execute(
        select(CalibrationRecord)
        .where(CalibrationRecord.device_id == device.id)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.calibration_year)
    )
    records = recs_result.scalars().all()

    # Group by accessory type
    grouped_records: dict[str, list[dict]] = {}
    for rec in records:
        acc_type = (rec.accessory_type or "Main Device").strip()
        valid_tests = [
            {
                "deviation": float(t.deviation),
                "min_value": float(t.min_value),
                "max_value": float(t.max_value),
            }
            for t in rec.tests
            if t.deviation is not None and t.min_value is not None and t.max_value is not None
        ]
        if not valid_tests:
            # Skip records with no usable measurements instead of letting them
            # silently score as a "perfect" 0% (see visit_score()'s docstring).
            # Same fix as in routers/devices.py — kept in sync deliberately.
            continue
        grouped_records.setdefault(acc_type, []).append({
            "year": rec.calibration_year,
            "result": rec.result or "",
            "tests": valid_tests,
        })

    accessories_out = {}
    today = date.today()

    for acc_type, raw_records in grouped_records.items():
        year_scores = build_year_scores(raw_records)
        prediction = predict_calibration_interval(year_scores)

        latest_score = year_scores[-1]["score"] if year_scores else 0.0
        stab_key, stab_label = stability_from_rule(prediction["rule"], latest_score)

        iv = prediction["interval_years"]
        next_date = date(today.year + iv, today.month, today.day).isoformat()

        chart_points = [
            {"year": ys["year"], "score": ys["score"], "result": ys["result"]}
            for ys in year_scores
        ]

        recommendation = {
            "stability": stab_key,
            "label": stab_label,
            "next_date": next_date,
            "interval_years": iv,
            "message": prediction["message"],
        }

        accessories_out[acc_type] = {
            "points": chart_points,
            "recommendation": recommendation,
        }

    return ChartDataResponse(accessories=accessories_out)


@router.get("/{serial_number:path}", response_model=list[CalibrationRecordSchema])
async def get_calibration_history(serial_number: str, db: AsyncSession = Depends(get_db)):
    """
    Return all calibration records (with nested test results) for a device,
    ordered by calibration_year descending (most recent first).
    """
    device = await _get_device_by_serial(serial_number, db)

    recs_result = await db.execute(
        select(CalibrationRecord)
        .where(CalibrationRecord.device_id == device.id)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.calibration_year.desc())
    )
    records = recs_result.scalars().all()

    output = []
    for rec in records:
        output.append(CalibrationRecordSchema(
            id=rec.id,
            calibration_year=rec.calibration_year,
            certificate_num=rec.certificate_num,
            result=rec.result,
            accessory_type=rec.accessory_type,
            accessory_model=rec.accessory_model,
            accessory_serial=rec.accessory_serial,
            tests=[
                TestResultSchema(
                    id=t.id,
                    test_label=t.test_label,
                    test_point_unit=t.test_point_unit,
                    reference_value=float(t.reference_value) if t.reference_value is not None else None,
                    actual_value=float(t.actual_value) if t.actual_value is not None else None,
                    deviation=float(t.deviation) if t.deviation is not None else None,
                    min_value=float(t.min_value) if t.min_value is not None else None,
                    max_value=float(t.max_value) if t.max_value is not None else None,
                )
                for t in rec.tests
            ],
        ))
    return output