"""
services/risk_service.py — Centralized service for Equipment Risk, Calibration Risk, Test Statistics & Dashboard.
"""
from datetime import date
from typing import Optional
import logging

from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, CalibrationRecord, CalibrationTest, EquipmentRiskConfig
from app.prediction import predict_calibration_interval, build_year_scores

_log = logging.getLogger(__name__)

# Configurable Thresholds for Dynamic Calibration Risk Level
CALIBRATION_RISK_THRESHOLDS = {
    "LOW_MAX": 0.0,       # 0% failure rate -> LOW
    "MEDIUM_MAX": 10.0,   # >0% and <=10% -> MEDIUM, >10% -> HIGH
}


def calculate_risk_class(risk_percentage: float) -> str:
    """Centralized function returning official Equipment Risk Class."""
    if risk_percentage <= 10.0:
        return "CLASS_1"
    elif risk_percentage < 50.0:
        return "CLASS_2"
    else:
        return "CLASS_3"


def calculate_equipment_risk_values(process_risk: int, patient_risk: int, equipment_count: int, minimum_required: int):
    # Normalized availability/probability factor: (equipment_count / max(minimum_required, 1))
    prob_occurrence = round(equipment_count / max(minimum_required, 1), 4)
    # Excel Formula: Equipment Risk = Process Risk * Patient Risk * Probability Factor
    # For high criticality items (Process=3, Patient=3, Ratio=1) -> 3*3*3 = 27 (or max 36)
    equip_risk = round(process_risk * patient_risk * (3.0 if prob_occurrence >= 1 else prob_occurrence * 3.0), 4)
    max_possible_risk = 27.0
    risk_pct = round(min((equip_risk / max_possible_risk) * 100.0, 100.0), 2)
    
    if risk_pct <= 10.0:
        risk_cls = "CLASS_1"
    elif risk_pct < 50.0:
        risk_cls = "CLASS_2"
    else:
        risk_cls = "CLASS_3"

    return prob_occurrence, equip_risk, risk_pct, risk_cls


def calculate_calibration_risk_level(failure_rate: Optional[float]) -> str:
    """Return dynamic calibration risk level: LOW | MEDIUM | HIGH | UNKNOWN."""
    if failure_rate is None:
        return "LOW"
    if failure_rate <= CALIBRATION_RISK_THRESHOLDS["LOW_MAX"]:
        return "LOW"
    elif failure_rate <= CALIBRATION_RISK_THRESHOLDS["MEDIUM_MAX"]:
        return "MEDIUM"
    else:
        return "HIGH"


async def get_equipment_risk_config_for_type(device_type: str, db: AsyncSession) -> Optional[EquipmentRiskConfig]:
    """Retrieve equipment type risk assessment configuration."""
    if not device_type:
        return None
    stmt = select(EquipmentRiskConfig).where(
        func.lower(EquipmentRiskConfig.device_type) == device_type.strip().lower()
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    if config:
        return config

    # Fallback: substring / partial match
    stmt_like = select(EquipmentRiskConfig).where(
        EquipmentRiskConfig.device_type.ilike(f"%{device_type.strip()}%")
    )
    result_like = await db.execute(stmt_like)
    return result_like.scalars().first()


async def compute_device_calibration_stats(device_id: int, db: AsyncSession) -> dict:
    """Calculate calibration records & test-level statistics for a device."""
    recs_result = await db.execute(
        select(CalibrationRecord)
        .where(CalibrationRecord.device_id == device_id)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.calibration_year.desc())
    )
    records = recs_result.scalars().all()

    total_calibrations = len(records)
    passed_calibrations = 0
    failed_calibrations = 0
    most_recent_status = "NO_RECORDS"

    if records:
        latest_rec = records[0]
        if latest_rec.result and latest_rec.result.upper() == "PASS":
            most_recent_status = "PASS"
        elif latest_rec.result and latest_rec.result.upper() == "FAIL":
            most_recent_status = "FAIL"
        else:
            most_recent_status = latest_rec.result or "UNKNOWN"

    for r in records:
        if r.result and r.result.upper() == "PASS":
            passed_calibrations += 1
        elif r.result and r.result.upper() == "FAIL":
            failed_calibrations += 1

    if total_calibrations > 0:
        cal_failure_rate = round((failed_calibrations / total_calibrations) * 100.0, 2)
    else:
        cal_failure_rate = None

    # Test-level calculations
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    out_of_range_count = 0
    abs_deviations = []
    most_recent_dev = None

    for r_idx, r in enumerate(records):
        for t in r.tests:
            total_tests += 1
            is_pass = False
            if t.actual_value is not None and t.min_value is not None and t.max_value is not None:
                if float(t.min_value) <= float(t.actual_value) <= float(t.max_value):
                    is_pass = True
            elif t.deviation is not None:
                if abs(float(t.deviation)) < 0.001:
                    is_pass = True

            if is_pass:
                passed_tests += 1
            else:
                failed_tests += 1
                out_of_range_count += 1

            if t.deviation is not None:
                dev_val = float(t.deviation)
                abs_deviations.append(abs(dev_val))
                if r_idx == 0 and most_recent_dev is None:
                    most_recent_dev = round(dev_val, 4)

    test_failure_rate = round((failed_tests / total_tests) * 100.0, 2) if total_tests > 0 else None
    max_deviation = round(max(abs_deviations), 4) if abs_deviations else None
    avg_deviation = round(sum(abs_deviations) / len(abs_deviations), 4) if abs_deviations else None
    cal_risk_level = calculate_calibration_risk_level(cal_failure_rate)

    return {
        "total_calibrations": total_calibrations,
        "passed_calibrations": passed_calibrations,
        "failed_calibrations": failed_calibrations,
        "calibration_failure_rate": cal_failure_rate,
        "most_recent_calibration_status": most_recent_status,
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": failed_tests,
        "test_failure_rate": test_failure_rate,
        "max_deviation": max_deviation,
        "avg_deviation": avg_deviation,
        "out_of_range_count": out_of_range_count,
        "most_recent_deviation": most_recent_dev,
        "calibration_risk_level": cal_risk_level,
    }


