from datetime import date
import io
import csv
import pandas as pd
from typing import Optional
import calendar

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Device, CalibrationRecord, CalibrationTest
from app.schemas import (
    CalibrationRecordSchema,
    CalibrationRecordCreate,
    TestResultSchema,
    ChartDataResponse,
    BulkImportResponse,
)
from app.prediction import build_year_scores, predict_calibration_interval, stability_from_rule
from app.routers.settings import get_settings

router = APIRouter(prefix="/api/calibrations", tags=["calibrations"])


async def _get_device_by_serial(serial_number: str, db: AsyncSession) -> Device:
    q = (serial_number or "").strip()
    if not q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No serial number provided.",
        )
    q_no_zero = q.lstrip('0') or '0'

    # 1. Exact match
    result = await db.execute(
        select(Device).where(
            or_(
                func.lower(Device.serial_number) == q.lower(),
                func.lower(Device.serial_number) == q_no_zero.lower(),
            )
        )
    )
    device = result.scalars().first()

    # 2. Substring fallback match
    if not device:
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


def _compute_overall_result(tests) -> str:
    """
    Single source of truth for a calibration session's overall Pass/Fail.

    A session passes only if every one of its tests has an actual_value
    within its own [min_value, max_value] tolerance band. Tests missing
    min/max or actual values are ignored (can't be judged), matching the
    frontend's CalibrationHistoryTable logic. A session with no judgeable
    tests is left as "Pass" only in the sense that there's nothing to
    fail — callers should treat that case as "unknown" if it matters.

    IMPORTANT: this is the ONLY place overall result should be computed.
    Do not accept a raw "result" value from spreadsheets or callers and
    store it as-is — it silently drifts out of sync with the actual
    measurements (this is what caused sessions to render as "Fail" on
    the control chart while every individual test showed Pass).
    """
    judgeable = [
        t for t in tests
        if t.min_value is not None and t.max_value is not None and t.actual_value is not None
    ]
    if not judgeable:
        return "Pass"
    all_pass = all(t.min_value <= t.actual_value <= t.max_value for t in judgeable)
    return "Pass" if all_pass else "Fail"


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

    # Always derive the overall result from the tests themselves — never
    # trust a caller-supplied value, since that's how the stored result
    # and the actual measurements drift apart (see _compute_overall_result).
    overall_result = _compute_overall_result(payload.tests)

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

    # Load configurable settings (warning threshold, trend sensitivity, cal month)
    settings = get_settings()
    cal_month = settings.get("calibration_month", 10)
    edge_threshold = settings.get("edge_warning_threshold", 75.0)
    min_trend = settings.get("min_trend_increase", 10.0)

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
            continue
        grouped_records.setdefault(acc_type, []).append({
            "year": rec.calibration_year,
            "result": rec.result or "",
            "tests": valid_tests,
        })

    accessories_out = {}

    for acc_type, raw_records in grouped_records.items():
        year_scores = build_year_scores(raw_records)
        prediction = predict_calibration_interval(
            year_scores,
            edge_warning_threshold=edge_threshold,
            min_trend_increase=min_trend,
        )

        latest_score = year_scores[-1]["score"] if year_scores else 0.0
        stab_key, stab_label = stability_from_rule(prediction["rule"], latest_score)

        iv = prediction["interval_years"]

        # Use the last RECORDED calibration year as the anchor, not today's year.
        # This is correct: if the last recorded calibration is 2025 and the interval
        # is 1 year, the next calibration is due in October 2026 — NOT October 2027.
        #
        # However, a single addition of the interval can land in the past if the
        # device has missed one or more cycles (e.g. last calibrated in 2022 with
        # a 1-year interval, and it's now 2026 — 2022 + 1 = 2023, which is stale).
        # Keep advancing by the interval until the date is no longer behind the
        # current month/year, so we always show the next real due date.
        today = date.today()
        step = max(iv, 1)
        if year_scores:
            last_cal_year = year_scores[-1]["year"]
            next_year = last_cal_year + step
            while (next_year, cal_month) < (today.year, today.month):
                next_year += step
        else:
            next_year = today.year + step
        month_name = calendar.month_name[cal_month]
        next_date = f"{month_name} {next_year}"

        chart_points = [
            {
                "year": ys["year"],
                "score": ys["score"],
                "signed_score": ys.get("signed_score"),
                "result": ys["result"],
                "signed_deviation": ys.get("signed_deviation"),
            }
            for ys in year_scores
        ]

        recommendation = {
            "stability": stab_key,
            "label": stab_label,
            "next_date": next_date,
            "interval_years": iv,
            "message": prediction["message"],
            "reasoning": prediction.get("reasoning", ""),
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


@router.post("/bulk-upload", response_model=BulkImportResponse)
async def bulk_upload_calibrations(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Parse an Excel (.xlsx) or CSV file and bulk-import calibration records, devices, and tests.
    """
    try:
        contents = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), dtype=str)
        elif file.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents), dtype=str)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .csv or .xlsx")
        
        # Clean up column names: lowercase, strip, replace spaces with underscores
        df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
        
        # Required columns check
        required_cols = {"serial_number", "device_type", "calibration_year", "test_label", "reference_value", "actual_value"}
        if not required_cols.issubset(set(df.columns)):
            missing = required_cols - set(df.columns)
            return BulkImportResponse(
                success=False, imported_devices=0, imported_records=0, imported_tests=0,
                errors=[f"Missing required columns: {', '.join(missing)}"], message="Upload failed"
            )

        df = df.where(pd.notnull(df), None)
        
        # We process row by row, caching fetched devices and records
        devices_cache = {}
        records_cache = {}
        
        imported_devs = 0
        imported_recs = 0
        imported_tests = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                sn = str(row["serial_number"]).strip()
                if sn == "None" or not sn: continue
                
                dev_type = str(row["device_type"]).strip()
                cal_year_raw = row.get("calibration_year")
                if pd.isna(cal_year_raw): continue
                cal_year = int(float(cal_year_raw))
                
                # Device
                if sn not in devices_cache:
                    dev_result = await db.execute(select(Device).where(Device.serial_number == sn))
                    device = dev_result.scalar_one_or_none()
                    if not device:
                        device = Device(
                            serial_number=sn,
                            device_type=dev_type,
                            department_name=str(row.get("department", "")) if pd.notna(row.get("department")) else None,
                            model=str(row.get("model", "")) if pd.notna(row.get("model")) else None,
                            manufacturer=str(row.get("manufacturer", "")) if pd.notna(row.get("manufacturer")) else None,
                        )
                        db.add(device)
                        await db.flush()
                        imported_devs += 1
                    devices_cache[sn] = device
                device = devices_cache[sn]

                # Calibration Record
                rec_key = f"{sn}_{cal_year}"
                if rec_key not in records_cache:
                    rec_result = await db.execute(
                        select(CalibrationRecord)
                        .where(CalibrationRecord.device_id == device.id, CalibrationRecord.calibration_year == cal_year)
                    )
                    record = rec_result.scalar_one_or_none()
                    if not record:
                        # Don't trust a "result" column from the spreadsheet here —
                        # at this point we've only seen ONE row (one test) for this
                        # record, so we can't yet know the true overall result.
                        # It gets computed properly from all of the record's tests
                        # in the recompute pass below, once every row is in.
                        record = CalibrationRecord(
                            device_id=device.id,
                            calibration_year=cal_year,
                            certificate_num=str(row.get("certificate_num", "")) if pd.notna(row.get("certificate_num")) else None,
                        )
                        db.add(record)
                        await db.flush()
                        imported_recs += 1
                    records_cache[rec_key] = record
                record = records_cache[rec_key]

                # Test Result
                ref_val_raw = row.get("reference_value")
                act_val_raw = row.get("actual_value")
                if pd.notna(ref_val_raw) and pd.notna(act_val_raw):
                    ref_val = float(ref_val_raw)
                    act_val = float(act_val_raw)
                    test_label = str(row["test_label"]).strip()
                    deviation = float(row.get("deviation", ref_val - act_val)) if pd.notna(row.get("deviation")) else (ref_val - act_val)
                    
                    min_val = float(row.get("min_value", ref_val * 0.95)) if pd.notna(row.get("min_value")) else (ref_val * 0.95)
                    max_val = float(row.get("max_value", ref_val * 1.05)) if pd.notna(row.get("max_value")) else (ref_val * 1.05)
                    
                    # Avoid duplicates in same year record
                    exist_test = await db.execute(
                        select(CalibrationTest)
                        .where(CalibrationTest.calibration_record_id == record.id, CalibrationTest.test_label == test_label)
                    )
                    if not exist_test.scalar_one_or_none():
                        new_test = CalibrationTest(
                            calibration_record_id=record.id,
                            test_label=test_label,
                            reference_value=ref_val,
                            actual_value=act_val,
                            deviation=deviation,
                            min_value=min_val,
                            max_value=max_val,
                            test_point_unit=str(row.get("unit", "")) if pd.notna(row.get("unit")) else None
                        )
                        db.add(new_test)
                        imported_tests += 1

            except Exception as e:
                errors.append(f"Row {idx+2}: {str(e)}")

        # Now that every row has been read, each touched record has its full
        # set of tests in the session (flush so newly-added CalibrationTest
        # rows are visible to the query below). Recompute overall result from
        # ALL of the record's tests — including any that already existed in
        # the DB before this upload — so it can never drift from reality.
        await db.flush()
        for record in records_cache.values():
            tests_result = await db.execute(
                select(CalibrationTest).where(CalibrationTest.calibration_record_id == record.id)
            )
            record.result = _compute_overall_result(tests_result.scalars().all())

        await db.commit()
        return BulkImportResponse(
            success=True,
            imported_devices=imported_devs,
            imported_records=imported_recs,
            imported_tests=imported_tests,
            errors=errors[:10],
            message=f"Successfully imported {imported_devs} devices, {imported_recs} records, and {imported_tests} tests."
        )
    except Exception as e:
        await db.rollback()
        return BulkImportResponse(
            success=False, imported_devices=0, imported_records=0, imported_tests=0,
            errors=[str(e)], message="Failed to process file."
        )