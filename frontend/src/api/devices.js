// src/api/devices.js
// All device, calibration, and prediction API calls.
// Talks directly to the FastAPI backend — no mock data.

import apiClient from './client';

// ─── Departments ─────────────────────────────────────────────────────────

/**
 * Fetch the real list of department names present in the devices table.
 */
export async function getDepartments() {
  const res = await apiClient.get('/api/devices/departments');
  return res.data;
}

// ─── Devices ───────────────────────────────────────────────────────────────

/**
 * Fetch device info by serial number.
 * Returns the device object or null if not found (404).
 */
export async function getDevice(serialNumber) {
  try {
    const res = await apiClient.get(`/api/devices/${encodeURIComponent(serialNumber)}`);
    // Normalise field names so existing UI components work unchanged
    const d = res.data;
    return {
      id:           d.id,
      serialNumber: d.serial_number,
      department:   d.department,
      deviceType:   d.device_type,
      model:        d.model,
      manufacturer: d.manufacturer,
    };
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Register a brand-new device.
 * @param {{ serialNumber, department, deviceType, model, manufacturer }} deviceData
 * @throws Error with a user-readable message if the serial number already exists
 */
export async function createDevice(deviceData) {
  try {
    const res = await apiClient.post('/api/devices', {
      serial_number: deviceData.serialNumber,
      department_name: deviceData.department,
      device_type: deviceData.deviceType,
      model: deviceData.model || null,
      manufacturer: deviceData.manufacturer || null,
      resolution: deviceData.resolution === '' || deviceData.resolution === undefined ? null : Number(deviceData.resolution),
    });
    const d = res.data;
    return {
      id:           d.id,
      serialNumber: d.serial_number,
      department:   d.department,
      deviceType:   d.device_type,
      model:        d.model,
      manufacturer: d.manufacturer,
      resolution:   d.resolution,
    };
  } catch (err) {
    const detail = err.response?.data?.detail;
    throw new Error(detail || 'Failed to create device. Please try again.');
  }
}

// ─── Calibrations ──────────────────────────────────────────────────────────

/**
 * Fetch calibration records (with nested test results) for a device.
 * Records are returned most-recent-first.
 * Each record has: { id, calibration_year, result, certificate_num,
 *                    accessory_*, tests: [...] }
 */
export async function getCalibrationHistory(serialNumber) {
  const res = await apiClient.get(`/api/calibrations/${encodeURIComponent(serialNumber)}`);
  return res.data;
}

/**
 * Save a new calibration session (record + test rows) for an existing device.
 * @param {{
 *   serialNumber: string,
 *   calibrationYear: number,
 *   certificateNum?: string,
 *   accessoryType?: string,
 *   accessoryModel?: string,
 *   accessorySerial?: string,
 *   tests: Array<{ testLabel, testPointUnit, referenceValue, actualValue, minValue, maxValue }>
 * }} payload
 * @throws Error with a user-readable message on failure
 */
export async function createCalibrationRecord(payload) {
  try {
    const res = await apiClient.post('/api/calibrations', {
      serial_number: payload.serialNumber,
      calibration_year: Number(payload.calibrationYear),
      certificate_num: payload.certificateNum || null,
      accessory_type: payload.accessoryType || null,
      accessory_model: payload.accessoryModel || null,
      accessory_serial: payload.accessorySerial || null,
      tests: payload.tests.map((t) => ({
        test_label: t.testLabel,
        test_point_unit: t.testPointUnit || null,
        reference_value: t.referenceValue === '' ? null : Number(t.referenceValue),
        actual_value: Number(t.actualValue),
        min_value: Number(t.minValue),
        max_value: Number(t.maxValue),
      })),
    });
    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    throw new Error(detail || 'Failed to save calibration record. Please try again.');
  }
}

/**
 * Fetch control chart data + prediction recommendation for a device.
 * Returns: { accessories: { [accessoryType]: { points: [...], recommendation: {...} } } }
 *
 * The `score` field on each point is the closeness-to-edge percentage (0–100+).
 */
export async function getChartData(serialNumber) {
  try {
    const res = await apiClient.get(`/api/calibrations/${encodeURIComponent(serialNumber)}/chart`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// ─── Risk ──────────────────────────────────────────────────────────────────

/**
 * Fetch risk classification data for a device.
 * Returns null if the endpoint returns 404 or 501 (not yet implemented).
 */
export async function getRiskData(serialNumber) {
  try {
    const res = await apiClient.get(`/api/risk/${encodeURIComponent(serialNumber)}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    if (err.response?.status === 501) return null; // not implemented yet
    throw err;
  }
}

// ─── Calibration Predictions ────────────────────────────────────────────────

/**
 * Fetch all devices with their predicted calibration intervals.
 * @param {number|null} intervalYears  - filter to 1 or 2
 * @param {string|null} stability      - "stable" | "marginal" | "unstable"
 * @param {string|null} search         - free text query
 */
export async function getDevicesByPrediction(intervalYears = null, stability = null, search = null) {
  const params = {};
  if (intervalYears !== null && intervalYears !== undefined && intervalYears !== '') {
    params.interval_years = intervalYears;
  }
  if (stability) {
    params.stability = stability;
  }
  if (search) {
    params.search = search;
  }
  const res = await apiClient.get('/api/devices/predictions', { params, timeout: 30_000 });
  return res.data;
}

/**
 * Fetch the full prediction detail for a single device by serial number.
 * Returns: { device_id, serial_number, year_scores, interval_years, rule, message }
 */
export async function getDevicePrediction(serialNumber) {
  try {
    const res = await apiClient.get(`/api/devices/${encodeURIComponent(serialNumber)}/prediction`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Update editable fields of an existing device.
 * @param {string} serialNumber
 * @param {{ department_name?, device_type?, model?, manufacturer?, resolution? }} fields
 */
export async function updateDevice(serialNumber, fields) {
  try {
    const res = await apiClient.put(`/api/devices/${encodeURIComponent(serialNumber)}`, fields);
    const d = res.data;
    return {
      id:           d.id,
      serialNumber: d.serial_number,
      department:   d.department,
      deviceType:   d.device_type,
      model:        d.model,
      manufacturer: d.manufacturer,
      resolution:   d.resolution,
    };
  } catch (err) {
    const detail = err.response?.data?.detail;
    throw new Error(detail || 'Failed to update device. Please try again.');
  }
}

/**
 * Fetch all tolerance rules configured in the database.
 */
export async function getToleranceRules() {
  const res = await apiClient.get('/api/tolerances');
  return res.data;
}