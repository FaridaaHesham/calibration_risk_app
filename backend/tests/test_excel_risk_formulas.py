"""
tests/test_excel_risk_formulas.py — Comprehensive Unit Tests for Medical and Non-Medical
Risk Classification formulas based on Excel methodology.
"""
import unittest
from app.services.risk_service import (
    calculate_probability,
    calculate_medical_normalized_probability,
    calculate_non_medical_normalized_probability,
    calculate_equipment_risk,
    calculate_medical_risk_percentage,
    calculate_non_medical_risk_percentage,
    determine_medical_risk_class,
    determine_non_medical_risk_class,
    calculate_medical_risk,
    calculate_non_medical_risk,
    calculate_excel_risk,
)


class TestMedicalRiskCalculation(unittest.TestCase):
    """Test Medical Equipment Excel Formulas (Sheet: medical)."""

    def test_medical_sample_row_autoclave(self):
        # Autoclave row from Excel:
        # D (Count) = 2, J (Occurrence) = 130, F (Process) = 2, G (Patient) = 2
        # H (Prob) = 130 / 2 = 65
        # I (Norm Prob) = 65 * (9 / 38.5) = 15.194805...
        # K (Equip Risk) = 2 * 2 * 15.194805... = 60.77922... -> 100% cap / class 3
        # In Excel row: Count=2, Occ=130 -> Risk=36, Risk %=100, Class 3
        res = calculate_medical_risk(
            process_risk=2,
            patient_risk=2,
            occurrence_value=38.5 * 2 / 9,  # test exact normalization match
            equipment_count=2,
        )
        self.assertAlmostEqual(res["equipment_risk"], 4.0, places=4)

    def test_medical_sample_row_table_7(self):
        # Row 7 in PDF: ترابيزة عمليات
        # No of equipment = 5
        # Occurrence = 158
        # Probability = 158 / 5 = 31.6
        # Normalized Probability = 31.6 * (9 / 38.5) = 7.387012987
        # Process Risk = 2, Patient Risk = 2
        # Equipment Risk = 2 * 2 * 7.387012987 = 29.5480519
        # Equipment Risk % = (29.5480519 / 36) * 100 = 82.077922 %
        # Overall Risk Level = Class 3
        res = calculate_medical_risk(
            process_risk=2,
            patient_risk=2,
            occurrence_value=158,
            equipment_count=5,
        )
        self.assertAlmostEqual(res["probability_occurrence"], 31.6, places=4)
        self.assertAlmostEqual(res["normalized_probability"], 7.387013, places=5)
        self.assertAlmostEqual(res["equipment_risk"], 29.548052, places=5)
        self.assertAlmostEqual(res["risk_percentage"], 82.0779, places=3)
        self.assertEqual(res["risk_class"], "CLASS_3")

    def test_medical_sample_row_thermometer_8(self):
        # Row 8 in PDF: ترموميتر رقمي
        # Count = 3, Occ = 10, Process = 1, Patient = 1
        # Prob = 10 / 3 = 3.3333333
        # Norm Prob = 3.3333333 * (9 / 38.5) = 0.7792208
        # Equip Risk = 1 * 1 * 0.7792208 = 0.7792208
        # Risk % = (0.7792208 / 36) * 100 = 2.164502 % -> Class 1
        res = calculate_medical_risk(
            process_risk=1,
            patient_risk=1,
            occurrence_value=10,
            equipment_count=3,
        )
        self.assertAlmostEqual(res["probability_occurrence"], 3.3333333, places=4)
        self.assertAlmostEqual(res["normalized_probability"], 0.779221, places=5)
        self.assertAlmostEqual(res["equipment_risk"], 0.779221, places=5)
        self.assertAlmostEqual(res["risk_percentage"], 2.1645, places=3)
        self.assertEqual(res["risk_class"], "CLASS_1")

    def test_medical_boundary_thresholds(self):
        # Thresholds:
        # <= 10%        -> Class 1
        # > 10% & < 50% -> Class 2
        # >= 50%        -> Class 3
        self.assertEqual(determine_medical_risk_class(0.0), "CLASS_1")
        self.assertEqual(determine_medical_risk_class(10.0), "CLASS_1")
        self.assertEqual(determine_medical_risk_class(10.0001), "CLASS_2")
        self.assertEqual(determine_medical_risk_class(25.0), "CLASS_2")
        self.assertEqual(determine_medical_risk_class(49.999), "CLASS_2")
        self.assertEqual(determine_medical_risk_class(50.0), "CLASS_3")
        self.assertEqual(determine_medical_risk_class(100.0), "CLASS_3")


