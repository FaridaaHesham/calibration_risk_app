// src/data/mockData.js
// ============================================================
// TODO: This file is the single source of truth for ALL mock data
//       used during the UI mockup phase. When the real backend is
//       connected, remove this file and use the API layer instead.
// ============================================================

export const DEPARTMENTS = [
  'Andrology Lab',
  'Blood Lab',
  'Clinics',
  'Inpatient',
  'IVF',
  'OR',
  'Recovery',
  'Sterilization',
  'Incubation',
  'Storage',
  'Nurse Station',
  'Pathology Lab',
  'Waste',
];

// Keyed by UPPERCASE serial number for case-insensitive lookup
export const MOCK_DEVICES = {
  'SN-AND-001': {
    serialNumber: 'SN-AND-001',
    department: 'Andrology Lab',
    deviceType: 'Semen Analyzer',
    model: 'CASA-5000',
    manufacturer: 'Makler Scientific',
  },
  'SN-BLD-007': {
    serialNumber: 'SN-BLD-007',
    department: 'Blood Lab',
    deviceType: 'Hematology Analyzer',
    model: 'CBC-5000',
    manufacturer: 'Sysmex',
  },
  'SN-IVF-012': {
    serialNumber: 'SN-IVF-012',
    department: 'IVF',
    deviceType: 'CO2 Incubator',
    model: 'Galaxy 48R',
    manufacturer: 'New Brunswick Scientific',
  },
  'SN-PATH-003': {
    serialNumber: 'SN-PATH-003',
    department: 'Pathology Lab',
    deviceType: 'Centrifuge',
    model: 'Eppendorf 5810R',
    manufacturer: 'Eppendorf',
  },
  'SN-OR-015': {
    serialNumber: 'SN-OR-015',
    department: 'OR',
    deviceType: 'Autoclave',
    model: 'Tuttnauer 2540EK',
    manufacturer: 'Tuttnauer',
  },
};

