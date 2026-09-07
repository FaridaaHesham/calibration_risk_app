"""
services/risk_service.py — Centralized service for Equipment Risk (Excel Medical & Non-Medical formulas),
Calibration Risk, Test Statistics & Dashboard.
"""
from datetime import date
from typing import Optional, Tuple
import logging

from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, CalibrationRecord, CalibrationTest, EquipmentRiskConfig
from app.prediction import predict_calibration_interval, build_year_scores

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants for Excel Risk Methodology
# ---------------------------------------------------------------------------
# Medical Equipment Excel constants
MEDICAL_NORM_FACTOR = 9.0 / 38.5           # (9 / 38.5)
MEDICAL_MAX_RISK_DENOMINATOR = 36.0        # Max possible medical equipment risk denominator

# Non-Medical Equipment Excel constants
NON_MEDICAL_NORM_FACTOR = 9.0 / 11.66666667 # (9 / 11.66666667)
NON_MEDICAL_MAX_RISK_DENOMINATOR = 27.77142856 # Max possible non-medical risk denominator

# Configurable Thresholds for Dynamic Calibration Risk Level (Independent Calibration Indicator)
CALIBRATION_RISK_THRESHOLDS = {
    "LOW_MAX": 0.0,       # 0% failure rate -> LOW
    "MEDIUM_MAX": 10.0,   # >0% and <=10% -> MEDIUM, >10% -> HIGH
}


# ---------------------------------------------------------------------------
# Core Risk Calculation Helper Functions (Excel Rule-Based)
# ---------------------------------------------------------------------------

def calculate_probability(occurrence_value: float, equipment_count: int) -> float:
    """
    Step 1: Probability of Occurrence = Occurrence Value / Number of Equipment.
    Handles division by zero and input validation safely.
    """
    if equipment_count is None or equipment_count <= 0:
        raise ValueError("Number of equipment must be greater than zero.")
    if occurrence_value is None or occurrence_value < 0:
        raise ValueError("Occurrence value cannot be negative.")
    return occurrence_value / float(equipment_count)


def calculate_medical_normalized_probability(probability: float) -> float:
    """Step 2 (Medical): Normalized Probability = Probability of Occurrence * (9 / 38.5)."""
    if probability is None or probability < 0:
        raise ValueError("Probability cannot be negative.")
    return probability * MEDICAL_NORM_FACTOR


def calculate_non_medical_normalized_probability(probability: float) -> float:
    """Step 2 (Non-Medical): Normalized Probability = Probability of Occurrence * (9 / 11.66666667)."""
    if probability is None or probability < 0:
        raise ValueError("Probability cannot be negative.")
    return probability * NON_MEDICAL_NORM_FACTOR


def calculate_equipment_risk(process_risk: int, patient_risk: int, normalized_probability: float) -> float:
    """
    Step 3: Equipment Risk = Process/Success Risk * Patient Risk * Normalized Probability.
    """
    if process_risk is None or process_risk < 0:
        raise ValueError("Process risk cannot be negative.")
    if patient_risk is None or patient_risk < 0:
        raise ValueError("Patient risk cannot be negative.")
    if normalized_probability is None or normalized_probability < 0:
        raise ValueError("Normalized probability cannot be negative.")
    return float(process_risk) * float(patient_risk) * float(normalized_probability)


def calculate_medical_risk_percentage(equipment_risk: float) -> float:
    """Step 4 (Medical): Equipment Risk % = (Equipment Risk / 36) * 100."""
    if equipment_risk is None or equipment_risk < 0:
        raise ValueError("Equipment risk cannot be negative.")
    return (equipment_risk / MEDICAL_MAX_RISK_DENOMINATOR) * 100.0


def calculate_non_medical_risk_percentage(equipment_risk: float) -> float:
    """Step 4 (Non-Medical): Equipment Risk % = (Equipment Risk / 27.77142856) * 100."""
    if equipment_risk is None or equipment_risk < 0:
        raise ValueError("Equipment risk cannot be negative.")
    return (equipment_risk / NON_MEDICAL_MAX_RISK_DENOMINATOR) * 100.0


def determine_medical_risk_class(risk_percentage: float) -> str:
    """
    Step 5 (Medical): Risk Classification Thresholds:
      - <= 10%        -> CLASS_1 ("Class 1")
      - > 10% & < 50% -> CLASS_2 ("Class 2")
      - >= 50%        -> CLASS_3 ("Class 3")
    """
    if risk_percentage <= 10.0:
        return "CLASS_1"
    elif risk_percentage < 50.0:
        return "CLASS_2"
    else:
        return "CLASS_3"


# Backward compatibility alias
calculate_risk_class = determine_medical_risk_class


def determine_non_medical_risk_class(risk_percentage: float) -> str:
    """
    Step 5 (Non-Medical): Risk Classification Thresholds:
      - <= 30%        -> CLASS_1 ("Class 1")
      - > 30% & < 70% -> CLASS_2 ("Class 2")
      - >= 70%        -> CLASS_3 ("Class 3")
    """
    if risk_percentage <= 30.0:
        return "CLASS_1"
    elif risk_percentage < 70.0:
        return "CLASS_2"
    else:
        return "CLASS_3"


def calculate_medical_risk(
    process_risk: int,
    patient_risk: int,
    occurrence_value: float,
    equipment_count: int
) -> dict:
    """
    Calculate full medical equipment risk assessment strictly following Excel 'medical' sheet formulas.
    """
    prob = calculate_probability(occurrence_value, equipment_count)
    norm_prob = calculate_medical_normalized_probability(prob)
    equip_risk = calculate_equipment_risk(process_risk, patient_risk, norm_prob)
    risk_pct = calculate_medical_risk_percentage(equip_risk)
    risk_cls = determine_medical_risk_class(risk_pct)

    return {
        "probability_occurrence": round(prob, 8),
        "normalized_probability": round(norm_prob, 8),
        "equipment_risk": round(equip_risk, 8),
        "risk_percentage": round(risk_pct, 4),
        "risk_class": risk_cls,
    }


def calculate_non_medical_risk(
    process_risk: int,
    patient_risk: int,
    occurrence_value: float,
    equipment_count: int
) -> dict:
    """
    Calculate full non-medical equipment risk assessment strictly following Excel 'non medical' sheet formulas.
    """
    prob = calculate_probability(occurrence_value, equipment_count)
    norm_prob = calculate_non_medical_normalized_probability(prob)
    equip_risk = calculate_equipment_risk(process_risk, patient_risk, norm_prob)
    risk_pct = calculate_non_medical_risk_percentage(equip_risk)
    risk_cls = determine_non_medical_risk_class(risk_pct)

    return {
        "probability_occurrence": round(prob, 8),
        "normalized_probability": round(norm_prob, 8),
        "equipment_risk": round(equip_risk, 8),
        "risk_percentage": round(risk_pct, 4),
        "risk_class": risk_cls,
    }


def calculate_excel_risk(
    equipment_category: str,
    process_risk: int,
    patient_risk: int,
    occurrence_value: float,
    equipment_count: int
) -> dict:
    """
    Master dispatcher for Excel Risk calculation based on equipment category ('medical' | 'non_medical').
    """
    cat = (equipment_category or "medical").strip().lower()
    if cat in ("medical", "med"):
        return calculate_medical_risk(process_risk, patient_risk, occurrence_value, equipment_count)
    elif cat in ("non_medical", "non-medical", "non medical", "nonmed"):
        return calculate_non_medical_risk(process_risk, patient_risk, occurrence_value, equipment_count)
    else:
        raise ValueError(f"Unknown equipment category '{equipment_category}'. Must be 'medical' or 'non_medical'.")


# ---------------------------------------------------------------------------
# Calibration Performance Indicators (Independent from Equipment Risk)
# ---------------------------------------------------------------------------

