import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiService } from '../services/api';

/* ─── Status badge ───────────────────────────────────────────────────────── */

const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={[
      'inline-flex items-center px-3 py-0.5 rounded text-xs font-semibold',
      active ? 'bg-green-500 text-white' : 'bg-orange-400 text-white',
    ].join(' ')}
  >
    {active ? 'Active' : 'Inactive'}
  </span>
);

/* ─── Icon buttons ───────────────────────────────────────────────────────── */

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

/* ─── Component ──────────────────────────────────────────────────────────── */

const Users: React.FC = () => {
  const [users, setUsers]           = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData]     = useState({
    id:        '',
    email:     '',
    password:  '',
    role:      'USER' as 'ADMIN' | 'USER',
    is_active: true,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiService.getUsers();
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ id: '', email: '', password: '', role: 'USER', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ id: user.id, email: user.email, password: '', role: user.role, is_active: user.is_active });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingUser(null); };

  const handleSubmit = async () => {
    try {
      if (!editingUser) {
        await apiService.createUser(formData);
        fetchUsers();
      }
      closeModal();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!userId?.trim()) { setError('Cannot delete: invalid user ID'); return; }
    if (!window.confirm('Delete this user?')) return;
    try {
      await apiService.deleteUser(userId);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── Users list card ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Users list</h2>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add new
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Email</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Role</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Created</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Last Login</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user, idx) => (
                  <tr
                    key={user.id}
                    className={[
                      'transition-colors hover:bg-gray-50',
                      idx < users.length - 1 ? 'border-b border-gray-100' : '',
                    ].join(' ')}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge active={user.is_active} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => openEdit(user)}
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                          aria-label="Edit user"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={!user.id?.trim()}
                          className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Delete user"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="user@example.com"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input"
                    placeholder="Min. 8 characters"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Minimum 8 characters, 1 digit, 1 uppercase letter
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'USER' })}
                  className="input"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn btn-primary">
                {editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