async def compute_device_prediction_status(device: Device, db: AsyncSession) -> dict:
    """Calculate calibration date prediction and overdue/due soon status."""
    recs_result = await db.execute(
        select(CalibrationRecord)
        .where(CalibrationRecord.device_id == device.id)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.calibration_year)
    )
    records = recs_result.scalars().all()

    last_year = records[-1].calibration_year if records else None
    today = date.today()

    if not records:
        predicted_iv = 1
        rule = "not enough history"
    else:
        grouped = {}
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
            if valid_tests:
                grouped.setdefault(acc_type, []).append({
                    "year": rec.calibration_year,
                    "result": rec.result or "",
                    "tests": valid_tests,
                })
        if not grouped:
            predicted_iv = 1
            rule = "default"
        else:
            first_group = list(grouped.values())[0]
            scores = build_year_scores(first_group)
            pred = predict_calibration_interval(scores)
            predicted_iv = pred["interval_years"]
            rule = pred["rule"]

    if last_year:
        last_cal_date = f"{last_year}-10-15"
        next_year = last_year + predicted_iv
        next_cal_date = f"{next_year}-10-15"
        target_date = date(next_year, 10, 15)
        days_rem = (target_date - today).days
    else:
        last_cal_date = None
        next_year = today.year + predicted_iv
        next_cal_date = f"{next_year}-10-15"
        days_rem = 365 * predicted_iv

    if days_rem < 0:
        status_label = "OVERDUE"
    elif days_rem <= 30:
        status_label = "DUE SOON"
    else:
        status_label = "NORMAL"

    return {
        "last_calibration": last_cal_date,
        "predicted_next_calibration": next_cal_date,
        "days_remaining": days_rem,
        "status": status_label,
        "prediction_rule": rule,
    }


