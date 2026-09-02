"""
seed_risk_rules.py — Seed clean, deduplicated Equipment Risk Classification dataset (English device types).
Covers exactly 66 Medical equipment types and 30 Non-Medical equipment types (96 unique items total).
No Arabic duplicates: English name in device_type, Arabic translation in arabic_name.
Also updates any physical devices in the database to use English device_type names.
"""
import asyncio
from sqlalchemy import select, delete, update, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.models import EquipmentRiskConfig, Device, Base
from app.services.risk_service import calculate_excel_risk

# ---------------------------------------------------------------------------
# MAPPING: ARABIC TO CANONICAL ENGLISH DEVICE TYPE
# ---------------------------------------------------------------------------
ARABIC_TO_ENGLISH_MAP = {
    # Medical
    "عدسة خاصة imt بميكروسكوب": "IMT Microscope Lens",
    "التنفس الصناعي": "Ventilator",
    "جهاز تنفس صناعي": "Ventilator",
    "ventilator": "Ventilator",
    "اوتوكلاف": "Autoclave",
    "autoclave": "Autoclave",
    "برج تنقية هواء": "Air Purification Tower",
    "تجميد حيوانات منوية": "Sperm Cryopreservation Unit",
    "ترابيزة عمليات": "Operating Table",
    "operating table": "Operating Table",
    "ترموميتر رقمي": "Digital Thermometer",
    "digital thermometer": "Digital Thermometer",
    "تعقيم هواء": "Air Sterilization Unit",
    "جهاز الليزر": "Laser Device",
    "جهاز تخدير": "Anesthesia Machine",
    "anathesia ventilator": "Anesthesia Machine",
    "جهاز تقطير المياة": "Water Distillation Unit",
    "جهاز ذبذبات": "Vibration Oscillator",
    "جهاز صدمات كهربائي": "Defibrillator",
    "defibrillator": "Defibrillator",
    "جهاز ضغط": "Sphygmomanometer",
    "sphygmomanometer": "Sphygmomanometer",
    "جهاز قياس الرطوبة": "Hygrometer",
    "جهاز قياس السكر": "Glucometer",
    "حضانة": "Infant Incubator",
    "incubator": "Infant Incubator",
    "حضانة اجنة": "Embryo Incubator",
    "خزان نيتروجين صغير": "Liquid Nitrogen Tank (Small)",
    "خزان نيتروجين كبير": "Liquid Nitrogen Tank (Large)",
    "دياثرمي": "Electrosurgical Unit (ESU)",
    "electrosurgical unit (esu)": "Electrosurgical Unit (ESU)",
    "electrosurgical": "Electrosurgical Unit (ESU)",
    "رسم قلب": "ECG Machine",
    "ecg": "ECG Machine",
    "ريجيسكان": "RigiScan Device",
    "سخان انابيب": "Test Tube Warmer",
    "سونار": "Ultrasound Machine",
    "ultrasound": "Ultrasound Machine",
    "شفاط بويضات": "Ovum Aspiration Pump",
    "طبق تسخين": "Heating Plate Warmer",
    "طرد مركزي": "Centrifuge",
    "centrifuge": "Centrifuge",
    "فرن تعقيم - فرن 60": "Sterilization Oven (Oven 60)",
    "قذف كهربي": "Electroejaculation Device",
    "قياس درجة الحموضة والقلوية": "pH Meter",
    "قياس نسبة ثاني اكسيد الكربون": "CO2 Analyzer",
    "كاميرا منظار رحمي": "Hysteroscopy Camera",
    "كشاف عمليات متحرك وثابت": "Surgical Light",
    "كشاف فحص": "Examination Light",
    "لحام قضيبات لتجميد الحيوانات المنوية": "Sperm Straw Sealer",
    "ماصة اوتوماتيك": "Automated Pipette",
    "pipet": "Automated Pipette",
    "مبخر ايزو فلورين": "Isoflurane Vaporizer",
    "مبخر سيفو فلورين": "Sevoflurane Vaporizer",
    "محرك كهربي": "Electric Micromotor",
    "تنقية هواء": "Air Purifier",
    "مصدر ضوئي": "Light Source",
    "مضخة محاليل": "Infusion Pump",
    "infusion pump": "Infusion Pump",
    "منضدة ضد الاهتزاز": "Anti-Vibration Table",
    "منظار حنجري": "Laryngoscope",
    "منظار رحمي": "Hysteroscope",
    "مونيتور": "Patient Monitor",
    "patient monitor": "Patient Monitor",
    "ميزان حساس": "Analytical Digital Balance",
    "digital balance": "Analytical Digital Balance",
    "ميزان مريض": "Patient Scale",
    "ميكروسكوب": "Microscope",
    "microscope": "Microscope",
    "ميكروسكوب بكاميرا داخل الحضانة": "Incubator Integrated Microscope",
    "ميكروسكوب جراحي": "Surgical Microscope",
    "ميكروسكوب حقن مجهري": "ICSI Micromanipulator Microscope",
    "نيبوليزر": "Nebulizer",
    "وحدة تحكم بكاميرات الميكروسكوب": "Microscope Camera Controller",
    "يد متحركة": "Articulated Holding Arm",
    "شفاط عمليات": "Surgical Suction Pump",
    "suction": "Surgical Suction Pump",
    "صورة دم": "CBC Hematology Analyzer",
    "تجلط الدم": "Coagulation Analyzer",
    "كمياء": "Clinical Chemistry Analyzer",
    "dopler": "Vascular Doppler",
    "هرمونات": "Hormone Analyzer",
    "سرير مريض اليجزا": "Eleganza Patient Bed",
    "سرير مريض عادي": "Standard Hospital Bed",
    "ثلاجة بنك الدم": "Blood Bank Refrigerator",
    "ديب فريزر": "Deep Freezer (-80C)",
    
    # Non-Medical
    "تكييف مركزى": "Central AC Units",
    "central ac units": "Central AC Units",
    "تكييفات": "Split AC Units",
    "split ac units": "Split AC Units",
    "التليفونات": "Telephone Network",
    "المراوح": "Ventilation Fans",
    "الشفاطات": "Exhaust Fans",
    "سخانات": "Water Heaters",
    "central u p s": "Central UPS Units",
    "ups": "Central UPS Units",
    "ماكينة فرم أوراق": "Paper Shredder",
    "مثبت تيار": "Voltage Stabilizer",
    "موتور مياه": "Water Pump",
    "الة تصوير": "Photocopier",
    "سنترال": "PBX Telephone Switchboard",
    "بريما سل": "PrimaCell Line Unit",
    "مولد كهرباء": "Electrical Generator",
    "فاكس": "Fax Machine",
    "المصعد": "Elevator",
    "ثلاجه": "Domestic Refrigerator",
    "كشاف طوارئ": "Emergency Lighting Unit",
    "ستارة هواء": "Air Curtain",
    "غساله": "Washing Machine",
    "tv": "Television (TV)",
    "مكواه": "Electric Iron",
    "ريسيفر": "Satellite Receiver",
    "مبرد": "Water Dispenser Cooler",
    "محول عزل كهرباء": "Isolation Transformer",
    "جندرة": "Laundry Ironer Calender",
    "مجفف": "Clothes Dryer",
    "سرير مريض": "Hospital Bed (Non-Medical)",
    "ميزان النفايات": "Waste Scale",
    "فلتر مياه": "Water Filter",
}

