"""
routers/devices.py — Device endpoints backed by real Postgres queries.
"""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Device, CalibrationRecord
from app.schemas import (
    DeviceSchema, DeviceCreateRequest, DeviceUpdateRequest,
    PredictedDeviceSchema, DevicePredictionResponse, YearScorePoint,
)
from app.prediction import build_year_scores, predict_calibration_interval, stability_from_rule

router = APIRouter(prefix="/api/devices", tags=["devices"])
_log = logging.getLogger(__name__)


# -- Helpers -----------------------------------------------------------------

def _next_calibration_date(interval_years: int) -> str:
    today = date.today()
    return date(today.year + interval_years, today.month, today.day).isoformat()


def _device_to_schema(device: Device) -> DeviceSchema:
    """Single source of truth for mapping a Device ORM row to DeviceSchema."""
    return DeviceSchema(
        id=device.id,
        serial_number=device.serial_number,
        department=device.department_name,
        device_type=device.device_type,
        model=device.model,
        manufacturer=device.manufacturer,
        resolution=float(device.resolution) if device.resolution is not None else None,
    )


async def _get_device_or_404(serial_number: str, db: AsyncSession) -> Device:
    result = await db.execute(
        select(Device).where(Device.serial_number == serial_number)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device ''{serial_number}'' not found.",
        )
    return device


async def _build_prediction_for_device(device: Device, db: AsyncSession) -> tuple[list[dict], dict]:
    recs_result = await db.execute(
        select(CalibrationRecord)
        .where(CalibrationRecord.device_id == device.id)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.calibration_year)
    )
    records = recs_result.scalars().all()

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
            # This record has no usable measurements (e.g. legacy rows missing
            # deviation/min/max). Skip it rather than letting it silently score
            # as a "perfect" 0% — see visit_score()'s docstring: an empty test
            # list should never reach it as if it were a real, clean reading.
            continue
        grouped_records.setdefault(acc_type, []).append({
            "year": rec.calibration_year,
            "result": rec.result or "",
            "tests": valid_tests,
        })

    if not grouped_records:
        return [], predict_calibration_interval([])

    group_results: dict[str, tuple[list[dict], dict]] = {}
    for acc_type, raw_records in grouped_records.items():
        year_scores = build_year_scores(raw_records)
        prediction = predict_calibration_interval(year_scores)
        group_results[acc_type] = (year_scores, prediction)

    eligible = {k: v for k, v in group_results.items() if len(v[0]) >= 2}
    candidates = eligible if eligible else group_results

    worst_key = None
    for acc_type, (year_scores, prediction) in candidates.items():
        if worst_key is None:
            worst_key = acc_type
            continue
        current_iv = candidates[worst_key][1]["interval_years"]
        this_iv = prediction["interval_years"]
        if this_iv < current_iv:
            worst_key = acc_type
        elif this_iv == current_iv:
            current_score = candidates[worst_key][0][-1]["score"] if candidates[worst_key][0] else 0
            this_score = year_scores[-1]["score"] if year_scores else 0
            if this_score > current_score:
                worst_key = acc_type

    return group_results[worst_key]


# -- Endpoints ---------------------------------------------------------------

