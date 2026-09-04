"""
routers/devices.py — Device endpoints backed by real Postgres queries.
"""
import calendar
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, func, distinct, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Device, CalibrationRecord, CalibrationTest, EquipmentRiskConfig
from app.schemas import (
    DeviceSchema, DeviceCreateRequest, DeviceUpdateRequest,
    PredictedDeviceSchema, DevicePredictionResponse, YearScorePoint,
    AlertItemSchema, AlertsResponseSchema,
)
from app.prediction import build_year_scores, predict_calibration_interval, stability_from_rule
from app.services.risk_service import (
    calculate_calibration_risk_level,
    calculate_risk_class,
    calculate_excel_risk,
)
from app.routers.settings import get_settings

router = APIRouter(prefix="/api/devices", tags=["devices"])
_log = logging.getLogger(__name__)


# -- Alerts Endpoint ---------------------------------------------------------

@router.get("/alerts", response_model=AlertsResponseSchema)
async def get_calibration_alerts(db: AsyncSession = Depends(get_db)):
    """
    Return all alerts:
      1. High Risk Assessment (Class 3 Criticality)
      2. High Calibration Risk (Failure Rate >10% or recent fail)
      3. Overdue Calibrations (<0 days)
      4. Due Soon Calibrations (<=30 days)
    """
    today = date.today()

    # 1. Load all devices
    res_devices = await db.execute(select(Device))
    devices = res_devices.scalars().all()

    # 2. Load calibration records with tests eagerly
    recs_result = await db.execute(
        select(CalibrationRecord)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.device_id, CalibrationRecord.calibration_year.desc())
    )
    all_records = recs_result.scalars().all()

    records_by_device: dict[int, list[CalibrationRecord]] = {}
    for rec in all_records:
        records_by_device.setdefault(rec.device_id, []).append(rec)

    # 3. Load risk assessment configs
    configs_res = await db.execute(select(EquipmentRiskConfig))
    configs_list = configs_res.scalars().all()
    configs_map = {c.device_type.strip().lower(): c for c in configs_list}

    overdue_list = []
    due_soon_list = []
    high_risk_assessment_list = []
    high_cal_risk_list = []
    all_alerts_dict: dict[str, AlertItemSchema] = {}

    for device in devices:
        c_type = (device.device_type or "").strip().lower()
        c_cfg = configs_map.get(c_type)

        records = records_by_device.get(device.id, [])
        total_calibrations = len(records)
        passed_calibrations = 0
        failed_calibrations = 0
        most_recent_status = "NO_RECORDS"

        if records:
            latest = records[0]
            if latest.result and latest.result.upper() == "PASS":
                most_recent_status = "PASS"
            elif latest.result and latest.result.upper() == "FAIL":
                most_recent_status = "FAIL"
            else:
                most_recent_status = latest.result or "UNKNOWN"

        for r in records:
            if r.result and r.result.upper() == "PASS":
                passed_calibrations += 1
            elif r.result and r.result.upper() == "FAIL":
                failed_calibrations += 1

        cal_failure_rate = (
            round((failed_calibrations / total_calibrations) * 100.0, 2)
            if total_calibrations > 0 else None
        )
        c_level = calculate_calibration_risk_level(cal_failure_rate)

        # Pure Excel Risk Scoring (Decoupled from calibration failure rate)
        if c_cfg:
            cat = c_cfg.equipment_category or "medical"
            p_risk = c_cfg.process_risk or 1
            pat_risk = c_cfg.patient_risk or 1
            occ_val = float(c_cfg.occurrence_value or 0.0)
            eq_count = max(c_cfg.equipment_count or 1, 1)

            calc = calculate_excel_risk(
                equipment_category=cat,
                process_risk=p_risk,
                patient_risk=pat_risk,
                occurrence_value=occ_val,
                equipment_count=eq_count,
            )
            dyn_prob_occ = calc["probability_occurrence"]
            dyn_equip_risk = calc["equipment_risk"]
            dyn_risk_pct = calc["risk_percentage"]
            dyn_risk_class = calc["risk_class"]
        else:
            dyn_prob_occ = 0.0
            dyn_equip_risk = 0.0
            dyn_risk_pct = 0.0
            dyn_risk_class = "CLASS_1"

        # Interval Prediction
        recs_asc = sorted(records, key=lambda r: r.calibration_year or 0)
        last_year = recs_asc[-1].calibration_year if recs_asc else None

        if not recs_asc:
            iv = 1
        else:
            grouped: dict[str, list] = {}
            for rec in recs_asc:
                acc = (rec.accessory_type or "Main Device").strip()
                vtests = [
                    {"deviation": float(t.deviation), "min_value": float(t.min_value), "max_value": float(t.max_value)}
                    for t in rec.tests
                    if t.deviation is not None and t.min_value is not None and t.max_value is not None
                ]
                if vtests:
                    grouped.setdefault(acc, []).append({"year": rec.calibration_year, "result": rec.result or "", "tests": vtests})
            if not grouped:
                iv = 1
            else:
                ys = build_year_scores(list(grouped.values())[0])
                pred = predict_calibration_interval(ys)
                iv = pred["interval_years"]

        if last_year:
            next_year = last_year + iv
            target_d = date(next_year, 10, 15)
            days_rem = (target_d - today).days
            pred_date_str = f"October {next_year}"
        else:
            next_year = today.year + iv
            days_rem = 365 * iv
            pred_date_str = f"October {next_year}"

        is_overdue = days_rem < 0
        is_due_soon = 0 <= days_rem <= 90
        is_high_risk_assess = dyn_risk_class == "CLASS_3" or dyn_risk_pct >= 60.0
        is_high_cal_risk = c_level == "HIGH" or (cal_failure_rate is not None and cal_failure_rate > 10.0) or most_recent_status == "FAIL"

        if is_overdue or is_due_soon or is_high_risk_assess or is_high_cal_risk:
            # Determine primary status tag
            if is_high_risk_assess:
                primary_status = "HIGH_RISK_ASSESSMENT"
                alert_msg = f"Class 3 Criticality ({dyn_risk_pct}% Risk)"
            elif is_high_cal_risk:
                primary_status = "HIGH_CAL_RISK"
                alert_msg = f"High Cal Failure Rate ({cal_failure_rate}%)"
            elif is_overdue:
                primary_status = "OVERDUE"
                alert_msg = f"Overdue by {abs(days_rem)} days"
            else:
                primary_status = "DUE_SOON"
                alert_msg = f"Due in {days_rem} days"

            item = AlertItemSchema(
                serial_number=device.serial_number,
                department=device.department_name,
                device_type=device.device_type,
                model=device.model,
                status=primary_status,
                days_remaining=days_rem,
                predicted_date=pred_date_str,
                risk_class=dyn_risk_class,
                risk_percentage=dyn_risk_pct,
                calibration_risk_level=c_level,
                calibration_failure_rate=cal_failure_rate,
                alert_type=primary_status,
                alert_message=alert_msg,
            )

            if is_overdue:
                overdue_list.append(item)
            if is_due_soon:
                due_soon_list.append(item)
            if is_high_risk_assess:
                high_risk_assessment_list.append(item)
            if is_high_cal_risk:
                high_cal_risk_list.append(item)

            dict_key = device.serial_number or f"DEV-{device.id}"
            all_alerts_dict[dict_key] = item

    # Sort all alerts prioritizing High Risk Assessment -> High Cal Risk -> Overdue -> Due Soon
    def alert_priority(a: AlertItemSchema) -> int:
        if a.risk_class == "CLASS_3" and a.calibration_risk_level == "HIGH":
            return 0
        if a.risk_class == "CLASS_3":
            return 1
        if a.calibration_risk_level == "HIGH":
            return 2
        if a.days_remaining < 0:
            return 3
        return 4

    sorted_alerts = sorted(all_alerts_dict.values(), key=lambda a: (alert_priority(a), a.days_remaining))

    return AlertsResponseSchema(
        total_alerts=len(sorted_alerts),
        overdue_count=len(overdue_list),
        due_soon_count=len(due_soon_list),
        high_risk_assessment_count=len(high_risk_assessment_list),
        high_risk_calibration_count=len(high_cal_risk_list),
        alerts=sorted_alerts,
    )



