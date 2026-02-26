import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { Agent, User, AgentCreate } from '../types';

const Agents: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [agentToken, setAgentToken] = useState('');
  const [agentId, setAgentId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    allowed_ip: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [agentsRes, usersRes] = await Promise.all([
        apiService.getAgents(),
        apiService.getUsers(),
      ]);
      setAgents(Array.isArray(agentsRes.data) ? agentsRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setFormData({
      name: '',
      user_id: users.length > 0 ? users[0].id : '',
      allowed_ip: '',
    });
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({
      name: '',
      user_id: users.length > 0 ? users[0].id : '',
      allowed_ip: '',
    });
  };

  const handleSubmit = async () => {
    try {
      setError('');

      if (!formData.name.trim()) {
        setError('Agent name is required');
        return;
      }

      const agentData: AgentCreate = {
        name: formData.name.trim(),
        user_id: formData.user_id || undefined,
        allowed_ip: formData.allowed_ip?.trim() || undefined,
      };

      const response = await apiService.createAgent(agentData);

      if (response.data.bootstrap?.token) {
        setAgentToken(response.data.bootstrap.token);
        setAgentId(response.data.id);
        setShowTokenDialog(true);
      }

      await fetchData();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create agent');
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Agents</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── Agents list card ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Agents list</h2>
          <button
            onClick={handleOpen}
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
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">User</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Last Heartbeat</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                    No agents found.
                  </td>
                </tr>
              ) : (
                agents.map((agent, idx) => (
                  <tr
                    key={agent.id}
                    className={[
                      'transition-colors hover:bg-gray-50',
                      idx < agents.length - 1 ? 'border-b border-gray-100' : '',
                    ].join(' ')}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{agent.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {users.find((u) => u.id === agent.user_id)?.email || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={[
                          'inline-flex items-center px-3 py-0.5 rounded text-xs font-semibold',
                          agent.status === 'ONLINE'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700',
                        ].join(' ')}
                      >
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {agent.last_heartbeat_at
                        ? new Date(agent.last_heartbeat_at).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/agents/${agent.id}`)}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                        aria-label="View agent"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create Agent modal ────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Create New Agent</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Enter agent name"
                />
                <p className="text-xs text-gray-400 mt-1">Agent ID will be auto-generated</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="input"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allowed IP <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.allowed_ip}
                  onChange={(e) => setFormData({ ...formData, allowed_ip: e.target.value })}
                  className="input"
                  placeholder="Leave empty for any IP"
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated list of IP addresses</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={handleClose} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Token Display modal ───────────────────────────────────────── */}
      {showTokenDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowTokenDialog(false)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-5 text-center">
              Agent Created Successfully
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Your Agent Token</p>
                <p className="text-xs text-gray-500 mb-2">
                  Copy this token and add it to your agent's configuration file:
                </p>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 font-mono text-sm break-all text-center text-gray-900">
                  {agentToken}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Agent ID</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 font-mono text-sm text-center text-gray-900">
                  {agentId}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Configuration File</p>
                <p className="text-xs text-gray-500 mb-2">
                  Update your agent's <code className="bg-gray-100 px-1 rounded">meta_config.json</code> file:
                </p>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 font-mono text-xs overflow-auto max-h-48 text-gray-900">
{`{
  "meta_api": {
    "app_id": "YOUR_APP_ID",
    "app_secret": "YOUR_APP_SECRET",
    "access_token": "YOUR_ACCESS_TOKEN",
    "ad_account_id": "YOUR_AD_ACCOUNT_ID",
    "base_url": "https://graph.facebook.com/v18.0",
    "timeout": 30
  },
  "crm": {
    "agent_token": "${agentToken}"
  }
}`}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => navigator.clipboard.writeText(agentToken)}
                className="btn btn-secondary"
              >
                Copy Token
              </button>
              <button
                onClick={() => setShowTokenDialog(false)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agents;