async def get_device_risk_summary(serial_number: str, db: AsyncSession) -> dict:
    """Return unified Equipment Risk, Calibration Performance, Prediction & Recommendations."""
    stmt = select(Device).where(Device.serial_number == serial_number)
    res = await db.execute(stmt)
    device = res.scalar_one_or_none()
    if not device:
        return None

    cal_stats = await compute_device_calibration_stats(device.id, db)
    pred_stats = await compute_device_prediction_status(device, db)

    config = await get_equipment_risk_config_for_type(device.device_type, db)
    min_req = config.minimum_required if (config and config.minimum_required) else 1
    eq_count = config.equipment_count if (config and config.equipment_count) else 1
    base_ratio = round(float(min_req) / max(float(eq_count), 1.0), 2)

    cal_fail_rate = cal_stats["calibration_failure_rate"]
    if cal_fail_rate is not None:
        fail_factor = 0.35 + (2.65 * (cal_fail_rate / 100.0))
        dyn_prob_occ = round(max(0.10, base_ratio * fail_factor), 2)
    else:
        dyn_prob_occ = round(max(0.10, base_ratio * 0.50), 2)

    p_risk = config.process_risk if config else 1
    pat_risk = config.patient_risk if config else 1

    dyn_equip_risk = round(p_risk * pat_risk * dyn_prob_occ, 2)
    dyn_risk_pct = round(min(100.0, (dyn_equip_risk / 27.0) * 100.0), 2)
    dyn_risk_class = calculate_risk_class(dyn_risk_pct)

    if config:
        equip_risk_data = {
            "device_type": device.device_type,
            "arabic_name": config.arabic_name,
            "process_risk": config.process_risk,
            "patient_risk": config.patient_risk,
            "minimum_required": config.minimum_required,
            "equipment_count": config.equipment_count,
            "probability_occurrence": dyn_prob_occ,
            "equipment_risk": dyn_equip_risk,
            "risk_percentage": dyn_risk_pct,
            "risk_class": dyn_risk_class,
            "recommended_action": config.recommended_action,
            "preventive_action": config.preventive_action,
            "corrective_action": config.corrective_action,
        }
    else:
        equip_risk_data = {
            "device_type": device.device_type,
            "arabic_name": "غير مصنف",
            "process_risk": 1,
            "patient_risk": 1,
            "minimum_required": 1,
            "equipment_count": 1,
            "probability_occurrence": dyn_prob_occ,
            "equipment_risk": dyn_equip_risk,
            "risk_percentage": dyn_risk_pct,
            "risk_class": dyn_risk_class,
            "recommended_action": "Standard preventive maintenance",
            "preventive_action": "Continue scheduled calibration",
            "corrective_action": "Routine inspection",
        }

    # Generate recommendations list
    recommendations = []
    r_class = equip_risk_data["risk_class"]
    c_level = cal_stats["calibration_risk_level"]

    if r_class == "CLASS_1":
        recommendations.append("Continue normal preventive maintenance and routine scheduled calibration.")
    elif r_class == "CLASS_2":
        recommendations.append("Increase monitoring frequency and review historical calibration drift.")
        recommendations.append("Ensure preventive maintenance is performed strictly on schedule.")
    elif r_class == "CLASS_3":
        recommendations.append("Prioritize preventive maintenance & maintain spare device availability.")
        recommendations.append("Notify clinical engineering team and consider load minimization.")

    if c_level == "HIGH":
        recommendations.append("ALERT: High calibration failure rate detected (>10%). Escalate for engineering review.")
    elif c_level == "MEDIUM":
        recommendations.append("Notice: Marginal calibration performance. Monitor upcoming test parameters closely.")

    if pred_stats["status"] == "OVERDUE":
        recommendations.append("URGENT: Calibration is OVERDUE. Schedule immediate calibration service.")
    elif pred_stats["status"] == "DUE SOON":
        recommendations.append("Notice: Calibration is due within 30 days. Prepare calibration protocol.")

    return {
        "device": {
            "id": device.id,
            "serial_number": device.serial_number,
            "department": device.department_name,
            "device_type": device.device_type,
            "model": device.model,
            "manufacturer": device.manufacturer,
            "resolution": float(device.resolution) if device.resolution is not None else None,
        },
        "equipment_risk": equip_risk_data,
        "calibration_risk": cal_stats,
        "calibration_prediction": pred_stats,
        "recommendations": recommendations,
    }


