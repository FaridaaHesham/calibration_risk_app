// src/api/devices.js
// All device, calibration, and prediction API calls.
// Talks directly to the FastAPI backend — no mock data.

import apiClient from './client';

// ─── Departments ─────────────────────────────────────────────────────────

export async function getDepartments() {
  const res = await apiClient.get('/api/devices/departments');
  return res.data;
}

export async function getDeviceTypes() {
  const res = await apiClient.get('/api/devices/device-types');
  return res.data;
}

// ─── Devices ───────────────────────────────────────────────────────────────

export async function getDevice(serialNumber, department = null) {
  try {
    const params = {};
    if (department && department.trim()) {
      params.department = department.trim();
    }
    const res = await apiClient.get(
      `/api/devices/${encodeURIComponent(serialNumber)}`,
      { params }
    );

    const d = res.data;

    return {
      id: d.id,
      serialNumber: d.serial_number,
      department: d.department,
      deviceType: d.device_type,
      model: d.model,
      manufacturer: d.manufacturer,
      resolution: d.resolution,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return null;
    }

    throw err;
  }
}

export async function createDevice(deviceData) {
  try {
    const res = await apiClient.post('/api/devices', {
      serial_number: deviceData.serialNumber,
      department_name: deviceData.department,
      device_type: deviceData.deviceType,
      model: deviceData.model || null,
      manufacturer: deviceData.manufacturer || null,
      resolution:
        deviceData.resolution === '' ||
        deviceData.resolution === undefined
          ? null
          : Number(deviceData.resolution),
    });

    const d = res.data;

    return {
      id: d.id,
      serialNumber: d.serial_number,
      department: d.department,
      deviceType: d.device_type,
      model: d.model,
      manufacturer: d.manufacturer,
      resolution: d.resolution,
    };
  } catch (err) {
    const detail = err.response?.data?.detail;

    throw new Error(
      detail ||
        'Failed to create device. Please try again.'
    );
  }
}

// ─── Calibrations ──────────────────────────────────────────────────────────

export async function getCalibrationHistory(serialNumber) {
  const res = await apiClient.get(
    `/api/calibrations/${encodeURIComponent(serialNumber)}`
  );

  return res.data;
}

export async function createCalibrationRecord(payload) {
  try {
    const res = await apiClient.post('/api/calibrations', {
      serial_number: payload.serialNumber,
      calibration_year: Number(payload.calibrationYear),

      certificate_num:
        payload.certificateNum || null,

      accessory_type:
        payload.accessoryType || null,

      accessory_model:
        payload.accessoryModel || null,

      accessory_serial:
        payload.accessorySerial || null,

      tests: payload.tests.map((t) => ({
        test_label: t.testLabel,

        test_point_unit:
          t.testPointUnit || null,

        reference_value:
          t.referenceValue === ''
            ? null
            : Number(t.referenceValue),

        actual_value: Number(t.actualValue),

        min_value: Number(t.minValue),

        max_value: Number(t.maxValue),
      })),
    });

    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail;

    throw new Error(
      detail ||
        'Failed to save calibration record. Please try again.'
    );
  }
}

// ─── Chart ─────────────────────────────────────────────────────────────────

export async function getChartData(serialNumber) {
  try {
    const res = await apiClient.get(
      `/api/calibrations/${encodeURIComponent(serialNumber)}/chart`
    );

    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return null;
    }

    throw err;
  }
}

// ─── Risk ─────────────────────────────────────────────────────────────────

export async function getRiskData(serialNumber) {
  try {
    const res = await apiClient.get(
      `/api/risk/${encodeURIComponent(serialNumber)}`
    );

    return res.data;
  } catch (err) {
    if (
      err.response?.status === 404 ||
      err.response?.status === 501
    ) {
      return null;
    }

    throw err;
  }
}

// ─── Calibration Predictions ──────────────────────────────────────────────

export async function getDevicesByPrediction(
  intervalYears = null,
  stability = null,
  search = null
) {
  const params = {};

  if (
    intervalYears !== null &&
    intervalYears !== undefined &&
    intervalYears !== ''
  ) {
    params.interval_years = intervalYears;
  }

  if (stability) {
    params.stability = stability;
  }

  if (search) {
    params.search = search;
  }

  const res = await apiClient.get(
    '/api/devices/predictions',
    {
      params,
      timeout: 30_000,
    }
  );

  return res.data;
}

export async function getDevicePrediction(serialNumber) {
  try {
    const res = await apiClient.get(
      `/api/devices/${encodeURIComponent(serialNumber)}/prediction`
    );

    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return null;
    }

    throw err;
  }
}

// ─── Device Update ─────────────────────────────────────────────────────────

export async function updateDevice(
  serialNumber,
  fields
) {
  try {
    const res = await apiClient.put(
      `/api/devices/${encodeURIComponent(serialNumber)}`,
      fields
    );

    const d = res.data;

    return {
      id: d.id,
      serialNumber: d.serial_number,
      department: d.department,
      deviceType: d.device_type,
      model: d.model,
      manufacturer: d.manufacturer,
      resolution: d.resolution,
    };
  } catch (err) {
    const detail = err.response?.data?.detail;

    throw new Error(
      detail ||
        'Failed to update device. Please try again.'
    );
  }
}

// ─── Device Delete ─────────────────────────────────────────────────────────

export async function deleteDevice(serialNumber) {
  try {
    await apiClient.delete(
      `/api/devices/${encodeURIComponent(serialNumber)}`
    );
  } catch (err) {
    const detail = err.response?.data?.detail;

    throw new Error(
      detail ||
        `Failed to delete device "${serialNumber}". Please try again.`
    );
  }
}

// ─── Tolerance Rules ───────────────────────────────────────────────────────

export async function getToleranceRules() {
  const res = await apiClient.get('/api/tolerances');
  return res.data;
}

// ─── Device Test Labels ───────────────────────────────────────────────────

export async function getDeviceTestLabels(serialNumber) {
  try {
    const res = await apiClient.get(
      `/api/devices/${encodeURIComponent(serialNumber)}/test-labels`
    );

    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return [];
    }

    throw err;
  }
}

// ─── Prediction Settings ──────────────────────────────────────────────────

export async function getPredictionSettings() {
  const res = await apiClient.get(
    '/api/settings/prediction'
  );

  return res.data;
}

export async function savePredictionSettings(
  settings
) {
  try {
    const res = await apiClient.put(
      '/api/settings/prediction',
      settings
    );

    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail;

    throw new Error(
      detail ||
        'Failed to save settings. Please try again.'
    );
  }
}