# ---------------------------------------------------------------------------
# UNIQUE 96 ITEMS DATASET (66 Medical + 30 Non-Medical)
# ---------------------------------------------------------------------------
CLEAN_UNIQUE_RISK_DATASET = [
    # -----------------------------------------------------------------------
    # 1. MEDICAL EQUIPMENT DATASET (Sheet: medical) - 66 Unique Items
    # -----------------------------------------------------------------------
    {
        "device_type": "IMT Microscope Lens",
        "arabic_name": "عدسة خاصة IMT بميكروسكوب",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 1.0,
    },
    {
        "device_type": "Ventilator",
        "arabic_name": "جهاز تنفس صناعي",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 3, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "Autoclave",
        "arabic_name": "اوتوكلاف تعقيم مركزي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 130.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "repair or acquisition of new device",
    },
    {
        "device_type": "Air Purification Tower",
        "arabic_name": "برج تنقية هواء",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 0.0,
    },
    {
        "device_type": "Sperm Cryopreservation Unit",
        "arabic_name": "تجميد حيوانات منوية",
        "equipment_category": "medical",
        "process_risk": 3, "patient_risk": 2, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 41.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "repair or acquisition of new device",
    },
    {
        "device_type": "Operating Table",
        "arabic_name": "ترابيزة عمليات جراحية",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 3, "equipment_count": 5, "occurrence_value": 158.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "يتم التعاقد مع مستشفي اخري للتعقيم في حال تعطل الجهاز",
    },
    {
        "device_type": "Digital Thermometer",
        "arabic_name": "ترموميتر رقمي",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 10.0,
    },
    {
        "device_type": "Air Sterilization Unit",
        "arabic_name": "تعقيم هواء",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 4, "equipment_count": 10, "occurrence_value": 12.0,
    },
    {
        "device_type": "Laser Device",
        "arabic_name": "جهاز الليزر",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 2.0,
    },
    {
        "device_type": "Anesthesia Machine",
        "arabic_name": "جهاز تخدير وتنفس",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 3, "minimum_required": 3, "equipment_count": 4, "occurrence_value": 65.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "repair or acquisition of new device",
    },
    {
        "device_type": "Water Distillation Unit",
        "arabic_name": "جهاز تقطير المياة",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 3, "equipment_count": 3, "occurrence_value": 7.0,
    },
    {
        "device_type": "Vibration Oscillator",
        "arabic_name": "جهاز ذبذبات",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 1.0,
    },
    {
        "device_type": "Defibrillator",
        "arabic_name": "جهاز صدمات كهربائي للقلب",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 3, "minimum_required": 1, "equipment_count": 2, "occurrence_value": 4.0,
    },
    {
        "device_type": "Sphygmomanometer",
        "arabic_name": "جهاز قياس ضغط الدم",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 6, "equipment_count": 10, "occurrence_value": 112.0,
    },
    {
        "device_type": "Hygrometer",
        "arabic_name": "جهاز قياس الرطوبة",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 1.0,
    },
    {
        "device_type": "Glucometer",
        "arabic_name": "جهاز قياس السكر",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 3, "occurrence_value": 9.0,
    },
    {
        "device_type": "Infant Incubator",
        "arabic_name": "حضانة أطفال",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 4, "equipment_count": 6, "occurrence_value": 37.0,
    },
    {
        "device_type": "Embryo Incubator",
        "arabic_name": "حضانة اجنة",
        "equipment_category": "medical",
        "process_risk": 3, "patient_risk": 1, "minimum_required": 21, "equipment_count": 27, "occurrence_value": 71.0,
    },
    {
        "device_type": "Liquid Nitrogen Tank (Small)",
        "arabic_name": "خزان نيتروجين صغير",
        "equipment_category": "medical",
        "process_risk": 3, "patient_risk": 1, "minimum_required": 52, "equipment_count": 73, "occurrence_value": 2.0,
    },
    {
        "device_type": "Liquid Nitrogen Tank (Large)",
        "arabic_name": "خزان نيتروجين كبير",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 7, "equipment_count": 10, "occurrence_value": 10.0,
    },
    {
        "device_type": "Electrosurgical Unit (ESU)",
        "arabic_name": "جهاز كي جراحي دياثرمي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 1, "equipment_count": 2, "occurrence_value": 54.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "repair or acquisition of new device",
    },
    {
        "device_type": "ECG Machine",
        "arabic_name": "جهاز رسم قلب ECG",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 15.0,
    },
    {
        "device_type": "RigiScan Device",
        "arabic_name": "ريجيسكان",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 19.0,
    },
    {
        "device_type": "Test Tube Warmer",
        "arabic_name": "سخان انابيب معملي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 11, "equipment_count": 11, "occurrence_value": 9.0,
    },
    {
        "device_type": "Ultrasound Machine",
        "arabic_name": "جهاز سونار وتصوير بالموجات فوق الصوتية",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 91.0,
    },
    {
        "device_type": "Ovum Aspiration Pump",
        "arabic_name": "شفاط سحب بويضات",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 4, "equipment_count": 4, "occurrence_value": 15.0,
    },
    {
        "device_type": "Heating Plate Warmer",
        "arabic_name": "طبق تسخين معملي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 16, "equipment_count": 17, "occurrence_value": 4.0,
    },
    {
        "device_type": "Centrifuge",
        "arabic_name": "جهاز طرد مركزي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 8, "equipment_count": 10, "occurrence_value": 56.0,
    },
    {
        "device_type": "Sterilization Oven (Oven 60)",
        "arabic_name": "فرن تعقيم - فرن 60",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 0.0,
    },
    {
        "device_type": "Electroejaculation Device",
        "arabic_name": "قذف كهربي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "pH Meter",
        "arabic_name": "مقياس درجة الحموضة والقلوية pH",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 3, "equipment_count": 4, "occurrence_value": 1.0,
    },
    {
        "device_type": "CO2 Analyzer",
        "arabic_name": "محلل نسبة ثاني أكسيد الكربون CO2",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 3, "equipment_count": 1, "occurrence_value": 8.0,
    },
    {
        "device_type": "Hysteroscopy Camera",
        "arabic_name": "كاميرا منظار رحمي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 15.0,
    },
    {
        "device_type": "Surgical Light",
        "arabic_name": "كشاف عمليات جراحية متحرك وثابت",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 3, "equipment_count": 4, "occurrence_value": 154.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "repair or acquisition of new device",
    },
    {
        "device_type": "Examination Light",
        "arabic_name": "كشاف فحص طبي",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 9, "equipment_count": 9, "occurrence_value": 9.0,
    },
    {
        "device_type": "Sperm Straw Sealer",
        "arabic_name": "لحام قضيبات لتجميد الحيوانات المنوية",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 2, "occurrence_value": 2.0,
    },
    {
        "device_type": "Automated Pipette",
        "arabic_name": "ماصة اوتوماتيكية Pipet",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 40, "equipment_count": 52, "occurrence_value": 93.0,
    },
    {
        "device_type": "Isoflurane Vaporizer",
        "arabic_name": "مبخر ايزو فلورين",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 4, "equipment_count": 5, "occurrence_value": 8.0,
    },
    {
        "device_type": "Sevoflurane Vaporizer",
        "arabic_name": "مبخر سيفو فلورين",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 4, "equipment_count": 8, "occurrence_value": 11.0,
    },
    {
        "device_type": "Electric Micromotor",
        "arabic_name": "محرك كهربي دقيق",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 6, "occurrence_value": 1.0,
    },
    {
        "device_type": "Air Purifier",
        "arabic_name": "جهاز تنقية هواء",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 2, "equipment_count": 6, "occurrence_value": 3.0,
    },
    {
        "device_type": "Light Source",
        "arabic_name": "مصدر ضوئي للمناظير",
        "equipment_category": "medical",
        "process_risk": 3, "patient_risk": 1, "minimum_required": 2, "equipment_count": 1, "occurrence_value": 2.0,
    },
    {
        "device_type": "Infusion Pump",
        "arabic_name": "مضخة محاليل انفيوجن",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "Anti-Vibration Table",
        "arabic_name": "منضدة ضد الاهتزاز للميكروسكوب",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 2.0,
    },
    {
        "device_type": "Laryngoscope",
        "arabic_name": "منظار حنجري",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 8.0,
    },
    {
        "device_type": "Hysteroscope",
        "arabic_name": "منظار رحمي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 1, "occurrence_value": 30.0,
    },
    {
        "device_type": "Patient Monitor",
        "arabic_name": "مونيتور مراقبة علامات حيوية",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 7, "equipment_count": 10, "occurrence_value": 64.0,
    },
    {
        "device_type": "Analytical Digital Balance",
        "arabic_name": "ميزان حساس رقمي معملي",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 2.0,
    },
    {
        "device_type": "Patient Scale",
        "arabic_name": "ميزان وزن المرضى",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 11, "equipment_count": 12, "occurrence_value": 74.0,
    },
    {
        "device_type": "Microscope",
        "arabic_name": "ميكروسكوب معملي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 20, "equipment_count": 27, "occurrence_value": 77.0,
    },
    {
        "device_type": "Incubator Integrated Microscope",
        "arabic_name": "ميكروسكوب بكاميرا داخل الحضانة",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 6, "equipment_count": 6, "occurrence_value": 3.0,
    },
    {
        "device_type": "Surgical Microscope",
        "arabic_name": "ميكروسكوب جراحي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 84.0,
    },
    {
        "device_type": "ICSI Micromanipulator Microscope",
        "arabic_name": "ميكروسكوب حقن مجهري",
        "equipment_category": "medical",
        "process_risk": 3, "patient_risk": 1, "minimum_required": 8, "equipment_count": 10, "occurrence_value": 25.0,
    },
    {
        "device_type": "Nebulizer",
        "arabic_name": "جهاز نيبوليزر للاستنشاق",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 1.0,
    },
    {
        "device_type": "Microscope Camera Controller",
        "arabic_name": "وحدة تحكم بكاميرات الميكروسكوب",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "Articulated Holding Arm",
        "arabic_name": "يد متحركة لحمل الأجهزة",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 8, "equipment_count": 11, "occurrence_value": 8.0,
    },
    {
        "device_type": "Surgical Suction Pump",
        "arabic_name": "شفاط عمليات جراحي",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 8.0,
    },
    {
        "device_type": "CBC Hematology Analyzer",
        "arabic_name": "جهاز صورة دم كاملة CBC",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 9.0,
    },
    {
        "device_type": "Coagulation Analyzer",
        "arabic_name": "جهاز اختبارات تجلط الدم",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 1, "minimum_required": 1, "equipment_count": 3, "occurrence_value": 2.0,
    },
    {
        "device_type": "Clinical Chemistry Analyzer",
        "arabic_name": "جهاز كيمياء الدم الإكلينيكي",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 1, "equipment_count": 2, "occurrence_value": 3.0,
    },
    {
        "device_type": "Vascular Doppler",
        "arabic_name": "جهاز دوبلر أوعية دموية",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "Hormone Analyzer",
        "arabic_name": "جهاز تحليل الهرمونات",
        "equipment_category": "medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 3.0,
    },
    {
        "device_type": "Eleganza Patient Bed",
        "arabic_name": "سرير مريض كهربائي اليجزا",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 8, "occurrence_value": 2.0,
    },
    {
        "device_type": "Standard Hospital Bed",
        "arabic_name": "سرير مريض طبي عادي",
        "equipment_category": "medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 19, "occurrence_value": 5.0,
    },
    {
        "device_type": "Blood Bank Refrigerator",
        "arabic_name": "ثلاجة حفظ دم بنك الدم",
        "equipment_category": "medical",
        "process_risk": 3, "patient_risk": 2, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 1.0,
    },
    {
        "device_type": "Deep Freezer (-80C)",
        "arabic_name": "ديب فريزر تجميد عميق معملي",
        "equipment_category": "medical",
        "process_risk": 3, "patient_risk": 1, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 2.0,
    },

    # -----------------------------------------------------------------------
    # 2. NON-MEDICAL EQUIPMENT DATASET (Sheet: non medical) - 30 Unique Items
    # -----------------------------------------------------------------------
    {
        "device_type": "Central AC Units",
        "arabic_name": "تكييف مركزي بالمستشفى",
        "equipment_category": "non_medical",
        "process_risk": 3, "patient_risk": 1, "minimum_required": 3, "equipment_count": 3, "occurrence_value": 9.0,
    },
    {
        "device_type": "Split AC Units",
        "arabic_name": "وحدات تكييف سبليت",
        "equipment_category": "non_medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 174, "equipment_count": 176, "occurrence_value": 1477.0,
    },
    {
        "device_type": "Telephone Network",
        "arabic_name": "شبكة التليفونات الداخلية",
        "equipment_category": "non_medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 153, "equipment_count": 153, "occurrence_value": 889.0,
    },
    {
        "device_type": "Ventilation Fans",
        "arabic_name": "مراوح تهوية",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 20, "equipment_count": 20, "occurrence_value": 44.0,
    },
    {
        "device_type": "Exhaust Fans",
        "arabic_name": "شفاطات تهوية",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 130, "equipment_count": 130, "occurrence_value": 185.0,
    },
    {
        "device_type": "Water Heaters",
        "arabic_name": "سخانات مياه",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 31, "equipment_count": 31, "occurrence_value": 44.0,
    },
    {
        "device_type": "Central UPS Units",
        "arabic_name": "وحدات عدم انقطاع التيار المركزية Central UPS",
        "equipment_category": "non_medical",
        "process_risk": 3, "patient_risk": 3, "minimum_required": 21, "equipment_count": 21, "occurrence_value": 30.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "notify all concrned departments & minimization of the load & repair or acquisition of new device",
    },
    {
        "device_type": "Paper Shredder",
        "arabic_name": "ماكينة فرم أوراق ومستندات",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "Voltage Stabilizer",
        "arabic_name": "مثبت تيار كهربائي",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 6, "equipment_count": 6, "occurrence_value": 0.0,
    },
    {
        "device_type": "Water Pump",
        "arabic_name": "موتور وطلمبة مياه",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 10, "equipment_count": 10, "occurrence_value": 12.0,
    },
    {
        "device_type": "Photocopier",
        "arabic_name": "ماكينة تصوير مستندات",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 3, "equipment_count": 3, "occurrence_value": 25.0,
    },
    {
        "device_type": "PBX Telephone Switchboard",
        "arabic_name": "سنترال المستشفى الرئيسي",
        "equipment_category": "non_medical",
        "process_risk": 3, "patient_risk": 3, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 4.0,
        "preventive_action": "Increase preventive maintenace rate",
        "corrective_action": "notify all concrned departments & repair or acquisition of new device",
    },
    {
        "device_type": "PrimaCell Line Unit",
        "arabic_name": "وحدة خطوط بريما سل",
        "equipment_category": "non_medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "Electrical Generator",
        "arabic_name": "مولد كهرباء طوارئ",
        "equipment_category": "non_medical",
        "process_risk": 3, "patient_risk": 3, "minimum_required": 2, "equipment_count": 2, "occurrence_value": 8.0,
        "preventive_action": "Increase preventive maintenace rate",
        "corrective_action": "notify all concrned departments & minimization of the load & repair or acquisition of new device",
    },
    {
        "device_type": "Fax Machine",
        "arabic_name": "جهاز فاكس",
        "equipment_category": "non_medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 5.0,
    },
    {
        "device_type": "Elevator",
        "arabic_name": "مصعد المستشفى",
        "equipment_category": "non_medical",
        "process_risk": 2, "patient_risk": 2, "minimum_required": 2, "equipment_count": 3, "occurrence_value": 152.0,
        "preventive_action": "availability of spare device & Increase preventive maintenace rate",
        "corrective_action": "notify all concrned departments & repair or acquisition of new device",
    },
    {
        "device_type": "Domestic Refrigerator",
        "arabic_name": "ثلاجة عادية بالأقسام",
        "equipment_category": "non_medical",
        "process_risk": 3, "patient_risk": 1, "minimum_required": 61, "equipment_count": 61, "occurrence_value": 166.0,
    },
    {
        "device_type": "Emergency Lighting Unit",
        "arabic_name": "كشاف طوارئ شحن",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 10, "equipment_count": 10, "occurrence_value": 4.0,
    },
    {
        "device_type": "Air Curtain",
        "arabic_name": "ستارة هواء للأبواب",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 5, "equipment_count": 5, "occurrence_value": 3.0,
    },
    {
        "device_type": "Washing Machine",
        "arabic_name": "غسالة ملابس بالمغسلة",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 3, "equipment_count": 3, "occurrence_value": 35.0,
    },
    {
        "device_type": "Television (TV)",
        "arabic_name": "تلفزيون وشاشات غرف المرضى",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 47, "equipment_count": 47, "occurrence_value": 103.0,
    },
    {
        "device_type": "Electric Iron",
        "arabic_name": "مكواة ملابس",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 3, "equipment_count": 3, "occurrence_value": 8.0,
    },
    {
        "device_type": "Satellite Receiver",
        "arabic_name": "ريسيفر استقبال قنوات",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 12, "equipment_count": 12, "occurrence_value": 7.0,
    },
    {
        "device_type": "Water Dispenser Cooler",
        "arabic_name": "مبرد وموزع مياه",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 4, "equipment_count": 4, "occurrence_value": 11.0,
    },
    {
        "device_type": "Isolation Transformer",
        "arabic_name": "محول عزل كهربائي",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 0.0,
    },
    {
        "device_type": "Laundry Ironer Calender",
        "arabic_name": "جندرة كي ملابس بالمغسلة",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 10.0,
    },
    {
        "device_type": "Clothes Dryer",
        "arabic_name": "مجفف ملابس بالمغسلة",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 16.0,
    },
    {
        "device_type": "Hospital Bed (Non-Medical)",
        "arabic_name": "سرير مريض غير طبي",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 19, "equipment_count": 19, "occurrence_value": 3.0,
    },
    {
        "device_type": "Waste Scale",
        "arabic_name": "ميزان وزن النفايات الطبية",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 1, "minimum_required": 1, "equipment_count": 1, "occurrence_value": 1.0,
    },
    {
        "device_type": "Water Filter",
        "arabic_name": "فلتر تنقية مياه",
        "equipment_category": "non_medical",
        "process_risk": 1, "patient_risk": 2, "minimum_required": 4, "equipment_count": 4, "occurrence_value": 4.0,
    },
]


