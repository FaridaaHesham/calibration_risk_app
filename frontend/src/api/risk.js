// src/api/risk.js
// API helper functions for Risk Assessment Module.

import apiClient from './client';

export async function getRiskDashboard() {
  const response = await apiClient.get('/api/risk/dashboard');
  return response.data;
}

export async function getDeviceRiskDetails(serialNumber) {
  const encodedSerial = encodeURIComponent(serialNumber);
  const response = await apiClient.get(`/api/risk/device/${encodedSerial}`);
  return response.data;
}

export async function getRiskConfigByDeviceType(deviceType) {
  const encodedType = encodeURIComponent(deviceType);
  const response = await apiClient.get(`/api/risk/device-type/${encodedType}`);
  return response.data;
}

export async function listRiskAssessments() {
  const response = await apiClient.get('/api/risk/assessments');
  return response.data;
}

export async function createRiskAssessment(payload) {
  const response = await apiClient.post('/api/risk/assessment', payload);
  return response.data;
}

export async function updateRiskAssessment(id, payload) {
  const response = await apiClient.put(`/api/risk/assessment/${id}`, payload);
  return response.data;
}