# -- Helpers -----------------------------------------------------------------


def _next_calibration_date(interval_years: int, last_cal_year: int | None = None) -> str:
    """
    Compute the *next upcoming* calibration date string (e.g. 'October 2026').
    Uses the last recorded calibration year as the anchor so that a device
    whose most recent calibration was in 2025 with a 1-year interval gets
    'October 2026', not 'October 2027' (which would be wrong if the current
    year's calibration hasn't happened yet).

    If the device has missed one or more cycles (e.g. last calibrated in
    2022 with a 1-year interval, and it's now 2026), a single addition of
    the interval would land in the past (2023). Keep advancing by the
    interval until the date is no longer behind the current month/year, so
    we always report the next real due date rather than a stale one.
    """
    settings = get_settings()
    cal_month = settings.get("calibration_month", 10)
    month_name = calendar.month_name[cal_month]
    today = date.today()
    step = max(interval_years, 1)

    if last_cal_year is not None:
        next_year = last_cal_year + step
        while (next_year, cal_month) < (today.year, today.month):
            next_year += step
    else:
        next_year = today.year + step

    return f"{month_name} {next_year}"


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


async def _get_device_or_404(serial_number: str, db: AsyncSession, department: str | None = None) -> Device:
    q = (serial_number or "").strip()
    if not q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No serial number provided.",
        )
    q_no_zero = q.lstrip('0') or '0'

    # 1. Exact match (with and without leading zeros)
    exact_stmt = select(Device).where(
        or_(
            func.lower(Device.serial_number) == q.lower(),
            func.lower(Device.serial_number) == q_no_zero.lower(),
        )
    )
    if department and department.strip():
        exact_stmt = exact_stmt.where(func.lower(Device.department_name) == department.strip().lower())

    res = await db.execute(exact_stmt)
    device = res.scalars().first()

    # 2. Substring fallback match if no exact match found
    if not device:
        patterns = [f"%{q.lower()}%"]
        if q_no_zero != q:
            patterns.append(f"%{q_no_zero.lower()}%")

        like_conds = [func.lower(Device.serial_number).like(p) for p in patterns]
        partial_stmt = select(Device).where(or_(*like_conds))
        if department and department.strip():
            partial_stmt = partial_stmt.where(func.lower(Device.department_name) == department.strip().lower())

        res = await db.execute(partial_stmt)
        device = res.scalars().first()

    # 3. If still not found with department filter, search across all departments
    if not device and department and department.strip():
        patterns = [f"%{q.lower()}%"]
        if q_no_zero != q:
            patterns.append(f"%{q_no_zero.lower()}%")
        like_conds = [func.lower(Device.serial_number).like(p) for p in patterns]
        res = await db.execute(select(Device).where(or_(*like_conds)))
        device = res.scalars().first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{serial_number}' not found.",
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
    sn = (payload.serial_number or "").strip()
    sn_no_zero = sn.lstrip('0') or '0'
    existing = await db.execute(
        select(Device).where(
            or_(
                func.lower(Device.serial_number) == sn.lower(),
                func.lower(Device.serial_number) == sn_no_zero.lower(),
            )
        )
    )
    if existing.scalars().first():
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


