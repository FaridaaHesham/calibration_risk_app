// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import logoImg from '../assets/logo.png';
import './LoginPage.css';

const EyeIcon = ({ open }) =>
  open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  );

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(username, password);
      // TODO: Replace localStorage with a proper auth context / JWT store
      localStorage.setItem('auth_token', userData.access_token);
      localStorage.setItem('auth_user', JSON.stringify({
        name: userData.user_name,
        role: userData.role,
      }));
      navigate('/app/calibration', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-bg">
      {/* Subtle watermark pattern */}
      <div className="login-pattern" aria-hidden="true" />

      <main className="login-card" role="main">
        {/* Hospital logo */}
        <div className="login-logo-wrap">
          <img src={logoImg} alt="Adam International Hospital logo" className="login-logo" />
        </div>

        <div className="login-header">
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to the Calibration Management System</p>
        </div>

        {/* Demo hint */}
        <div className="login-hint">
          <strong>Demo credentials:</strong> username <code>admin</code>, password <code>admin123</code>
          &nbsp;— or enter any non-empty values.
        </div>

        <form id="login-form" onSubmit={handleSubmit} noValidate>
          {/* Error message */}
          {error && (
            <div className="login-error" role="alert" id="login-error-msg">
              <ErrorIcon />
              {error}
            </div>
          )}

          {/* Username */}
          <div className="login-field">
            <label htmlFor="login-username" className="form-label">Username</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password" className="form-label">Password</label>
            <div className="login-pw-wrap">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="form-input login-pw-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                id="btn-toggle-password"
                className="login-pw-toggle"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="login-forgot">
            {/* TODO: Wire up to a real password reset flow */}
            <a href="#forgot" id="link-forgot-password" onClick={(e) => e.preventDefault()}>
              Forgot password?
            </a>
          </div>

          <button
            id="btn-login"
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</>
            ) : 'Log In'}
          </button>
        </form>

        <p className="login-footer">
          Adam International Hospital — Device Calibration &amp; Risk System
        </p>
      </main>
    </div>
  );
}

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