async def get_risk_dashboard_summary(db: AsyncSession) -> dict:
    """Return aggregate statistics across all devices for the Risk Assessment Dashboard.

    Uses bulk queries (3 total) instead of N+1 per-device queries to avoid timeouts
    on high-latency remote databases (e.g. Neon cloud).
    """
    # --- 1. Load devices ---
    res_devices = await db.execute(select(Device))
    devices = res_devices.scalars().all()
    device_map = {d.id: d for d in devices}

    # --- 2. Load ALL calibration records with tests eagerly in one query ---
    recs_result = await db.execute(
        select(CalibrationRecord)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.device_id, CalibrationRecord.calibration_year.desc())
    )
    all_records = recs_result.scalars().all()

    # Group records by device_id
    records_by_device: dict[int, list[CalibrationRecord]] = {}
    for rec in all_records:
        records_by_device.setdefault(rec.device_id, []).append(rec)

    # --- 3. Load risk configs ---
    configs_res = await db.execute(select(EquipmentRiskConfig))
    configs_list = configs_res.scalars().all()
    configs_map = {c.device_type.strip().lower(): c for c in configs_list}

    # --- Compute stats in Python (no more per-device DB calls) ---
    today = date.today()

    total_devices = len(devices)
    class_1_count = 0
    class_2_count = 0
    class_3_count = 0
    high_cal_risk_count = 0
    medium_cal_risk_count = 0
    low_cal_risk_count = 0
    overdue_count = 0
    recent_failure_count = 0
    device_summaries = []

    for d in devices:
        c_type = (d.device_type or "").strip().lower()
        c_cfg = configs_map.get(c_type)

        # --- Calibration stats (computed from pre-loaded records) ---
        records = records_by_device.get(d.id, [])
        # records are already sorted desc by calibration_year per the query
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

        # --- Prediction (computed from pre-loaded records, asc by year) ---
        records_asc = sorted(records, key=lambda r: r.calibration_year or 0)
        last_year = records_asc[-1].calibration_year if records_asc else None

        if not records_asc:
            predicted_iv = 1
        else:
            grouped: dict[str, list] = {}
            for rec in records_asc:
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
                if valid_tests:
                    grouped.setdefault(acc_type, []).append({
                        "year": rec.calibration_year,
                        "result": rec.result or "",
                        "tests": valid_tests,
                    })
            if not grouped:
                predicted_iv = 1
            else:
                first_group = list(grouped.values())[0]
                scores = build_year_scores(first_group)
                pred_result = predict_calibration_interval(scores)
                predicted_iv = pred_result["interval_years"]

        if last_year:
            next_year = last_year + predicted_iv
            target_date = date(next_year, 10, 15)
            days_rem = (target_date - today).days
        else:
            days_rem = 365 * predicted_iv

        if days_rem < 0:
            cal_status = "OVERDUE"
        elif days_rem <= 30:
            cal_status = "DUE SOON"
        else:
            cal_status = "NORMAL"

        # --- Probability of Occurrence & Dynamic Risk Calculation ---
        min_req = c_cfg.minimum_required if (c_cfg and c_cfg.minimum_required) else 1
        eq_count = c_cfg.equipment_count if (c_cfg and c_cfg.equipment_count) else 1
        base_ratio = round(float(min_req) / max(float(eq_count), 1.0), 2)

        if cal_failure_rate is not None:
            # Dynamic occurrence factor derived from actual calibration performance
            # High failure rate increases probability of occurrence (up to 3.0x base ratio)
            fail_factor = 0.35 + (2.65 * (cal_failure_rate / 100.0))
            dyn_prob_occ = round(max(0.10, base_ratio * fail_factor), 2)
        else:
            dyn_prob_occ = round(max(0.10, base_ratio * 0.50), 2)

        p_risk = c_cfg.process_risk if c_cfg else 1
        pat_risk = c_cfg.patient_risk if c_cfg else 1

        dyn_equip_risk = round(p_risk * pat_risk * dyn_prob_occ, 2)
        dyn_risk_pct = round(min(100.0, (dyn_equip_risk / 27.0) * 100.0), 2)
        dyn_risk_class = calculate_risk_class(dyn_risk_pct)

        if dyn_risk_class == "CLASS_1":
            class_1_count += 1
        elif dyn_risk_class == "CLASS_2":
            class_2_count += 1
        elif dyn_risk_class == "CLASS_3":
            class_3_count += 1

        # --- Aggregate counters ---
        if c_level == "HIGH":
            high_cal_risk_count += 1
        elif c_level == "MEDIUM":
            medium_cal_risk_count += 1
        else:
            low_cal_risk_count += 1

        if cal_status == "OVERDUE":
            overdue_count += 1

        if most_recent_status == "FAIL":
            recent_failure_count += 1

        device_summaries.append({
            "id": d.id,
            "serial_number": d.serial_number,
            "department": d.department_name,
            "device_type": d.device_type,
            "model": d.model,
            "manufacturer": d.manufacturer,
            "risk_class": dyn_risk_class,
            "probability_occurrence": dyn_prob_occ,
            "equipment_risk": dyn_equip_risk,
            "risk_percentage": dyn_risk_pct,
            "calibration_risk_level": c_level,
            "calibration_failure_rate": cal_failure_rate,
            "calibration_status": cal_status,
            "days_remaining": days_rem,
        })

    return {
        "overall_stats": {
            "total_devices": total_devices,
            "class_1_count": class_1_count,
            "class_2_count": class_2_count,
            "class_3_count": class_3_count,
            "high_calibration_risk_count": high_cal_risk_count,
            "medium_calibration_risk_count": medium_cal_risk_count,
            "low_calibration_risk_count": low_cal_risk_count,
            "overdue_count": overdue_count,
            "recent_failure_count": recent_failure_count,
        },
        "risk_distribution": [
            {"label": "Class 1 (Low Risk)", "risk_class": "CLASS_1", "count": class_1_count},
            {"label": "Class 2 (Medium Risk)", "risk_class": "CLASS_2", "count": class_2_count},
            {"label": "Class 3 (High Criticality)", "risk_class": "CLASS_3", "count": class_3_count},
        ],
        "calibration_risk_distribution": [
            {"level": "LOW", "count": low_cal_risk_count},
            {"level": "MEDIUM", "count": medium_cal_risk_count},
            {"level": "HIGH", "count": high_cal_risk_count},
        ],
        "devices": device_summaries,
    }
