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
# Risk Classification (placeholder — logic TBD)
# ---------------------------------------------------------------------------

class RiskFactorSchema(BaseModel):
    factor: str
    score: int
    max_score: int
    level: str


class RiskDataSchema(BaseModel):
    serial_number: str
    risk_level: str
    risk_score: int
    max_score: int
    last_assessed: str
    factors: list[RiskFactorSchema]
    recommendation: str