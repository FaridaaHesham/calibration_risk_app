import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import ToleranceRule

RULES = [
    # Ultrasound / imaging - 10% of reference
    {"test_label": "Axial Resolution Test",            "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Ultrasound axial resolution"},
    {"test_label": "Lateral Resolution Test",          "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Ultrasound lateral resolution"},
    {"test_label": "Near Axial Resolution Test",       "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Near-field axial resolution"},
    {"test_label": "Near Lateral Resolution Test",     "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Near-field lateral resolution"},
    {"test_label": "Far Axial Resolution Test",        "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Far-field axial resolution"},
    {"test_label": "Far Lateral Resolution Test",      "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Far-field lateral resolution"},
    {"test_label": "Horizontal Distance Test",         "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Ultrasound distance measurement"},
    {"test_label": "Vertical Distance Test",           "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mm",   "notes": "Ultrasound distance measurement"},
    # Patient monitor - heart rate 10%
    {"test_label": "Heart Rate NSR Test",              "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": "Normal sinus rhythm"},
    {"test_label": "Heart Rate Bradycardia Test",      "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": ""},
    {"test_label": "Heart Rate Tachycardia Test",      "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": ""},
    {"test_label": "Heart Rate Hypertensive Test",     "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": ""},
    {"test_label": "Heart Rate Hypotensive Test",      "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": ""},
    {"test_label": "ECG Heart Rate Accuracy Test",     "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": "ECG-derived heart rate"},
    # SpO2 10%
    {"test_label": "SPO2 NSR Test",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "%",    "notes": ""},
    {"test_label": "SPO2 Bradycardia Test",            "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "%",    "notes": ""},
    {"test_label": "SPO2 Tachycardia Test",            "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "%",    "notes": ""},
    {"test_label": "SPO2 Hypertensive Test",           "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "%",    "notes": ""},
    {"test_label": "SPO2 Hypotensive Test",            "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "%",    "notes": ""},
    # Pressure - absolute +/-3 mmHg
    {"test_label": "Pressure Accuracy Test",           "tolerance_type": "absolute",   "tolerance_value": 3.0,  "unit": "mmHg", "notes": "NIBP / infusion pump pressure"},
    {"test_label": "Occlusion Pressure Test",          "tolerance_type": "absolute",   "tolerance_value": 3.0,  "unit": "mmHg", "notes": "Occlusion alarm pressure"},
    # Temperature - 5% (absolute ~1 degC based on data)
    {"test_label": "Temperature Accuracy Test",        "tolerance_type": "percentage", "tolerance_value": 5.0,  "unit": "degC", "notes": ""},
    {"test_label": "Temperature Test at Speed 2 & Time 6",  "tolerance_type": "percentage", "tolerance_value": 5.0,  "unit": "degC", "notes": "Centrifuge temp speed 2"},
    {"test_label": "Temperature Test at Speed 6 & Time 26", "tolerance_type": "percentage", "tolerance_value": 5.0,  "unit": "degC", "notes": "Centrifuge temp speed 6"},
    # Weight / volume / flow - 5%
    {"test_label": "Weight Accuracy Test",             "tolerance_type": "percentage", "tolerance_value": 5.0,  "unit": "Kg",   "notes": ""},
    {"test_label": "Volume Accuracy Test",             "tolerance_type": "percentage", "tolerance_value": 5.0,  "unit": "uL",   "notes": "Micropipette / dispensing volume"},
    {"test_label": "Flow Rate Accuracy Test",          "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mL/h", "notes": "Infusion pump flow rate"},
    # Gas / O2 analyser - 15%
    {"test_label": "Gas Percentage Test",              "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "%",    "notes": "Gas analyser O2/CO2 concentration"},
    # Air velocity - 10%
    {"test_label": "Air Velocity Accuracy Test",       "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "m/s",  "notes": "Laminar flow cabinet air velocity"},
    # Centrifuge speed - 10%
    {"test_label": "Rotational Speed Accuracy Test",   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "rpm",  "notes": "Centrifuge RPM"},
    # Electrosurgery - 15%
    {"test_label": "MonoPolar Cut power",              "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "MonoPolar COAG Stand",             "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "MonoPolar COAG Spray",             "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "MonoPolar Blend power",            "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "BiPolar",                          "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "monopolar cut1",                   "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "monopolar cut2",                   "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "monopolar coag1",                  "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "monopolar coag2",                  "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "W",    "notes": ""},
    {"test_label": "Output Energy Test",               "tolerance_type": "percentage", "tolerance_value": 15.0, "unit": "J",    "notes": "Defibrillator output energy"},
    # Defibrillator current/voltage - 10%
    {"test_label": "Green Range Current Test",         "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "A",    "notes": ""},
    {"test_label": "Green Range Voltage Test",         "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "V",    "notes": ""},
    {"test_label": "Red Range Current Test",           "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "A",    "notes": ""},
    {"test_label": "Red Range Voltage Test",           "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "V",    "notes": ""},
    # Ventilator - 10%
    {"test_label": "VT at measure2",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mL",   "notes": "Tidal volume at measure point 2"},
    {"test_label": "VT at measure3",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "mL",   "notes": "Tidal volume at measure point 3"},
    {"test_label": "RR at measure2",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": "Respiratory rate at measure point 2"},
    {"test_label": "RR at measure3",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "BPM",  "notes": "Respiratory rate at measure point 3"},
    {"test_label": "Ti at measure2",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "s",    "notes": "Inspiratory time at measure point 2"},
    {"test_label": "Ti at measure3",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "s",    "notes": "Inspiratory time at measure point 3"},
    {"test_label": "Te at measure2",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "s",    "notes": "Expiratory time at measure point 2"},
    {"test_label": "Te at measure3",                   "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": "s",    "notes": "Expiratory time at measure point 3"},
    {"test_label": "I:E at measure2",                  "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": ":",    "notes": "I:E ratio at measure point 2"},
    {"test_label": "I:E at measure3",                  "tolerance_type": "percentage", "tolerance_value": 10.0, "unit": ":",    "notes": "I:E ratio at measure point 3"},
]

async def main():
    async with AsyncSessionLocal() as db:
        for rule_data in RULES:
            existing = await db.execute(
                select(ToleranceRule).where(ToleranceRule.test_label == rule_data["test_label"])
            )
            if existing.scalar_one_or_none():
                print(f"Skip (exists): {rule_data['test_label']}")
                continue
            db.add(ToleranceRule(**rule_data))
            print(f"Inserting: {rule_data['test_label']}")
        await db.commit()
    print("Done.")

asyncio.run(main())
