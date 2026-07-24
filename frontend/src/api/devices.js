// src/api/devices.js
// Device, calibration, and risk API functions with mock fallback.
//
// TODO: Set USE_MOCK = false when the backend is ready.

import apiClient from './client';
import {
  MOCK_DEVICES,
  MOCK_CALIBRATION_HISTORY,
  MOCK_CHART_DATA,
  MOCK_RISK_DATA,
} from '../data/mockData';

const USE_MOCK = true; // TODO: flip to false when backend is live

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Devices ───────────────────────────────────────────────────────────────

/**
 * Fetch static device info by serial number.
 * @returns device object or null if not found
 */
export async function getDevice(serialNumber) {
  if (USE_MOCK) {
    await delay(600);
    return MOCK_DEVICES[serialNumber.toUpperCase()] || null;
  }
  // TODO: real API call
  try {
    const res = await apiClient.get(`/api/devices/${serialNumber}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// ─── Calibrations ──────────────────────────────────────────────────────────

/**
 * Fetch historical calibration records for a device.
 * @returns array of calibration record objects
 */
export async function getCalibrationHistory(serialNumber) {
  if (USE_MOCK) {
    await delay(400);
    return MOCK_CALIBRATION_HISTORY[serialNumber.toUpperCase()] || [];
  }
  // TODO: real API call
  const res = await apiClient.get(`/api/calibrations/${serialNumber}`);
  return res.data;
}

/**
 * Fetch control chart data + recommendation for a device.
 * @returns { points: [], recommendation: {} }
 */
export async function getChartData(serialNumber) {
  if (USE_MOCK) {
    await delay(400);
    return MOCK_CHART_DATA[serialNumber.toUpperCase()] || null;
  }
  // TODO: real API call — this is where the statistical engine results appear
  const res = await apiClient.get(`/api/calibrations/${serialNumber}/chart`);
  return res.data;
}

// ─── Risk ──────────────────────────────────────────────────────────────────

/**
 * Fetch risk classification scorecard for a device.
 * @returns risk data object or null
 */
export async function getRiskData(serialNumber) {
  if (USE_MOCK) {
    await delay(600);
    return MOCK_RISK_DATA[serialNumber.toUpperCase()] || null;
  }
  // TODO: real API call
  try {
    const res = await apiClient.get(`/api/risk/${serialNumber}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// ─── Calibration Predictions Search ────────────────────────────────────────

/**
 * Fetch devices filtered by predicted calibration interval (e.g., 2 years) and/or stability.
 * @param {number|string|null} intervalYears - e.g., 2, 1, or null for all
 * @param {string|null} stability - 'stable' | 'marginal' | 'unstable' | null
 * @returns {Array} array of predicted device objects
 */
export async function getDevicesByPrediction(intervalYears = null, stability = null) {
  try {
    const params = {};
    if (intervalYears !== null && intervalYears !== undefined && intervalYears !== '') {
      params.interval_years = intervalYears;
    }
    if (stability) {
      params.stability = stability;
    }
    const res = await apiClient.get('/api/devices/predictions', { params });
    return res.data;
  } catch (err) {
    console.warn('API call to /api/devices/predictions failed, falling back to mock filtering:', err);
    // Mock fallback logic
    await delay(300);
    const results = [];
    const targetInterval = intervalYears ? Number(intervalYears) : null;
    for (const [sn, device] of Object.entries(MOCK_DEVICES)) {
      const chart = MOCK_CHART_DATA[sn];
      if (!chart) continue;
      const rec = chart.recommendation;
      const recInterval = rec.intervalYears || rec.interval_years;
      if (targetInterval !== null && recInterval !== targetInterval) continue;
      if (stability && rec.stability.toLowerCase() !== stability.toLowerCase()) continue;
      results.push({
        serial_number: device.serialNumber || device.serial_number,
        department: device.department,
        device_type: device.deviceType || device.device_type,
        model: device.model,
        manufacturer: device.manufacturer,
        stability: rec.stability,
        label: rec.label,
        interval_years: recInterval,
        next_date: rec.nextDate || rec.next_date,
        message: rec.message,
      });
    }
    return results;
  }
}