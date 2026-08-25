"""
routers/risk.py — Risk Assessment & Classification endpoints.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EquipmentRiskConfig
from app.schemas import (
    RiskDashboardResponse,
    DeviceRiskDetailResponse,
    EquipmentRiskConfigSchema,
    EquipmentRiskConfigCreate,
    DepartmentComplianceResponse,
    DepartmentComplianceItem,
)
from app.services.risk_service import (
    get_risk_dashboard_summary,
    get_device_risk_summary,
    get_equipment_risk_config_for_type,
    calculate_equipment_risk_values,
)
from datetime import date

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/dashboard", response_model=RiskDashboardResponse)
async def get_risk_dashboard(db: AsyncSession = Depends(get_db)):
    """
    Return overall risk statistics, risk distributions, and per-device risk summaries
    for the Risk Assessment Dashboard.
    """
    return await get_risk_dashboard_summary(db)


@router.get("/device/{serial_number:path}", response_model=DeviceRiskDetailResponse)
async def get_device_risk_details(serial_number: str, db: AsyncSession = Depends(get_db)):
    """
    Return comprehensive risk analysis for a specific device by serial number:
      - Equipment Risk (Process Risk, Patient Risk, Risk Percentage, Risk Class)
      - Calibration Performance (Pass/Fail counts, Failure Rate, Calibration Risk Level)
      - Test-Level Statistics (Pass/Fail tests, Max/Average deviation)
      - Calibration Prediction Status (Days remaining, Overdue/Due Soon status)
      - Biomedical Engineering Recommendations
    """
    res = await get_device_risk_summary(serial_number, db)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with serial number '{serial_number}' not found.",
        )
    return res


@router.get("/device-type/{device_type:path}", response_model=EquipmentRiskConfigSchema)
async def get_risk_config_by_type(device_type: str, db: AsyncSession = Depends(get_db)):
    """Return risk assessment configuration for a specific equipment device_type."""
    config = await get_equipment_risk_config_for_type(device_type, db)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No risk configuration found for device type '{device_type}'.",
        )
    return config


@router.get("/assessments", response_model=list[EquipmentRiskConfigSchema])
async def list_risk_assessments(db: AsyncSession = Depends(get_db)):
    """Return all equipment type risk assessment configurations."""
    result = await db.execute(select(EquipmentRiskConfig).order_by(EquipmentRiskConfig.device_type))
    return result.scalars().all()


@router.post("/assessment", response_model=EquipmentRiskConfigSchema, status_code=status.HTTP_201_CREATED)
async def create_risk_assessment(payload: EquipmentRiskConfigCreate, db: AsyncSession = Depends(get_db)):
    """Create a new equipment risk assessment configuration."""
    existing = await get_equipment_risk_config_for_type(payload.device_type, db)
    if existing and existing.device_type.lower() == payload.device_type.lower():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Risk assessment configuration for '{payload.device_type}' already exists.",
        )

    prob, equip_risk, risk_pct, risk_cls = calculate_equipment_risk_values(
        payload.process_risk,
        payload.patient_risk,
        payload.equipment_count,
        payload.minimum_required,
    )

    config = EquipmentRiskConfig(
        device_type=payload.device_type,
        arabic_name=payload.arabic_name,
        process_risk=payload.process_risk,
        patient_risk=payload.patient_risk,
        minimum_required=payload.minimum_required,
        equipment_count=payload.equipment_count,
        probability_occurrence=prob,
        equipment_risk=equip_risk,
        risk_percentage=risk_pct,
        risk_class=risk_cls,
        recommended_action=payload.recommended_action,
        preventive_action=payload.preventive_action,
        corrective_action=payload.corrective_action,
        notes=payload.notes,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.put("/assessment/{id}", response_model=EquipmentRiskConfigSchema)
async def update_risk_assessment(id: int, payload: EquipmentRiskConfigCreate, db: AsyncSession = Depends(get_db)):
    """Update an existing equipment risk assessment configuration by ID."""
    result = await db.execute(select(EquipmentRiskConfig).where(EquipmentRiskConfig.id == id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Risk assessment configuration with ID {id} not found.",
        )

    prob, equip_risk, risk_pct, risk_cls = calculate_equipment_risk_values(
        payload.process_risk,
        payload.patient_risk,
        payload.equipment_count,
        payload.minimum_required,
    )

    config.device_type = payload.device_type
    config.arabic_name = payload.arabic_name
    config.process_risk = payload.process_risk
    config.patient_risk = payload.patient_risk
    config.minimum_required = payload.minimum_required
    config.equipment_count = payload.equipment_count
    config.probability_occurrence = prob
    config.equipment_risk = equip_risk
    config.risk_percentage = risk_pct
    config.risk_class = risk_cls
    if payload.recommended_action:
        config.recommended_action = payload.recommended_action
    if payload.preventive_action:
        config.preventive_action = payload.preventive_action
    if payload.corrective_action:
        config.corrective_action = payload.corrective_action
    if payload.notes:
        config.notes = payload.notes

    await db.commit()
    await db.refresh(config)
    return config


@router.get("/departments-compliance", response_model=DepartmentComplianceResponse)
async def get_departments_compliance(db: AsyncSession = Depends(get_db)):
    """Return departmental calibration compliance rates and risk breakdowns."""
    dashboard = await get_risk_dashboard_summary(db)
    
    deps = {}
    total_calibrated = 0
    total_hospital_devices = len(dashboard.devices)
    
    for device in dashboard.devices:
        dep_name = device.department or "Unassigned"
        if dep_name not in deps:
            deps[dep_name] = {
                "total_devices": 0,
                "calibrated_devices": 0,
                "overdue_devices": 0,
                "high_risk_count": 0,
                "medium_risk_count": 0,
                "low_risk_count": 0
            }
            
        deps[dep_name]["total_devices"] += 1
        
        if device.calibration_status == "Calibrated":
            deps[dep_name]["calibrated_devices"] += 1
            total_calibrated += 1
        elif device.calibration_status == "Overdue":
            deps[dep_name]["overdue_devices"] += 1
            
        if device.risk_class == "CLASS_3":
            deps[dep_name]["high_risk_count"] += 1
        elif device.risk_class == "CLASS_2":
            deps[dep_name]["medium_risk_count"] += 1
        else:
            deps[dep_name]["low_risk_count"] += 1

    dep_list = []
    for dep, stats in deps.items():
        comp_rate = (stats["calibrated_devices"] / stats["total_devices"]) * 100 if stats["total_devices"] > 0 else 0
        dep_list.append(DepartmentComplianceItem(
            department=dep,
            total_devices=stats["total_devices"],
            calibrated_devices=stats["calibrated_devices"],
            overdue_devices=stats["overdue_devices"],
            compliance_rate=round(comp_rate, 2),
            high_risk_count=stats["high_risk_count"],
            medium_risk_count=stats["medium_risk_count"],
            low_risk_count=stats["low_risk_count"],
        ))
        
    dep_list.sort(key=lambda x: x.compliance_rate)
    
    hosp_comp_rate = (total_calibrated / total_hospital_devices) * 100 if total_hospital_devices > 0 else 0
    
    return DepartmentComplianceResponse(
        departments=dep_list,
        hospital_compliance_rate=round(hosp_comp_rate, 2)
    )