async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    print(f"Connecting to database to seed clean unique dataset ({len(CLEAN_UNIQUE_RISK_DATASET)} items)...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        # 1. Update any physical devices in DB that have Arabic device_type to English
        devices_res = await session.execute(select(Device))
        all_devices = devices_res.scalars().all()
        dev_updated = 0
        for dev in all_devices:
            raw_type = (dev.device_type or "").strip().lower()
            if raw_type in ARABIC_TO_ENGLISH_MAP:
                canon_english = ARABIC_TO_ENGLISH_MAP[raw_type]
                if dev.device_type != canon_english:
                    dev.device_type = canon_english
                    dev_updated += 1
        print(f"Standardized {dev_updated} physical device records to canonical English device types.")

        # 2. Clean out old / duplicate configs and re-insert 96 canonical unique records
        await session.execute(delete(EquipmentRiskConfig))

        inserted = 0
        for rule_data in CLEAN_UNIQUE_RISK_DATASET:
            dev_type = rule_data["device_type"]
            calc = calculate_excel_risk(
                equipment_category=rule_data["equipment_category"],
                process_risk=rule_data["process_risk"],
                patient_risk=rule_data["patient_risk"],
                occurrence_value=rule_data["occurrence_value"],
                equipment_count=rule_data["equipment_count"],
            )

            config = EquipmentRiskConfig(
                device_type=dev_type,
                arabic_name=rule_data["arabic_name"],
                equipment_category=rule_data["equipment_category"],
                process_risk=rule_data["process_risk"],
                patient_risk=rule_data["patient_risk"],
                minimum_required=rule_data["minimum_required"],
                equipment_count=rule_data["equipment_count"],
                occurrence_value=rule_data["occurrence_value"],
                probability_occurrence=calc["probability_occurrence"],
                normalized_probability=calc["normalized_probability"],
                equipment_risk=calc["equipment_risk"],
                risk_percentage=calc["risk_percentage"],
                risk_class=calc["risk_class"],
                preventive_action=rule_data.get("preventive_action"),
                corrective_action=rule_data.get("corrective_action"),
            )
            session.add(config)
            inserted += 1

        await session.commit()
        print(f"[OK] Seeded 100% clean unique dataset! Total items: {inserted} (66 Medical, 30 Non-Medical).")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