@router.post("", response_model=DeviceSchema, status_code=status.HTTP_201_CREATED)
async def create_device(payload: DeviceCreateRequest, db: AsyncSession = Depends(get_db)):
    """Register a brand-new device."""
    existing = await db.execute(
        select(Device).where(Device.serial_number == payload.serial_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A device with serial number ''{payload.serial_number}'' already exists.",
        )

    device = Device(
        serial_number=payload.serial_number,
        department_name=payload.department_name,
        device_type=payload.device_type,
        model=payload.model,
        manufacturer=payload.manufacturer,
        resolution=payload.resolution,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_to_schema(device)


@router.get("/departments", response_model=list[str])
async def list_departments(db: AsyncSession = Depends(get_db)):
    """Return the distinct department names present in the devices table."""
    result = await db.execute(select(Device.department_name).distinct())
    return sorted(row[0] for row in result.all() if row[0])


@router.get("/predictions", response_model=list[PredictedDeviceSchema])
async def get_devices_by_prediction(
    interval_years: Optional[int] = Query(None, description="1 or 2"),
    stability: Optional[str] = Query(None, description="stable | marginal | unstable"),
    search: Optional[str] = Query(None, description="Free-text filter on serial, department, type, model"),
    db: AsyncSession = Depends(get_db),
):
    """
    Return devices with their predicted calibration interval.

    The search term is pushed into SQL (ILIKE) so the database does the
    heavy lifting and only matching rows are loaded into Python.  The
    stability/interval guard is applied *before* the prediction loop so
    we never waste time computing a prediction that will be discarded.
    A hard cap of 200 results prevents accidental full-table sweeps.
    """
    stmt = select(Device)

    if search:
        # Use SQL ILIKE so the DB engine filters rows — avoids loading the
        # entire table into Python and eliminates the "or" substring problem
        # (searching "OR" will only match devices whose fields equal or start
        # with "or", not every word containing those letters like monitor/corridor).
        q = search.strip()
        pattern = f"{q}%"          # prefix match  (e.g. "OR" matches "OR", "ORD", …)
        contains = f"%{q}%"        # fallback substring for longer terms
        # For short terms (≤3 chars) use exact prefix matching to avoid false hits.
        # For longer terms use substring (more flexible).
        if len(q) <= 3:
            like_pattern = pattern
        else:
            like_pattern = contains

        stmt = stmt.where(
            or_(
                func.lower(Device.serial_number).like(like_pattern.lower()),
                func.lower(Device.department_name).like(like_pattern.lower()),
                func.lower(Device.device_type).like(like_pattern.lower()),
                func.lower(Device.model).like(like_pattern.lower()),
                func.lower(Device.manufacturer).like(like_pattern.lower()),
            )
        )

    # Hard cap — prediction computation is expensive; never sweep the whole table.
    stmt = stmt.limit(200)

    result = await db.execute(stmt)
    devices = result.scalars().all()

    output = []
    for device in devices:
        try:
            year_scores, prediction = await _build_prediction_for_device(device, db)
        except Exception as exc:
            _log.warning("Prediction failed for device %s: %s", device.serial_number, exc)
            year_scores = []
            prediction = {
                "interval_years": 1,
                "rule": "not enough history",
                "message": "Unable to compute prediction.",
            }

        latest_score = year_scores[-1]["score"] if year_scores else 0.0
        stab, label = stability_from_rule(prediction["rule"], latest_score)
        iv = prediction["interval_years"]

        # Apply interval / stability filters before appending (skip mismatches early).
        if interval_years is not None and iv != interval_years:
            continue
        if stability and stab != stability:
            continue

        output.append(PredictedDeviceSchema(
            serial_number=device.serial_number,
            department=device.department_name,
            device_type=device.device_type,
            model=device.model,
            manufacturer=device.manufacturer,
            stability=stab,
            label=label,
            interval_years=iv,
            next_date=_next_calibration_date(iv),
            message=prediction["message"],
        ))

    return output


@router.get("/{serial_number:path}/prediction", response_model=DevicePredictionResponse)
async def get_device_prediction(serial_number: str, db: AsyncSession = Depends(get_db)):
    """Return year-by-year scores and predicted interval for a specific device."""
    device = await _get_device_or_404(serial_number, db)
    year_scores, prediction = await _build_prediction_for_device(device, db)

    return DevicePredictionResponse(
        device_id=device.id,
        serial_number=device.serial_number,
        year_scores=[YearScorePoint(**ys) for ys in year_scores],
        interval_years=prediction["interval_years"],
        rule=prediction["rule"],
        message=prediction["message"],
    )


@router.put("/{serial_number:path}", response_model=DeviceSchema)
async def update_device(
    serial_number: str,
    payload: DeviceUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update the editable metadata fields of an existing device."""
    device = await _get_device_or_404(serial_number, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(device, field, value)
    await db.commit()
    await db.refresh(device)
    return _device_to_schema(device)


@router.get("/{serial_number:path}", response_model=DeviceSchema)
async def get_device(serial_number: str, db: AsyncSession = Depends(get_db)):
    """Return static device info for a given serial number."""
    device = await _get_device_or_404(serial_number, db)
    return _device_to_schema(device)