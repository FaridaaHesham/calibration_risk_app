import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import './UsersPage.css';

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Biomedical Engineer', full_name: '' });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'users') {
        const res = await apiClient.get('/api/users');
        setUsers(res.data);
      } else {
        const res = await apiClient.get('/api/users/audit-logs');
        setLogs(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/users', newUser);
      setIsAddModalOpen(false);
      setNewUser({ username: '', password: '', role: 'Biomedical Engineer', full_name: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create user");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiClient.delete(`/api/users/${userId}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    }
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div className="users-tabs">
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <UsersIcon /> Users
          </button>
          <button 
            className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <ClockIcon /> Audit Logs
          </button>
        </div>
        {activeTab === 'users' && (
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            + Add User
          </button>
        )}
      </div>

      <div className="card users-content-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : activeTab === 'users' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isAdmin = u.role?.toUpperCase().includes('ADMIN');
                return (
                  <tr key={u.id}>
                    <td>{u.full_name || '—'}</td>
                    <td>{u.username}</td>
                    <td>
                      <span className={`role-badge ${isAdmin ? 'admin' : ''}`}>
                        {isAdmin && <ShieldIcon />}
                        {u.role || 'User'}
                      </span>
                    </td>
                    <td><span className={`status-badge ${u.is_active !== false ? 'active' : 'inactive'}`}>{u.is_active !== false ? 'Active' : 'Disabled'}</span></td>
                    <td>
                      <button className="btn-link" style={{ color: '#dc2626' }} onClick={() => handleDeleteUser(u.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20 }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Target Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{log.created_at || '—'}</td>
                  <td><strong>{log.user_name || '—'}</strong></td>
                  <td><span className="action-badge">{log.action}</span></td>
                  <td>{log.entity_type || '—'}</td>
                  <td className="log-details">{log.details || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20 }}>No audit logs found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button className="btn-close-modal" onClick={() => setIsAddModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddUser}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Full Name</label>
                  <input type="text" className="form-input" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} required />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Username</label>
                  <input type="text" className="form-input" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Password</label>
                  <input type="password" className="form-input" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                </div>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label>Role</label>
                  <select className="form-select" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="USER">User (Technician/Engineer)</option>
                    <option value="ADMIN">Admin (Manager)</option>
                  </select>
                </div>
                <div className="modal-footer" style={{ marginTop: 0 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create User</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
