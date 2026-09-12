// src/api/auth.js
// Real authentication — calls POST /api/auth/login on the FastAPI backend.
//
// Also the single source of truth for "is this logged-in user an admin",
// shared by App.jsx (route guarding) and Sidebar.jsx (nav visibility) so
// they can never disagree with each other — and, more importantly, matches
// the backend's real, enforced check in app/routers/auth.py (require_admin),
// which treats any role containing "admin" (case-insensitively) as admin.

import apiClient from './client';

/**
 * Attempt to log in with username/password.
 * @returns {{ access_token, user_name, role }}
 * @throws Error with a user-readable message on failure
 */
export async function login(username, password) {
  try {
    const response = await apiClient.post('/api/auth/login', { username, password });
    return response.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    throw new Error(detail || 'Login failed. Please check your credentials and try again.');
  }
}

export function isAdminUser(user) {
  return Boolean(user?.role) && user.role.toLowerCase().includes('admin');
}