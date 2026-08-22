from sqlalchemy import String, Integer, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


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