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
    serial_number: str
    department: str
    device_type: str
    model: str
    manufacturer: str


class PredictedDeviceSchema(DeviceSchema):
    stability: str
    label: str
    interval_years: int
    next_date: str
    message: str



# ---------------------------------------------------------------------------
# Calibrations
# ---------------------------------------------------------------------------

class CalibrationRecordSchema(BaseModel):
    year: str
    test_label: str
    reference_value: float
    actual_value: float
    deviation: float
    tolerance: str
    result: str  # "Pass" | "Fail"


class ChartPointSchema(BaseModel):
    year: str
    value: float
    mean: float
    ucl: float
    lcl: float


class CalibrationRecommendationSchema(BaseModel):
    stability: str          # "stable" | "marginal" | "unstable"
    label: str
    next_date: str          # ISO date string
    interval_years: int
    message: str


class ChartDataResponse(BaseModel):
    points: list[ChartPointSchema]
    recommendation: CalibrationRecommendationSchema


# ---------------------------------------------------------------------------
# Risk Classification
# ---------------------------------------------------------------------------

class RiskFactorSchema(BaseModel):
    factor: str
    score: int
    max_score: int
    level: str  # "Low" | "Medium" | "High"


class RiskDataSchema(BaseModel):
    serial_number: str
    risk_level: str         # "Low" | "Medium" | "High"
    risk_score: int
    max_score: int
    last_assessed: str      # ISO date string
    factors: list[RiskFactorSchema]
    recommendation: str
