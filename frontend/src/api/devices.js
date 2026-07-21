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