// ─── Control chart data (one primary measurement per year per device) ────────
// TODO: Replace with real statistical output from backend.
export const MOCK_CHART_DATA = {
  'SN-AND-001': {
    points: [
      { year: '2011', value: 37.2, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2012', value: 37.8, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2013', value: 36.9, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2014', value: 38.1, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2015', value: 37.4, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2016', value: 37.7, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2017', value: 38.5, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2018', value: 36.8, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2019', value: 37.3, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2020', value: 37.6, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2021', value: 38.0, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2022', value: 37.1, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2023', value: 37.9, mean: 37.5, ucl: 39.9, lcl: 35.1 },
      { year: '2024', value: 37.5, mean: 37.5, ucl: 39.9, lcl: 35.1 },
    ],
    // TODO: Replace this hardcoded recommendation with the real
    //       statistical stability calculation from the backend.
    recommendation: {
      stability: 'stable',
      label: 'Stable',
      nextDate: '2026-08-01',
      intervalYears: 2,
      message: 'Device is within control limits. Next calibration recommended in 2 years.',
    },
  },
  'SN-BLD-007': {
    points: [
      { year: '2012', value: 5.1, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2013', value: 4.8, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2014', value: 5.3, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2015', value: 4.6, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2016', value: 5.7, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2017', value: 5.9, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2018', value: 5.2, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2019', value: 4.9, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2020', value: 5.4, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2021', value: 5.6, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2022', value: 4.7, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2023', value: 5.8, mean: 5.0, ucl: 5.8, lcl: 4.2 },
      { year: '2024', value: 5.5, mean: 5.0, ucl: 5.8, lcl: 4.2 },
    ],
    recommendation: {
      stability: 'marginal',
      label: 'Marginal',
      nextDate: '2025-08-01',
      intervalYears: 1,
      message: 'One or more measurements near control limits. Annual calibration advised.',
    },
  },
  'SN-IVF-012': {
    points: [
      { year: '2013', value: 37.05, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2014', value: 36.95, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2015', value: 37.15, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2016', value: 36.85, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2017', value: 37.20, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2018', value: 37.35, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2019', value: 36.70, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2020', value: 36.60, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2021', value: 37.10, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2022', value: 36.80, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2023', value: 37.40, mean: 37.0, ucl: 37.3, lcl: 36.7 },
      { year: '2024', value: 37.00, mean: 37.0, ucl: 37.3, lcl: 36.7 },
    ],
    recommendation: {
      stability: 'unstable',
      label: 'Unstable',
      nextDate: '2025-02-01',
      intervalYears: 1,
      message: 'Multiple out-of-control points detected. Immediate annual calibration required.',
    },
  },
  'SN-PATH-003': {
    points: [
      { year: '2010', value: 3000, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2011', value: 2980, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2012', value: 3050, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2013', value: 2990, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2014', value: 3010, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2015', value: 3080, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2016', value: 2950, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2017', value: 3070, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2018', value: 3020, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2019', value: 2970, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2020', value: 3040, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2021', value: 3000, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2022', value: 3060, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2023', value: 2990, mean: 3000, ucl: 3200, lcl: 2800 },
      { year: '2024', value: 3010, mean: 3000, ucl: 3200, lcl: 2800 },
    ],
    recommendation: {
      stability: 'stable',
      label: 'Stable',
      nextDate: '2027-01-01',
      intervalYears: 2,
      message: 'Device is within control limits. Next calibration recommended in 2 years.',
    },
  },
  'SN-OR-015': {
    points: [
      { year: '2014', value: 134.5, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2015', value: 133.8, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2016', value: 134.2, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2017', value: 134.0, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2018', value: 133.5, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2019', value: 135.1, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2020', value: 134.8, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2021', value: 133.9, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2022', value: 134.3, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2023', value: 134.1, mean: 134.0, ucl: 135.5, lcl: 132.5 },
      { year: '2024', value: 134.6, mean: 134.0, ucl: 135.5, lcl: 132.5 },
    ],
    recommendation: {
      stability: 'stable',
      label: 'Stable',
      nextDate: '2026-06-01',
      intervalYears: 2,
      message: 'Device is within control limits. Next calibration recommended in 2 years.',
    },
  },
};

// ─── Calibration history — year-grouped, multiple tests per session ──────────
// Each entry represents one calibration SESSION (typically annual).
// Each session contains one or more TEST records, matching the real DB structure.
// TODO: Replace with real DB records from the calibration_records table.
export const MOCK_CALIBRATION_HISTORY = {
  'SN-AND-001': [
    {
      year: '2024', calibrationDate: '2024-08-15',
      technician: 'Ahmed Khalil', equipment: 'NIST Ref. Standard Set A-2024', certificateNo: 'CAL-2024-AND-001', notes: '',
      tests: [
        { testLabel: 'Motility Analysis',     unit: '%',    referenceValue: 37.5, actualValue: 37.5, deviation:  0.0, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',   unit: 'M/mL', referenceValue: 20.0, actualValue: 20.2, deviation:  0.2, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Progressive Motility',  unit: '%',    referenceValue: 32.0, actualValue: 31.8, deviation: -0.2, tolerance: '±0.8', result: 'Pass' },
      ],
    },
    {
      year: '2023', calibrationDate: '2023-07-22',
      technician: 'Ahmed Khalil', equipment: 'NIST Ref. Standard Set A-2023', certificateNo: 'CAL-2023-AND-001', notes: '',
      tests: [
        { testLabel: 'Motility Analysis',     unit: '%',    referenceValue: 37.5, actualValue: 37.9, deviation:  0.4, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',   unit: 'M/mL', referenceValue: 20.0, actualValue: 20.5, deviation:  0.5, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Progressive Motility',  unit: '%',    referenceValue: 32.0, actualValue: 31.5, deviation: -0.5, tolerance: '±0.8', result: 'Pass' },
        { testLabel: 'Morphology Assessment', unit: '%',    referenceValue: 4.0,  actualValue: 3.9,  deviation: -0.1, tolerance: '±0.5', result: 'Pass' },
      ],
    },
    {
      year: '2022', calibrationDate: '2022-09-10',
      technician: 'Sara Nour', equipment: 'NIST Ref. Standard Set B-2022', certificateNo: 'CAL-2022-AND-001', notes: '',
      tests: [
        { testLabel: 'Motility Analysis',     unit: '%',    referenceValue: 37.5, actualValue: 37.1, deviation: -0.4, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',   unit: 'M/mL', referenceValue: 20.0, actualValue: 19.7, deviation: -0.3, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Progressive Motility',  unit: '%',    referenceValue: 32.0, actualValue: 32.3, deviation:  0.3, tolerance: '±0.8', result: 'Pass' },
      ],
    },
    {
      year: '2021', calibrationDate: '2021-08-05',
      technician: 'Sara Nour', equipment: 'NIST Ref. Standard Set B-2021', certificateNo: 'CAL-2021-AND-001', notes: '',
      tests: [
        { testLabel: 'Motility Analysis',    unit: '%',    referenceValue: 37.5, actualValue: 38.0, deviation:  0.5, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',  unit: 'M/mL', referenceValue: 20.0, actualValue: 20.1, deviation:  0.1, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Progressive Motility', unit: '%',    referenceValue: 32.0, actualValue: 31.9, deviation: -0.1, tolerance: '±0.8', result: 'Pass' },
      ],
    },
    {
      year: '2020', calibrationDate: '2020-06-18',
      technician: 'Ahmed Khalil', equipment: 'NIST Ref. Standard Set A-2020', certificateNo: 'CAL-2020-AND-001', notes: 'Post-COVID restart calibration.',
      tests: [
        { testLabel: 'Motility Analysis',    unit: '%',    referenceValue: 37.5, actualValue: 37.6, deviation:  0.1, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',  unit: 'M/mL', referenceValue: 20.0, actualValue: 20.0, deviation:  0.0, tolerance: '±1.0', result: 'Pass' },
      ],
    },
    {
      year: '2019', calibrationDate: '2019-08-12',
      technician: 'Ahmed Khalil', equipment: 'NIST Ref. Standard Set A-2019', certificateNo: 'CAL-2019-AND-001', notes: '',
      tests: [
        { testLabel: 'Motility Analysis',     unit: '%',    referenceValue: 37.5, actualValue: 37.3, deviation: -0.2, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',   unit: 'M/mL', referenceValue: 20.0, actualValue: 19.8, deviation: -0.2, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Progressive Motility',  unit: '%',    referenceValue: 32.0, actualValue: 32.1, deviation:  0.1, tolerance: '±0.8', result: 'Pass' },
      ],
    },
    {
      year: '2018', calibrationDate: '2018-07-30',
      technician: 'Sara Nour', equipment: 'NIST Ref. Standard Set B-2018', certificateNo: 'CAL-2018-AND-001', notes: '',
      tests: [
        { testLabel: 'Motility Analysis',     unit: '%',    referenceValue: 37.5, actualValue: 36.8, deviation: -0.7, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',   unit: 'M/mL', referenceValue: 20.0, actualValue: 20.4, deviation:  0.4, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Progressive Motility',  unit: '%',    referenceValue: 32.0, actualValue: 31.4, deviation: -0.6, tolerance: '±0.8', result: 'Pass' },
      ],
    },
    {
      year: '2017', calibrationDate: '2017-09-05',
      technician: 'Ahmed Khalil', equipment: 'NIST Ref. Standard Set A-2017', certificateNo: 'CAL-2017-AND-001', notes: '',
      tests: [
        { testLabel: 'Motility Analysis',    unit: '%',    referenceValue: 37.5, actualValue: 38.5, deviation:  1.0, tolerance: '±1.0', result: 'Pass' },
        { testLabel: 'Concentration Count',  unit: 'M/mL', referenceValue: 20.0, actualValue: 20.6, deviation:  0.6, tolerance: '±1.0', result: 'Pass' },
      ],
    },
  ],

  'SN-BLD-007': [
    {
      year: '2024', calibrationDate: '2024-07-14',
      technician: 'Mariam Saad', equipment: 'Sysmex CAL-REF-2024', certificateNo: 'CAL-2024-BLD-007', notes: '',
      tests: [
        { testLabel: 'WBC Count Verification', unit: '10^9/L', referenceValue: 5.0,  actualValue: 5.5,  deviation:  0.5, tolerance: '±0.5', result: 'Pass' },
        { testLabel: 'RBC Count Verification', unit: '10^12/L',referenceValue: 4.5,  actualValue: 4.6,  deviation:  0.1, tolerance: '±0.2', result: 'Pass' },
        { testLabel: 'Hemoglobin Level',       unit: 'g/dL',   referenceValue: 13.5, actualValue: 13.4, deviation: -0.1, tolerance: '±0.3', result: 'Pass' },
        { testLabel: 'Platelet Count',         unit: '10^9/L', referenceValue: 250,  actualValue: 248,  deviation:  -2,  tolerance: '±15',  result: 'Pass' },
      ],
    },
    {
      year: '2023', calibrationDate: '2023-06-28',
      technician: 'Mariam Saad', equipment: 'Sysmex CAL-REF-2023', certificateNo: 'CAL-2023-BLD-007', notes: '',
      tests: [
        { testLabel: 'WBC Count Verification', unit: '10^9/L', referenceValue: 5.0,  actualValue: 5.8,  deviation:  0.8, tolerance: '±0.5', result: 'Fail' },
        { testLabel: 'RBC Count Verification', unit: '10^12/L',referenceValue: 4.5,  actualValue: 4.5,  deviation:  0.0, tolerance: '±0.2', result: 'Pass' },
        { testLabel: 'Hemoglobin Level',       unit: 'g/dL',   referenceValue: 13.5, actualValue: 13.7, deviation:  0.2, tolerance: '±0.3', result: 'Pass' },
        { testLabel: 'Platelet Count',         unit: '10^9/L', referenceValue: 250,  actualValue: 255,  deviation:   5,  tolerance: '±15',  result: 'Pass' },
      ],
    },
    {
      year: '2022', calibrationDate: '2022-08-01',
      technician: 'Khaled Abbas', equipment: 'Sysmex CAL-REF-2022', certificateNo: 'CAL-2022-BLD-007', notes: '',
      tests: [
        { testLabel: 'WBC Count Verification', unit: '10^9/L', referenceValue: 5.0, actualValue: 4.7, deviation: -0.3, tolerance: '±0.5', result: 'Pass' },
        { testLabel: 'RBC Count Verification', unit: '10^12/L',referenceValue: 4.5, actualValue: 4.4, deviation: -0.1, tolerance: '±0.2', result: 'Pass' },
        { testLabel: 'Hemoglobin Level',       unit: 'g/dL',   referenceValue: 13.5, actualValue: 13.3, deviation: -0.2, tolerance: '±0.3', result: 'Pass' },
      ],
    },
    {
      year: '2021', calibrationDate: '2021-07-19',
      technician: 'Khaled Abbas', equipment: 'Sysmex CAL-REF-2021', certificateNo: 'CAL-2021-BLD-007', notes: '',
      tests: [
        { testLabel: 'WBC Count Verification', unit: '10^9/L', referenceValue: 5.0, actualValue: 5.6, deviation: 0.6, tolerance: '±0.5', result: 'Fail' },
        { testLabel: 'RBC Count Verification', unit: '10^12/L',referenceValue: 4.5, actualValue: 4.5, deviation: 0.0, tolerance: '±0.2', result: 'Pass' },
        { testLabel: 'Platelet Count',         unit: '10^9/L', referenceValue: 250, actualValue: 244, deviation: -6,  tolerance: '±15',  result: 'Pass' },
      ],
    },
  ],

  'SN-IVF-012': [
    {
      year: '2024', calibrationDate: '2024-01-20',
      technician: 'Dr. Hana Fathi', equipment: 'Traceable Calibration Thermometer T-2024', certificateNo: 'CAL-2024-IVF-012', notes: '',
      tests: [
        { testLabel: 'Temperature Calibration',  unit: '°C', referenceValue: 37.0, actualValue: 37.00, deviation:  0.00, tolerance: '±0.3', result: 'Pass' },
        { testLabel: 'CO2 Concentration Check',  unit: '%',  referenceValue: 5.0,  actualValue: 5.05,  deviation:  0.05, tolerance: '±0.1', result: 'Pass' },
        { testLabel: 'Humidity Level Check',     unit: '%',  referenceValue: 95.0, actualValue: 94.8,  deviation: -0.2,  tolerance: '±2.0', result: 'Pass' },
      ],
    },
    {
      year: '2023', calibrationDate: '2023-02-15',
      technician: 'Dr. Hana Fathi', equipment: 'Traceable Calibration Thermometer T-2023', certificateNo: 'CAL-2023-IVF-012', notes: 'Humidity sensor replaced prior to calibration.',
      tests: [
        { testLabel: 'Temperature Calibration',  unit: '°C', referenceValue: 37.0, actualValue: 37.40, deviation:  0.40, tolerance: '±0.3', result: 'Fail' },
        { testLabel: 'CO2 Concentration Check',  unit: '%',  referenceValue: 5.0,  actualValue: 5.12,  deviation:  0.12, tolerance: '±0.1', result: 'Fail' },
        { testLabel: 'Humidity Level Check',     unit: '%',  referenceValue: 95.0, actualValue: 95.5,  deviation:  0.5,  tolerance: '±2.0', result: 'Pass' },
      ],
    },
    {
      year: '2022', calibrationDate: '2022-03-08',
      technician: 'Sara Nour', equipment: 'Traceable Calibration Thermometer T-2022', certificateNo: 'CAL-2022-IVF-012', notes: '',
      tests: [
        { testLabel: 'Temperature Calibration',  unit: '°C', referenceValue: 37.0, actualValue: 36.80, deviation: -0.20, tolerance: '±0.3', result: 'Pass' },
        { testLabel: 'CO2 Concentration Check',  unit: '%',  referenceValue: 5.0,  actualValue: 4.98,  deviation: -0.02, tolerance: '±0.1', result: 'Pass' },
        { testLabel: 'Humidity Level Check',     unit: '%',  referenceValue: 95.0, actualValue: 94.5,  deviation: -0.5,  tolerance: '±2.0', result: 'Pass' },
        { testLabel: 'Alarm Function Test',      unit: '°C', referenceValue: 38.5, actualValue: 38.5,  deviation:  0.0,  tolerance: '±0.2', result: 'Pass' },
      ],
    },
  ],

  'SN-PATH-003': [
    {
      year: '2024', calibrationDate: '2024-05-10',
      technician: 'Youssef Ibrahim', equipment: 'Eppendorf Reference Tachometer R-2024', certificateNo: 'CAL-2024-PATH-003', notes: '',
      tests: [
        { testLabel: 'RPM Accuracy Test (3000)',  unit: 'RPM', referenceValue: 3000, actualValue: 3010, deviation:  10, tolerance: '±100', result: 'Pass' },
        { testLabel: 'RPM Accuracy Test (5000)',  unit: 'RPM', referenceValue: 5000, actualValue: 4995, deviation:  -5, tolerance: '±100', result: 'Pass' },
        { testLabel: 'Timer Accuracy Test',       unit: 'sec', referenceValue: 60,   actualValue: 60,   deviation:   0, tolerance: '±1',   result: 'Pass' },
      ],
    },
    {
      year: '2023', calibrationDate: '2023-04-25',
      technician: 'Youssef Ibrahim', equipment: 'Eppendorf Reference Tachometer R-2023', certificateNo: 'CAL-2023-PATH-003', notes: '',
      tests: [
        { testLabel: 'RPM Accuracy Test (3000)',  unit: 'RPM', referenceValue: 3000, actualValue: 2990, deviation: -10, tolerance: '±100', result: 'Pass' },
        { testLabel: 'RPM Accuracy Test (5000)',  unit: 'RPM', referenceValue: 5000, actualValue: 5010, deviation:  10, tolerance: '±100', result: 'Pass' },
        { testLabel: 'Timer Accuracy Test',       unit: 'sec', referenceValue: 60,   actualValue: 61,   deviation:   1, tolerance: '±1',   result: 'Pass' },
        { testLabel: 'Temperature Check (Heated)', unit: '°C', referenceValue: 37.0, actualValue: 36.9, deviation: -0.1, tolerance: '±0.5', result: 'Pass' },
      ],
    },
    {
      year: '2022', calibrationDate: '2022-06-15',
      technician: 'Ahmed Khalil', equipment: 'Eppendorf Reference Tachometer R-2022', certificateNo: 'CAL-2022-PATH-003', notes: '',
      tests: [
        { testLabel: 'RPM Accuracy Test (3000)', unit: 'RPM', referenceValue: 3000, actualValue: 3060, deviation:  60, tolerance: '±100', result: 'Pass' },
        { testLabel: 'RPM Accuracy Test (5000)', unit: 'RPM', referenceValue: 5000, actualValue: 4980, deviation: -20, tolerance: '±100', result: 'Pass' },
        { testLabel: 'Timer Accuracy Test',      unit: 'sec', referenceValue: 60,   actualValue: 60,   deviation:   0, tolerance: '±1',   result: 'Pass' },
      ],
    },
  ],

  'SN-OR-015': [
    {
      year: '2024', calibrationDate: '2024-06-03',
      technician: 'Dr. Omar Farouk', equipment: 'Autoclave Validation Kit AV-2024', certificateNo: 'CAL-2024-OR-015', notes: '',
      tests: [
        { testLabel: 'Steam Pressure Test (134°C)',     unit: '°C',  referenceValue: 134.0, actualValue: 134.6, deviation:  0.6, tolerance: '±1.5', result: 'Pass' },
        { testLabel: 'Cycle Time Verification',         unit: 'min', referenceValue: 18.0,  actualValue: 18.2,  deviation:  0.2, tolerance: '±0.5', result: 'Pass' },
        { testLabel: 'Pressure Gauge Calibration',      unit: 'bar', referenceValue: 2.1,   actualValue: 2.1,   deviation:  0.0, tolerance: '±0.1', result: 'Pass' },
        { testLabel: 'Biological Indicator Test',       unit: '',    referenceValue: 0,     actualValue: 0,     deviation:  0,   tolerance: 'Negative', result: 'Pass' },
      ],
    },
    {
      year: '2023', calibrationDate: '2023-05-18',
      technician: 'Dr. Omar Farouk', equipment: 'Autoclave Validation Kit AV-2023', certificateNo: 'CAL-2023-OR-015', notes: '',
      tests: [
        { testLabel: 'Steam Pressure Test (134°C)', unit: '°C',  referenceValue: 134.0, actualValue: 134.1, deviation:  0.1, tolerance: '±1.5', result: 'Pass' },
        { testLabel: 'Cycle Time Verification',     unit: 'min', referenceValue: 18.0,  actualValue: 18.0,  deviation:  0.0, tolerance: '±0.5', result: 'Pass' },
        { testLabel: 'Pressure Gauge Calibration',  unit: 'bar', referenceValue: 2.1,   actualValue: 2.08,  deviation: -0.02,tolerance: '±0.1', result: 'Pass' },
        { testLabel: 'Biological Indicator Test',   unit: '',    referenceValue: 0,     actualValue: 0,     deviation:  0,   tolerance: 'Negative', result: 'Pass' },
      ],
    },
    {
      year: '2022', calibrationDate: '2022-04-20',
      technician: 'Mariam Saad', equipment: 'Autoclave Validation Kit AV-2022', certificateNo: 'CAL-2022-OR-015', notes: '',
      tests: [
        { testLabel: 'Steam Pressure Test (134°C)', unit: '°C',  referenceValue: 134.0, actualValue: 134.3, deviation:  0.3, tolerance: '±1.5', result: 'Pass' },
        { testLabel: 'Cycle Time Verification',     unit: 'min', referenceValue: 18.0,  actualValue: 18.5,  deviation:  0.5, tolerance: '±0.5', result: 'Pass' },
        { testLabel: 'Pressure Gauge Calibration',  unit: 'bar', referenceValue: 2.1,   actualValue: 2.12,  deviation:  0.02,tolerance: '±0.1', result: 'Pass' },
      ],
    },
  ],
};

export const MOCK_RISK_DATA = {
  'SN-AND-001': {
    serialNumber: 'SN-AND-001',
    riskLevel: 'Low',
    riskScore: 18,
    maxScore: 100,
    lastAssessed: '2024-11-15',
    factors: [
      { factor: 'Device Age',          score: 4, maxScore: 20, level: 'Low' },
      { factor: 'Calibration Drift',   score: 3, maxScore: 20, level: 'Low' },
      { factor: 'Usage Frequency',     score: 5, maxScore: 20, level: 'Low' },
      { factor: 'Maintenance History', score: 3, maxScore: 20, level: 'Low' },
      { factor: 'Patient Impact',      score: 3, maxScore: 20, level: 'Low' },
    ],
    recommendation: 'Continue standard calibration schedule.',
  },
  'SN-BLD-007': {
    serialNumber: 'SN-BLD-007',
    riskLevel: 'Medium',
    riskScore: 52,
    maxScore: 100,
    lastAssessed: '2024-10-03',
    factors: [
      { factor: 'Device Age',          score: 10, maxScore: 20, level: 'Medium' },
      { factor: 'Calibration Drift',   score: 14, maxScore: 20, level: 'High'   },
      { factor: 'Usage Frequency',     score: 12, maxScore: 20, level: 'Medium' },
      { factor: 'Maintenance History', score:  8, maxScore: 20, level: 'Medium' },
      { factor: 'Patient Impact',      score:  8, maxScore: 20, level: 'Medium' },
    ],
    recommendation: 'Increase calibration frequency to every 12 months.',
  },
  'SN-IVF-012': {
    serialNumber: 'SN-IVF-012',
    riskLevel: 'High',
    riskScore: 78,
    maxScore: 100,
    lastAssessed: '2024-12-01',
    factors: [
      { factor: 'Device Age',          score: 15, maxScore: 20, level: 'High' },
      { factor: 'Calibration Drift',   score: 18, maxScore: 20, level: 'High' },
      { factor: 'Usage Frequency',     score: 16, maxScore: 20, level: 'High' },
      { factor: 'Maintenance History', score: 14, maxScore: 20, level: 'High' },
      { factor: 'Patient Impact',      score: 15, maxScore: 20, level: 'High' },
    ],
    recommendation: 'Immediate inspection and calibration required. Escalate to biomedical engineering.',
  },
  'SN-PATH-003': {
    serialNumber: 'SN-PATH-003',
    riskLevel: 'Low',
    riskScore: 22,
    maxScore: 100,
    lastAssessed: '2024-09-20',
    factors: [
      { factor: 'Device Age',          score: 5, maxScore: 20, level: 'Low' },
      { factor: 'Calibration Drift',   score: 4, maxScore: 20, level: 'Low' },
      { factor: 'Usage Frequency',     score: 6, maxScore: 20, level: 'Low' },
      { factor: 'Maintenance History', score: 4, maxScore: 20, level: 'Low' },
      { factor: 'Patient Impact',      score: 3, maxScore: 20, level: 'Low' },
    ],
    recommendation: 'Continue standard calibration schedule.',
  },
  'SN-OR-015': {
    serialNumber: 'SN-OR-015',
    riskLevel: 'Medium',
    riskScore: 45,
    maxScore: 100,
    lastAssessed: '2024-11-30',
    factors: [
      { factor: 'Device Age',          score:  8, maxScore: 20, level: 'Medium' },
      { factor: 'Calibration Drift',   score:  6, maxScore: 20, level: 'Low'    },
      { factor: 'Usage Frequency',     score: 14, maxScore: 20, level: 'High'   },
      { factor: 'Maintenance History', score:  9, maxScore: 20, level: 'Medium' },
      { factor: 'Patient Impact',      score:  8, maxScore: 20, level: 'Medium' },
    ],
    recommendation: 'Monitor closely. Schedule preventive maintenance before next calibration.',
  },
};
