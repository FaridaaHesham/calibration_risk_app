"""
schemas.py — Pydantic data models for all API request/response bodies.
"""
from pydantic import BaseModel
from typing import Optional


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    role: str


# ---------------------------------------------------------------------------
# Devices
# ---------------------------------------------------------------------------

class DeviceSchema(BaseModel):
    id: int
    serial_number: Optional[str]
    department: Optional[str]      # mapped from department_name
    device_type: Optional[str]
    model: Optional[str]
    manufacturer: Optional[str]
    resolution: Optional[float]

    class Config:
        from_attributes = True


class DeviceCreateRequest(BaseModel):
    """Payload for registering a brand-new device via the Add Calibration Data page."""
    serial_number: str
    department_name: Optional[str] = None
    device_type: str                   # required
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    resolution: Optional[float] = None


class DeviceUpdateRequest(BaseModel):
    """Payload for updating an existing device's metadata."""
    department_name: Optional[str] = None
    device_type: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    resolution: Optional[float] = None


# ---------------------------------------------------------------------------
# Tolerance Rules
# ---------------------------------------------------------------------------

class ToleranceRuleSchema(BaseModel):
    id: int
    test_label: str
    tolerance_type: str    # "percentage" | "absolute"
    tolerance_value: float
    unit: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class ToleranceRuleCreate(BaseModel):
    test_label: str
    tolerance_type: str
    tolerance_value: float
    unit: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Calibration Prediction
# ---------------------------------------------------------------------------

class YearScorePoint(BaseModel):
    year: int
    score: float    # closeness-to-edge (0-100 %, higher = closer to failing)
    result: str     # "Pass" | "Fail"


class DevicePredictionResponse(BaseModel):
    device_id: int
    serial_number: Optional[str]
    year_scores: list[YearScorePoint]
    interval_years: int
    rule: str
    message: str


# Schema used in the /predictions list endpoint
class PredictedDeviceSchema(BaseModel):
    serial_number: Optional[str]
    department: Optional[str]
    device_type: Optional[str]
    model: Optional[str]
    manufacturer: Optional[str]
    stability: str          # "stable" | "marginal" | "unstable"
    label: str
    interval_years: int
    next_date: str
    message: str


# ---------------------------------------------------------------------------
# Calibrations — history table
# ---------------------------------------------------------------------------

class TestResultSchema(BaseModel):
    id: int
    test_label: Optional[str]
    test_point_unit: Optional[str]
    reference_value: Optional[float]
    actual_value: Optional[float]
    deviation: Optional[float]
    min_value: Optional[float]
    max_value: Optional[float]

    class Config:
        from_attributes = True


class CalibrationRecordSchema(BaseModel):
    id: int
    calibration_year: Optional[int]
    certificate_num: Optional[str]
    result: Optional[str]
    accessory_type: Optional[str]
    accessory_model: Optional[str]
    accessory_serial: Optional[str]
    tests: list[TestResultSchema] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Calibrations — creating a new record (Add Calibration Data page)
# ---------------------------------------------------------------------------

class TestInput(BaseModel):
    """One row from the 'Calibration Measurements' section of the add-record form."""
    test_label: str
    test_point_unit: str               # required — the measurement unit (e.g. mmHg, BPM)
    reference_value: float             # required — the nominal reference point
    actual_value: float
    min_value: float
    max_value: float
    # deviation is optional on input — if omitted, the backend computes it as
    # (reference_value - actual_value), matching the convention already used
    # throughout the existing historical data.
    deviation: Optional[float] = None


class CalibrationRecordCreate(BaseModel):
    serial_number: str
    calibration_year: int
    certificate_num: Optional[str] = None
    result: Optional[str] = None  # if omitted, derived from whether every test passed
    accessory_type: Optional[str] = None
    accessory_model: Optional[str] = None
    accessory_serial: Optional[str] = None
    tests: list[TestInput]


# ---------------------------------------------------------------------------
# Chart data (control chart)
# ---------------------------------------------------------------------------

class ChartPointSchema(BaseModel):
    year: int
    score: float     # closeness-to-edge score used as the chart value
    result: str


class CalibrationRecommendationSchema(BaseModel):
    stability: str          # "stable" | "marginal" | "unstable"
    label: str
    next_date: str
    interval_years: int
    message: str


class ChartDataResponse(BaseModel):
    # Mapping of accessory_type to its specific chart points and recommendation
    # If a record has no accessory, it falls under 'Main Device'
    accessories: dict[str, dict]


# ---------------------------------------------------------------------------
# Risk Assessment Module Schemas
# ---------------------------------------------------------------------------

class EquipmentRiskConfigSchema(BaseModel):
    id: int
    device_type: str
    arabic_name: Optional[str]
    process_risk: int
    patient_risk: int
    minimum_required: int
    equipment_count: int
    probability_occurrence: Optional[float]
    equipment_risk: Optional[float]
    risk_percentage: Optional[float]
    risk_class: str                 # "CLASS_1" | "CLASS_2" | "CLASS_3"
    recommended_action: Optional[str]
    preventive_action: Optional[str]
    corrective_action: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class EquipmentRiskConfigCreate(BaseModel):
    device_type: str
    arabic_name: Optional[str] = None
    process_risk: int = 1
    patient_risk: int = 1
    minimum_required: int = 1
    equipment_count: int = 1
    recommended_action: Optional[str] = None
    preventive_action: Optional[str] = None
    corrective_action: Optional[str] = None
    notes: Optional[str] = None


