import React, { useState, useEffect } from 'react';
import { Agent } from '../types';
import { apiService } from '../services/api';

const Dashboard: React.FC = () => {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiService.getAgents();
        setAgents(Array.isArray(res.data) ? res.data : []);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  const onlineAgents  = agents.filter((a) => a.status === 'ONLINE').length;
  const totalAgents   = agents.length;
  const connectedApps = onlineAgents;

  return (
    <div>
      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* ── Top stat cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Agent Health */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Agent Health</h2>
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-sm text-gray-500 mb-1">Agents Online</p>
            <p className="text-[2rem] font-bold text-gray-900 leading-none">
              {onlineAgents}/{totalAgents}
            </p>
          </div>
        </div>

        {/* Connected Apps */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Connected Apps</h2>
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-sm text-gray-500 mb-1">Meta Apps Connected</p>
            <p className="text-[2rem] font-bold text-gray-900 leading-none">
              {connectedApps}
            </p>
          </div>
        </div>
      </div>

      {/* ── Agent Status table ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Agent Status</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600 whitespace-nowrap">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600 whitespace-nowrap">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600 whitespace-nowrap">
                  Last Heartbeat
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600 whitespace-nowrap">
                  Allowed IP
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-400">
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
                    <td className="px-6 py-4 text-sm text-gray-900">{agent.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={[
                          'inline-flex items-center px-3 py-0.5 rounded text-xs font-semibold uppercase tracking-wide',
                          agent.status === 'ONLINE'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-700 text-white',
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
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {agent.allowed_ip || 'Any'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
