// src/api/auth.js
// Auth API functions with mock fallback.
//
// USE_MOCK = true  → returns mock data directly (no backend needed for demo)
// USE_MOCK = false → calls the real FastAPI backend
//
// TODO: Set USE_MOCK = false when the backend is ready.

import apiClient from './client';

const USE_MOCK = true; // TODO: flip to false when backend is live

// Hardcoded demo credentials — remove when using real auth
const MOCK_CREDENTIALS = {
  admin:      { password: 'admin123', name: 'Dr. Admin User',    role: 'Biomedical Engineer' },
  technician: { password: 'tech123',  name: 'Lab Technician',    role: 'Calibration Technician' },
};

/**
 * Attempt to log in.
 * @returns {{ user_name: string, role: string, access_token: string }}
 * @throws Error with a user-readable message on failure
 */
export async function login(username, password) {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 700));

    const user = MOCK_CREDENTIALS[username.toLowerCase()];
    if (user && user.password === password) {
      return {
        access_token: 'mock-token-12345',
        user_name: user.name,
        role: user.role,
      };
    }
    // Also allow any non-empty input to succeed for easy demo
    if (username.trim() && password.trim()) {
      return {
        access_token: 'mock-token-demo',
        user_name: username,
        role: 'Demo User',
      };
    }
    throw new Error('Please enter a username and password.');
  }

  // TODO: real API call
  const response = await apiClient.post('/api/auth/login', { username, password });
  return response.data;
}
