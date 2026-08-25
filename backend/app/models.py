"""
models.py — SQLAlchemy ORM models for Adam International Hospital Calibration App.
Tables must already exist in the Neon/Postgres DB.
"""
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, ForeignKey, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class EquipmentRiskConfig(Base):
    """
    Risk Assessment Configuration per Device Type.
    Stores process risk, patient risk, equipment counts, probability of occurrence,
    calculated risk score, risk percentage, and risk class from Excel methodology.
    """
    __tablename__ = "equipment_risk_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_type: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    arabic_name: Mapped[str] = mapped_column(String, nullable=True)
    process_risk: Mapped[int] = mapped_column(Integer, nullable=False, default=1)      # 1, 2, 3
    patient_risk: Mapped[int] = mapped_column(Integer, nullable=False, default=1)      # 1, 2, 3
    minimum_required: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    equipment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    probability_occurrence: Mapped[float] = mapped_column(Numeric, nullable=True)
    equipment_risk: Mapped[float] = mapped_column(Numeric, nullable=True)
    risk_percentage: Mapped[float] = mapped_column(Numeric, nullable=True)
    risk_class: Mapped[str] = mapped_column(String, nullable=False, default="CLASS_1")  # CLASS_1 | CLASS_2 | CLASS_3
    recommended_action: Mapped[str] = mapped_column(String, nullable=True)
    preventive_action: Mapped[str] = mapped_column(String, nullable=True)
    corrective_action: Mapped[str] = mapped_column(String, nullable=True)
    notes: Mapped[str] = mapped_column(String, nullable=True)


class ToleranceRule(Base):
    """
    Per-test-label tolerance specification.

    tolerance_type: "percentage" → min = ref*(1-value/100), max = ref*(1+value/100)
                    "absolute"   → min = ref - value,       max = ref + value
    """
    __tablename__ = "tolerance_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    test_label: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    tolerance_type: Mapped[str] = mapped_column(String, nullable=False)   # "percentage" | "absolute"
    tolerance_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(String, nullable=True)              # display hint, e.g. "mmHg"
    notes: Mapped[str] = mapped_column(String, nullable=True)


class User(Base):
    """Login accounts for hospital staff."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    serial_number: Mapped[str] = mapped_column(String, nullable=True)
    department_name: Mapped[str] = mapped_column(String, nullable=True)
    device_type: Mapped[str] = mapped_column(String, nullable=True)
    model: Mapped[str] = mapped_column(String, nullable=True)
    manufacturer: Mapped[str] = mapped_column(String, nullable=True)
    resolution: Mapped[float] = mapped_column(Numeric, nullable=True)

    calibration_records: Mapped[list["CalibrationRecord"]] = relationship(
        back_populates="device"
    )


class CalibrationRecord(Base):
    __tablename__ = "calibration_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"))
    calibration_year: Mapped[int] = mapped_column(Integer, nullable=True)
    certificate_num: Mapped[str] = mapped_column(String, nullable=True)
    result: Mapped[str] = mapped_column(String, nullable=True)
    accessory_type: Mapped[str] = mapped_column(String, nullable=True)
    accessory_model: Mapped[str] = mapped_column(String, nullable=True)
    accessory_serial: Mapped[str] = mapped_column(String, nullable=True)

    device: Mapped["Device"] = relationship(back_populates="calibration_records")
    tests: Mapped[list["CalibrationTest"]] = relationship(back_populates="record")


class CalibrationTest(Base):
    __tablename__ = "calibration_tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    calibration_record_id: Mapped[int] = mapped_column(
        ForeignKey("calibration_records.id")
    )
    test_label: Mapped[str] = mapped_column(String, nullable=True)
    test_point_unit: Mapped[str] = mapped_column(String, nullable=True)
    reference_value: Mapped[float] = mapped_column(Numeric, nullable=True)
    actual_value: Mapped[float] = mapped_column(Numeric, nullable=True)
    deviation: Mapped[float] = mapped_column(Numeric, nullable=True)
    min_value: Mapped[float] = mapped_column(Numeric, nullable=True)
    max_value: Mapped[float] = mapped_column(Numeric, nullable=True)
    record: Mapped["CalibrationRecord"] = relationship(back_populates="tests")


class AuditLog(Base):
    """Activity and Audit Trail log for clinical actions."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_name: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    entity_type: Mapped[str] = mapped_column(String, nullable=True)
    details: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )