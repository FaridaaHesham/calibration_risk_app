"""
seed_risk_rules.py — Seed equipment risk classification rules based on Excel risk methodology.

Run from backend/ directory:
    python seed_risk_rules.py
"""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.models import EquipmentRiskConfig

# Reference Excel Risk Rules Mapped to DB Device Types
DEFAULT_RISK_RULES = [
    {
        "device_type": "Defibrillator",
        "arabic_name": "جهاز صدمات قلب",
        "process_risk": 3,
        "patient_risk": 3,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Prioritize preventive maintenance & spare unit availability",
        "preventive_action": "Availability of spare device & Increase preventive maintenance rate",
        "corrective_action": "Notify all concerned departments, load minimization & repair/replacement",
        "notes": "High criticality life-support equipment",
    },
    {
        "device_type": "Ventilator",
        "arabic_name": "جهاز تنفس صناعي",
        "process_risk": 3,
        "patient_risk": 3,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Prioritize preventive maintenance & urgent engineering review",
        "preventive_action": "Availability of spare device & Increase preventive maintenance rate",
        "corrective_action": "Notify all concerned departments & repair/acquisition of new device",
        "notes": "Critical life-support equipment",
    },
    {
        "device_type": "Anathesia Ventilator",
        "arabic_name": "جهاز تنفس ومخدر",
        "process_risk": 3,
        "patient_risk": 3,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Prioritize preventive maintenance & immediate technical audit",
        "preventive_action": "Availability of spare device & Increase preventive maintenance rate",
        "corrective_action": "Notify all concerned departments & repair/acquisition of new device",
        "notes": "Critical operating theater equipment",
    },
    {
        "device_type": "Patient Monitor",
        "arabic_name": "مونيتور",
        "process_risk": 3,
        "patient_risk": 3,
        "minimum_required": 10,
        "equipment_count": 10,
        "recommended_action": "Frequent preventive inspection & calibration tracking",
        "preventive_action": "Availability of spare device & Increase preventive maintenance rate",
        "corrective_action": "Notify all concerned departments & repair/acquisition",
        "notes": "Vital signs monitoring equipment",
    },
    {
        "device_type": "Physiological Monitor",
        "arabic_name": "مونيتور علامات حيوية",
        "process_risk": 3,
        "patient_risk": 3,
        "minimum_required": 10,
        "equipment_count": 10,
        "recommended_action": "Frequent preventive inspection & calibration tracking",
        "preventive_action": "Availability of spare device & Increase preventive maintenance rate",
        "corrective_action": "Notify all concerned departments & repair/acquisition",
        "notes": "ICU/OR patient monitor",
    },
    {
        "device_type": "Infusion Pump",
        "arabic_name": "مضخة إنفيوجن",
        "process_risk": 2,
        "patient_risk": 3,
        "minimum_required": 5,
        "equipment_count": 5,
        "recommended_action": "Increase monitoring & regular calibration schedule",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Notify department & perform calibration repair",
        "notes": "Medication delivery pump",
    },
    {
        "device_type": "Syringe Pump",
        "arabic_name": "مضخة سرنجة",
        "process_risk": 2,
        "patient_risk": 3,
        "minimum_required": 5,
        "equipment_count": 5,
        "recommended_action": "Increase monitoring & regular calibration schedule",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Notify department & perform calibration repair",
        "notes": "Precision syringe infusion",
    },
    {
        "device_type": "Electrosurgical Unit (ESU)",
        "arabic_name": "جهاز كي كهروبي",
        "process_risk": 3,
        "patient_risk": 2,
        "minimum_required": 3,
        "equipment_count": 3,
        "recommended_action": "Regular preventive testing & electrical safety verification",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Technical inspection & output energy calibration",
        "notes": "Surgical electrocautery unit",
    },
    {
        "device_type": "ELECTROSURGICAL",
        "arabic_name": "جهاز كي جراحي",
        "process_risk": 3,
        "patient_risk": 2,
        "minimum_required": 3,
        "equipment_count": 3,
        "recommended_action": "Regular preventive testing & electrical safety verification",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Technical inspection & output energy calibration",
        "notes": "Surgical electrocautery unit",
    },
    {
        "device_type": "Ultrasound",
        "arabic_name": "سونار",
        "process_risk": 2,
        "patient_risk": 2,
        "minimum_required": 3,
        "equipment_count": 3,
        "recommended_action": "Increase monitoring & routine transducer inspection",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Probe performance calibration & service review",
        "notes": "Diagnostic imaging system",
    },
    {
        "device_type": "Autoclave",
        "arabic_name": "اوتوكلاف",
        "process_risk": 3,
        "patient_risk": 1,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Increase monitoring & sterilizer cycle validation",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Pressure/temperature gauge calibration & seal inspection",
        "notes": "Central sterile supply autoclave",
    },
    {
        "device_type": "Incubator",
        "arabic_name": "حضانة أطفال",
        "process_risk": 2,
        "patient_risk": 2,
        "minimum_required": 4,
        "equipment_count": 4,
        "recommended_action": "Increase monitoring & thermal sensor calibration",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Temperature & humidity control calibration",
        "notes": "Neonatal infant incubator",
    },
    {
        "device_type": "Incubator 37",
        "arabic_name": "حضانة معملية 37",
        "process_risk": 2,
        "patient_risk": 1,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Standard preventive maintenance & routine check",
        "preventive_action": "Continue normal preventive maintenance",
        "corrective_action": "Laboratory temperature sensor adjustment",
        "notes": "Lab incubator",
    },
    {
        "device_type": "Vaporizer",
        "arabic_name": "مبخر تخدير",
        "process_risk": 2,
        "patient_risk": 2,
        "minimum_required": 3,
        "equipment_count": 3,
        "recommended_action": "Increase monitoring & agent concentration test",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Anaesthetic gas vaporizer calibration",
        "notes": "Anaesthetic vaporizer module",
    },
    {
        "device_type": "Digital Thermometer",
        "arabic_name": "ترمومتر رقمي",
        "process_risk": 1,
        "patient_risk": 1,
        "minimum_required": 10,
        "equipment_count": 10,
        "recommended_action": "Continue normal preventive maintenance & scheduled calibration",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Recalibrate against reference temperature bath",
        "notes": "Standard temperature measurement",
    },
    {
        "device_type": "Sphygmomanometer",
        "arabic_name": "جهاز ضغط",
        "process_risk": 1,
        "patient_risk": 1,
        "minimum_required": 10,
        "equipment_count": 10,
        "recommended_action": "Continue normal preventive maintenance & scheduled calibration",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Pressure gauge zeroing and leak check",
        "notes": "Non-invasive blood pressure meter",
    },
    {
        "device_type": "Suction",
        "arabic_name": "شفاط عمليات",
        "process_risk": 1,
        "patient_risk": 2,
        "minimum_required": 5,
        "equipment_count": 5,
        "recommended_action": "Continue normal preventive maintenance & vacuum check",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Vacuum regulator calibration & filter check",
        "notes": "Surgical suction apparatus",
    },
    {
        "device_type": "Electrocardiograph (ECG)",
        "arabic_name": "جهاز رسم قلب",
        "process_risk": 2,
        "patient_risk": 1,
        "minimum_required": 3,
        "equipment_count": 3,
        "recommended_action": "Continue normal preventive maintenance & lead check",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "ECG signal generator calibration",
        "notes": "Diagnostic electrocardiograph",
    },
    {
        "device_type": "ECG",
        "arabic_name": "رسم قلب",
        "process_risk": 2,
        "patient_risk": 1,
        "minimum_required": 3,
        "equipment_count": 3,
        "recommended_action": "Continue normal preventive maintenance & lead check",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "ECG signal generator calibration",
        "notes": "Diagnostic electrocardiograph",
    },
    {
        "device_type": "Pipet",
        "arabic_name": "ماصة اوتوماتيك",
        "process_risk": 1,
        "patient_risk": 1,
        "minimum_required": 10,
        "equipment_count": 10,
        "recommended_action": "Continue normal preventive maintenance & volume test",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Gravimetric volume recalibration",
        "notes": "Laboratory automatic pipette",
    },
    {
        "device_type": "Centrifuge",
        "arabic_name": "طرد مركزي",
        "process_risk": 1,
        "patient_risk": 1,
        "minimum_required": 5,
        "equipment_count": 5,
        "recommended_action": "Continue normal preventive maintenance & RPM test",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Tachometer speed & timer calibration",
        "notes": "Laboratory centrifuge",
    },
    {
        "device_type": "Digital Balance",
        "arabic_name": "ميزان حساس رقمي",
        "process_risk": 1,
        "patient_risk": 1,
        "minimum_required": 5,
        "equipment_count": 5,
        "recommended_action": "Continue normal preventive maintenance & weight test",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Standard weight calibration",
        "notes": "Laboratory electronic balance",
    },
    {
        "device_type": "Laminar Flow",
        "arabic_name": "كبينة تدفق هواء",
        "process_risk": 2,
        "patient_risk": 1,
        "minimum_required": 3,
        "equipment_count": 3,
        "recommended_action": "Continue normal preventive maintenance & airflow test",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Air velocity & HEPA filter calibration",
        "notes": "Clean bench laminar flow cabinet",
    },
    {
        "device_type": "Controlled-Rate Freezer",
        "arabic_name": "فريزر تجميد محكوم",
        "process_risk": 2,
        "patient_risk": 1,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Increase monitoring & ultra-low temp calibration",
        "preventive_action": "Increase preventive maintenance rate",
        "corrective_action": "Temperature probe recalibration",
        "notes": "Cryogenic storage freezer",
    },
    {
        "device_type": "Water Bath",
        "arabic_name": "حمام مائي",
        "process_risk": 1,
        "patient_risk": 1,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Continue normal preventive maintenance",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Temperature thermostat calibration",
        "notes": "Laboratory water bath",
    },
    {
        "device_type": "Oven",
        "arabic_name": "فرن تجفيف معملي",
        "process_risk": 1,
        "patient_risk": 1,
        "minimum_required": 2,
        "equipment_count": 2,
        "recommended_action": "Continue normal preventive maintenance",
        "preventive_action": "Continue scheduled calibration",
        "corrective_action": "Drying oven temperature calibration",
        "notes": "Laboratory oven",
    },
]


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


async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with SessionLocal() as session:
        for rule_data in DEFAULT_RISK_RULES:
            dev_type = rule_data["device_type"]
            result = await session.execute(
                select(EquipmentRiskConfig).where(EquipmentRiskConfig.device_type == dev_type)
            )
            existing = result.scalar_one_or_none()

            prob, equip_risk, risk_pct, risk_cls = calculate_equipment_risk_values(
                rule_data["process_risk"],
                rule_data["patient_risk"],
                rule_data["equipment_count"],
                rule_data["minimum_required"],
            )

            if existing:
                existing.arabic_name = rule_data["arabic_name"]
                existing.process_risk = rule_data["process_risk"]
                existing.patient_risk = rule_data["patient_risk"]
                existing.minimum_required = rule_data["minimum_required"]
                existing.equipment_count = rule_data["equipment_count"]
                existing.probability_occurrence = prob
                existing.equipment_risk = equip_risk
                existing.risk_percentage = risk_pct
                existing.risk_class = risk_cls
                existing.recommended_action = rule_data["recommended_action"]
                existing.preventive_action = rule_data["preventive_action"]
                existing.corrective_action = rule_data["corrective_action"]
                existing.notes = rule_data["notes"]
            else:
                config = EquipmentRiskConfig(
                    device_type=dev_type,
                    arabic_name=rule_data["arabic_name"],
                    process_risk=rule_data["process_risk"],
                    patient_risk=rule_data["patient_risk"],
                    minimum_required=rule_data["minimum_required"],
                    equipment_count=rule_data["equipment_count"],
                    probability_occurrence=prob,
                    equipment_risk=equip_risk,
                    risk_percentage=risk_pct,
                    risk_class=risk_cls,
                    recommended_action=rule_data["recommended_action"],
                    preventive_action=rule_data["preventive_action"],
                    corrective_action=rule_data["corrective_action"],
                    notes=rule_data["notes"],
                )
                session.add(config)

        await session.commit()
        print("[OK] Seeded equipment risk classification rules successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