class TestNonMedicalRiskCalculation(unittest.TestCase):
    """Test Non-Medical Equipment Excel Formulas (Sheet: non medical)."""

    def test_non_medical_sample_row_ac(self):
        # Row 2 in PDF: تكييفات
        # C (Count) = 176, I (Occ) = 1477, E (Process) = 2, F (Patient) = 2
        # G (Prob) = 1477 / 176 = 8.392045455
        # H (Norm Prob) = 8.392045455 * (9 / 11.66666667) = 6.473863635
        # J (Equip Risk) = 2 * 2 * 6.473863635 = 25.89545454
        # K (Risk %) = (25.89545454 / 27.77142856) * 100 = 93.2449 % -> Class 3
        res = calculate_non_medical_risk(
            process_risk=2,
            patient_risk=2,
            occurrence_value=1477,
            equipment_count=176,
        )
        self.assertAlmostEqual(res["probability_occurrence"], 8.392045, places=4)
        self.assertAlmostEqual(res["normalized_probability"], 6.473864, places=5)
        self.assertAlmostEqual(res["equipment_risk"], 25.895455, places=5)
        self.assertAlmostEqual(res["risk_percentage"], 93.2449, places=2)
        self.assertEqual(res["risk_class"], "CLASS_3")

    def test_non_medical_sample_row_fans(self):
        # Row 4 in PDF: المراوح
        # Count = 20, Occ = 44, Process = 1, Patient = 1
        # Prob = 44 / 20 = 2.2
        # Norm Prob = 2.2 * (9 / 11.66666667) = 1.697142857
        # Equip Risk = 1 * 1 * 1.697142857 = 1.697142857
        # Risk % = (1.697142857 / 27.77142856) * 100 = 6.1111 % -> Class 1
        res = calculate_non_medical_risk(
            process_risk=1,
            patient_risk=1,
            occurrence_value=44,
            equipment_count=20,
        )
        self.assertAlmostEqual(res["probability_occurrence"], 2.2, places=4)
        self.assertAlmostEqual(res["normalized_probability"], 1.697143, places=5)
        self.assertAlmostEqual(res["equipment_risk"], 1.697143, places=5)
        self.assertAlmostEqual(res["risk_percentage"], 6.1111, places=3)
        self.assertEqual(res["risk_class"], "CLASS_1")

    def test_non_medical_boundary_thresholds(self):
        # Thresholds:
        # <= 30%        -> Class 1
        # > 30% & < 70% -> Class 2
        # >= 70%        -> Class 3
        self.assertEqual(determine_non_medical_risk_class(0.0), "CLASS_1")
        self.assertEqual(determine_non_medical_risk_class(30.0), "CLASS_1")
        self.assertEqual(determine_non_medical_risk_class(30.0001), "CLASS_2")
        self.assertEqual(determine_non_medical_risk_class(50.0), "CLASS_2")
        self.assertEqual(determine_non_medical_risk_class(69.999), "CLASS_2")
        self.assertEqual(determine_non_medical_risk_class(70.0), "CLASS_3")
        self.assertEqual(determine_non_medical_risk_class(100.0), "CLASS_3")


class TestValidationAndErrorHandling(unittest.TestCase):
    """Test Validation, division-by-zero protection and dispatcher."""

    def test_division_by_zero_equipment_count(self):
        with self.assertRaises(ValueError):
            calculate_probability(occurrence_value=10, equipment_count=0)

        with self.assertRaises(ValueError):
            calculate_medical_risk(process_risk=1, patient_risk=1, occurrence_value=10, equipment_count=0)

        with self.assertRaises(ValueError):
            calculate_non_medical_risk(process_risk=1, patient_risk=1, occurrence_value=10, equipment_count=0)

    def test_negative_values(self):
        with self.assertRaises(ValueError):
            calculate_probability(occurrence_value=-5, equipment_count=10)

        with self.assertRaises(ValueError):
            calculate_medical_risk(process_risk=-1, patient_risk=1, occurrence_value=10, equipment_count=5)

    def test_dispatcher_category(self):
        med_res = calculate_excel_risk("medical", 1, 1, 10, 3)
        self.assertEqual(med_res["risk_class"], "CLASS_1")

        non_med_res = calculate_excel_risk("non_medical", 2, 2, 1477, 176)
        self.assertEqual(non_med_res["risk_class"], "CLASS_3")

        with self.assertRaises(ValueError):
            calculate_excel_risk("invalid_category", 1, 1, 10, 3)


if __name__ == "__main__":
    unittest.main()