def calculate_calibration_risk_level(failure_rate: Optional[float]) -> str:
    """Return dynamic calibration risk level: LOW | MEDIUM | HIGH."""
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
        last_cal_date = f"October {last_year}"
        next_year = last_year + predicted_iv
        next_cal_date = f"October {next_year}"
        target_date = date(next_year, 10, 15)
        days_rem = (target_date - today).days
    else:
        last_cal_date = None
        next_year = today.year + predicted_iv
        next_cal_date = f"October {next_year}"
        days_rem = 365 * predicted_iv

    if days_rem < 0:
        status_label = "OVERDUE"
    elif days_rem <= 90:
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
    """
    Return unified Equipment Risk, Calibration Performance, Prediction & Recommendations.
    Equipment risk calculation is pure Excel rule-based and strictly decoupled from calibration data.
    """
    q = (serial_number or "").strip()
    if not q:
        return None
    q_no_zero = q.lstrip('0') or '0'

    # 1. Exact match
    stmt = select(Device).where(
        or_(
            func.lower(Device.serial_number) == q.lower(),
            func.lower(Device.serial_number) == q_no_zero.lower(),
        )
    )
    res = await db.execute(stmt)
    device = res.scalars().first()

    # 2. Substring fallback match
    if not device:
        patterns = [f"%{q.lower()}%"]
        if q_no_zero != q:
            patterns.append(f"%{q_no_zero.lower()}%")
        like_conds = [func.lower(Device.serial_number).like(p) for p in patterns]
        res = await db.execute(select(Device).where(or_(*like_conds)))
        device = res.scalars().first()

    if not device:
        return None

    cal_stats = await compute_device_calibration_stats(device.id, db)
    pred_stats = await compute_device_prediction_status(device, db)

    config = await get_equipment_risk_config_for_type(device.device_type, db)

    if config:
        category = config.equipment_category or "medical"
        eq_count = max(config.equipment_count or 1, 1)
        occ_val = float(config.occurrence_value or 0.0)
        p_risk = config.process_risk or 1
        pat_risk = config.patient_risk or 1

        calc = calculate_excel_risk(
            equipment_category=category,
            process_risk=p_risk,
            patient_risk=pat_risk,
            occurrence_value=occ_val,
            equipment_count=eq_count,
        )

        equip_risk_data = {
            "device_type": device.device_type,
            "arabic_name": config.arabic_name,
            "equipment_category": category,
            "process_risk": p_risk,
            "patient_risk": pat_risk,
            "minimum_required": config.minimum_required or 1,
            "equipment_count": eq_count,
            "occurrence_value": occ_val,
            "probability_occurrence": calc["probability_occurrence"],
            "normalized_probability": calc["normalized_probability"],
            "equipment_risk": calc["equipment_risk"],
            "risk_percentage": calc["risk_percentage"],
            "risk_class": calc["risk_class"],
            "recommended_action": config.recommended_action,
            "preventive_action": config.preventive_action,
            "corrective_action": config.corrective_action,
        }
    else:
        calc = calculate_medical_risk(1, 1, 0.0, 1)
        equip_risk_data = {
            "device_type": device.device_type,
            "arabic_name": "غير مصنف",
            "equipment_category": "medical",
            "process_risk": 1,
            "patient_risk": 1,
            "minimum_required": 1,
            "equipment_count": 1,
            "occurrence_value": 0.0,
            "probability_occurrence": calc["probability_occurrence"],
            "normalized_probability": calc["normalized_probability"],
            "equipment_risk": calc["equipment_risk"],
            "risk_percentage": calc["risk_percentage"],
            "risk_class": calc["risk_class"],
            "recommended_action": "Standard preventive maintenance",
            "preventive_action": "Continue scheduled calibration",
            "corrective_action": "Routine inspection",
        }

    # Generate recommendations list based on equipment risk and calibration indicator
    recommendations = []
    r_class = equip_risk_data["risk_class"]
    c_level = cal_stats["calibration_risk_level"]

    if r_class == "CLASS_1":
        recommendations.append("Continue normal preventive maintenance and routine scheduled calibration.")
    elif r_class == "CLASS_2":
        recommendations.append("Increase monitoring frequency and review equipment performance.")
        if equip_risk_data.get("preventive_action"):
            recommendations.append(f"Preventive: {equip_risk_data['preventive_action']}")
    elif r_class == "CLASS_3":
        recommendations.append("High Criticality: Prioritize preventive maintenance & maintain spare device availability.")
        if equip_risk_data.get("preventive_action"):
            recommendations.append(f"Preventive: {equip_risk_data['preventive_action']}")
        if equip_risk_data.get("corrective_action"):
            recommendations.append(f"Corrective: {equip_risk_data['corrective_action']}")

    if c_level == "HIGH":
        recommendations.append("ALERT: High calibration failure rate detected (>10%). Escalate for engineering review.")
    elif c_level == "MEDIUM":
        recommendations.append("Notice: Marginal calibration performance. Monitor upcoming test parameters closely.")

    if pred_stats["status"] == "OVERDUE":
        recommendations.append("URGENT: Calibration is OVERDUE. Schedule immediate calibration service.")
    elif pred_stats["status"] == "DUE SOON":
        recommendations.append("Notice: Calibration is due within 90 days. Prepare calibration protocol.")

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
    """
    Return aggregate statistics across all devices for the Risk Assessment Dashboard.
    Equipment risk calculation strictly uses Excel formulas without dynamic calibration tampering.
    """
    # --- 1. Load devices ---
    res_devices = await db.execute(select(Device))
    devices = res_devices.scalars().all()

    # --- 2. Load ALL calibration records with tests eagerly in one query ---
    recs_result = await db.execute(
        select(CalibrationRecord)
        .options(selectinload(CalibrationRecord.tests))
        .order_by(CalibrationRecord.device_id, CalibrationRecord.calibration_year.desc())
    )
    all_records = recs_result.scalars().all()

    records_by_device: dict[int, list[CalibrationRecord]] = {}
    for rec in all_records:
        records_by_device.setdefault(rec.device_id, []).append(rec)

    # --- 3. Load risk configs ---
    configs_res = await db.execute(select(EquipmentRiskConfig))
    configs_list = configs_res.scalars().all()
    configs_map = {c.device_type.strip().lower(): c for c in configs_list}

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
        elif days_rem <= 90:
            cal_status = "DUE SOON"
        else:
            cal_status = "NORMAL"

        # --- Pure Excel Equipment Risk Calculation (Decoupled from calibration failure rate) ---
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
            prob_occ = calc["probability_occurrence"]
            equip_risk = calc["equipment_risk"]
            risk_pct = calc["risk_percentage"]
            risk_cls = calc["risk_class"]
        else:
            prob_occ = 0.0
            equip_risk = 0.0
            risk_pct = 0.0
            risk_cls = "CLASS_1"

        if risk_cls == "CLASS_1":
            class_1_count += 1
        elif risk_cls == "CLASS_2":
            class_2_count += 1
        elif risk_cls == "CLASS_3":
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
            "risk_class": risk_cls,
            "probability_occurrence": prob_occ,
            "equipment_risk": equip_risk,
            "risk_percentage": risk_pct,
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