class EquipmentRiskDataSchema(BaseModel):
    device_type: str
    arabic_name: Optional[str]
    process_risk: int
    patient_risk: int
    minimum_required: int
    equipment_count: int
    probability_occurrence: float
    equipment_risk: float
    risk_percentage: float
    risk_class: str
    recommended_action: Optional[str]
    preventive_action: Optional[str]
    corrective_action: Optional[str]


class CalibrationRiskStatsSchema(BaseModel):
    total_calibrations: int
    passed_calibrations: int
    failed_calibrations: int
    calibration_failure_rate: Optional[float]
    most_recent_calibration_status: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    test_failure_rate: Optional[float]
    max_deviation: Optional[float]
    avg_deviation: Optional[float]
    out_of_range_count: int
    most_recent_deviation: Optional[float]
    calibration_risk_level: str       # "LOW" | "MEDIUM" | "HIGH"


class CalibrationPredictionStatusSchema(BaseModel):
    last_calibration: Optional[str]
    predicted_next_calibration: Optional[str]
    days_remaining: int
    status: str                         # "NORMAL" | "DUE SOON" | "OVERDUE"
    prediction_rule: str


class DeviceRiskDetailResponse(BaseModel):
    device: DeviceSchema
    equipment_risk: EquipmentRiskDataSchema
    calibration_risk: CalibrationRiskStatsSchema
    calibration_prediction: CalibrationPredictionStatusSchema
    recommendations: list[str]


class RiskDashboardOverallStatsSchema(BaseModel):
    total_devices: int
    class_1_count: int
    class_2_count: int
    class_3_count: int
    high_calibration_risk_count: int
    medium_calibration_risk_count: int
    low_calibration_risk_count: int
    overdue_count: int
    recent_failure_count: int


class RiskDistributionItemSchema(BaseModel):
    label: str
    risk_class: str
    count: int


class CalibrationRiskDistributionItemSchema(BaseModel):
    level: str
    count: int


class DeviceRiskSummaryItemSchema(BaseModel):
    id: int
    serial_number: Optional[str]
    department: Optional[str]
    device_type: Optional[str]
    model: Optional[str]
    manufacturer: Optional[str]
    risk_class: str
    probability_occurrence: Optional[float] = 1.0
    equipment_risk: Optional[float] = None
    risk_percentage: float
    calibration_risk_level: str
    calibration_failure_rate: Optional[float]
    calibration_status: str
    days_remaining: int


class RiskDashboardResponse(BaseModel):
    overall_stats: RiskDashboardOverallStatsSchema
    risk_distribution: list[RiskDistributionItemSchema]
    calibration_risk_distribution: list[CalibrationRiskDistributionItemSchema]
    devices: list[DeviceRiskSummaryItemSchema]


# ---------------------------------------------------------------------------
# User Management & Roles
# ---------------------------------------------------------------------------

class UserSchema(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserCreateRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "Biomedical Engineer"


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserPasswordResetRequest(BaseModel):
    new_password: str


# ---------------------------------------------------------------------------
# Activity & Audit Logs
# ---------------------------------------------------------------------------

class AuditLogSchema(BaseModel):
    id: int
    user_name: str
    action: str
    entity_type: Optional[str] = None
    details: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Alerts & Notifications
# ---------------------------------------------------------------------------

class AlertItemSchema(BaseModel):
    serial_number: str
    department: Optional[str] = None
    device_type: Optional[str] = None
    model: Optional[str] = None
    status: str       # "HIGH_RISK_ASSESSMENT" | "HIGH_CAL_RISK" | "OVERDUE" | "DUE_SOON"
    days_remaining: int
    predicted_date: Optional[str] = None
    risk_class: Optional[str] = None           # "CLASS_1" | "CLASS_2" | "CLASS_3"
    risk_percentage: Optional[float] = None
    calibration_risk_level: Optional[str] = None # "LOW" | "MEDIUM" | "HIGH"
    calibration_failure_rate: Optional[float] = None
    alert_type: Optional[str] = None           # "HIGH_RISK_ASSESSMENT" | "HIGH_CAL_RISK" | "OVERDUE" | "DUE_SOON"
    alert_message: Optional[str] = None


class AlertsResponseSchema(BaseModel):
    total_alerts: int
    overdue_count: int
    due_soon_count: int
    high_risk_assessment_count: int = 0
    high_risk_calibration_count: int = 0
    alerts: list[AlertItemSchema]


# ---------------------------------------------------------------------------
# Departmental Compliance
# ---------------------------------------------------------------------------

class DepartmentComplianceItem(BaseModel):
    department: str
    total_devices: int
    calibrated_devices: int
    overdue_devices: int
    compliance_rate: float   # 0 to 100%
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int


class DepartmentComplianceResponse(BaseModel):
    departments: list[DepartmentComplianceItem]
    hospital_compliance_rate: float


# ---------------------------------------------------------------------------
# Bulk Import
# ---------------------------------------------------------------------------

class BulkImportResponse(BaseModel):
    success: bool
    imported_devices: int
    imported_records: int
    imported_tests: int
    errors: list[str]
    message: str