@router.get("/device-types", response_model=list[str])
async def list_device_types(db: AsyncSession = Depends(get_db)):
    """Return the distinct device types present in devices and equipment_risk_configs tables."""
    res1 = await db.execute(select(Device.device_type).distinct())
    res2 = await db.execute(select(EquipmentRiskConfig.device_type).distinct())
    types = set(row[0] for row in res1.all() if row[0])
    types.update(row[0] for row in res2.all() if row[0])
    return sorted(types)


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
    heavy lifting and only matching rows are loaded into Python.
    Supports terms starting with 0 by matching both exact query and stripped zeros.
    """
    stmt = select(Device)

    if search:
        q = search.strip()
        q_no_zero = q.lstrip('0')

        patterns = [f"%{q.lower()}%"]
        if q_no_zero and q_no_zero != q:
            patterns.append(f"%{q_no_zero.lower()}%")

        conditions = []
        for pat in patterns:
            conditions.extend([
                func.lower(Device.serial_number).like(pat),
                func.lower(Device.department_name).like(pat),
                func.lower(Device.device_type).like(pat),
                func.lower(Device.model).like(pat),
                func.lower(Device.manufacturer).like(pat),
            ])

        stmt = stmt.where(or_(*conditions))

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

        # Use the last recorded calibration year so the date is anchored correctly.
        last_cal_year = year_scores[-1]["year"] if year_scores else None

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
            next_date=_next_calibration_date(iv, last_cal_year),
            message=prediction["message"],
        ))

    return output


@router.get("/{serial_number:path}/test-labels", response_model=list[str])
async def get_device_test_labels(serial_number: str, db: AsyncSession = Depends(get_db)):
    """
    Return the distinct test labels historically used for a device,
    ordered alphabetically. Used by the Add Calibration form to pre-populate
    the test-label dropdown when a device is selected.
    """
    device = await _get_device_or_404(serial_number, db)

    result = await db.execute(
        select(distinct(CalibrationTest.test_label))
        .join(CalibrationRecord, CalibrationTest.calibration_record_id == CalibrationRecord.id)
        .where(
            CalibrationRecord.device_id == device.id,
            CalibrationTest.test_label.isnot(None),
            CalibrationTest.test_label != "",
        )
        .order_by(CalibrationTest.test_label)
    )
    labels = [row[0] for row in result.all() if row[0]]
    return labels


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
async def get_device(
    serial_number: str,
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Return static device info for a given serial number."""
    device = await _get_device_or_404(serial_number, db, department=department)
    return _device_to_schema(device)


@router.delete("/{serial_number:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(serial_number: str, db: AsyncSession = Depends(get_db)):
    """Delete a registered device unit and its associated calibration records and tests instantaneously."""
    q = (serial_number or "").strip()
    q_no_zero = q.lstrip('0') or '0'
    res = await db.execute(
        select(Device.id).where(
            or_(
                func.lower(Device.serial_number) == q.lower(),
                func.lower(Device.serial_number) == q_no_zero.lower(),
            )
        )
    )
    device_id = res.scalars().first()
    if not device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{serial_number}' not found.",
        )

    # Fast direct SQL cascade deletion
    sub_records = select(CalibrationRecord.id).where(CalibrationRecord.device_id == device_id)
    await db.execute(delete(CalibrationTest).where(CalibrationTest.calibration_record_id.in_(sub_records)))
    await db.execute(delete(CalibrationRecord).where(CalibrationRecord.device_id == device_id))
    await db.execute(delete(Device).where(Device.id == device_id))
    await db.commit()
    return None