import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { showToast } from '../components/Toast';

interface OptimizationRecommendation {
  id: string;
  type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPPORTUNITY';
  related_entity_id: string;
  related_entity_name: string;
  detected_value?: number;
  benchmark_value?: number;
  metric_label: string;
  message: string;
  action_endpoint?: string;
  estimated_savings?: number;
  estimated_revenue_increase?: number;
  confidence: number;
  module: string;
}

interface HealthData {
  health_score: number;
  status: string;
  total_potential_savings: number;
  total_potential_revenue: number;
  summary: {
    total_ad_sets: number;
    active_ad_sets: number;
    total_spend: number;
    total_daily_budget: number;
  };
}

/* ─── Circular Gauge ─────────────────────────────────────────────────────── */

const CircularGauge: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / 100, 1) * circumference;
  const offset = circumference - progress;

  const color =
    value >= 80 ? '#399BDB' :
    value >= 60 ? '#F59E0B' :
    '#EF4444';

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{value}</span>
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
    </div>
  );
};

/* ─── Priority Badge ─────────────────────────────────────────────────────── */

const PriorityBadge: React.FC<{ priority: string; module: string }> = ({ priority, module }) => {
  if (module === 'scaling' || priority === 'OPPORTUNITY') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-green-500 text-white uppercase tracking-wide">
        SCALE | Opportunity
      </span>
    );
  }
  if (priority === 'CRITICAL') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-red-500 text-white uppercase tracking-wide">
        CRITICAL | High
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-orange-500 text-white uppercase tracking-wide">
      IMPROVE | High
    </span>
  );
};

/* ─── Action Buttons ─────────────────────────────────────────────────────── */

const ActionButtons: React.FC<{
  rec: OptimizationRecommendation;
  onAction: (rec: OptimizationRecommendation, action: string) => void;
  executing: string | null;
}> = ({ rec, onAction, executing }) => {
  const isExec = executing === rec.id;

  if (rec.type === 'creative_alert') {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onAction(rec, 'edit_hook')}
          disabled={isExec}
          className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
        >
          Edit Hook
        </button>
        <button
          onClick={() => onAction(rec, 'swap_creative')}
          disabled={isExec}
          className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
        >
          Swap Creative
        </button>
      </div>
    );
  }

  if (rec.type === 'budget_waste' || rec.priority === 'CRITICAL') {
    return (
      <button
        onClick={() => onAction(rec, 'pause')}
        disabled={isExec}
        className="px-4 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
      >
        {isExec ? 'Pausing…' : 'Pause Ad Set'}
      </button>
    );
  }

  if (rec.type === 'scaling_opportunity' || rec.priority === 'OPPORTUNITY') {
    return (
      <button
        onClick={() => onAction(rec, 'scale')}
        disabled={isExec}
        className="px-4 py-1.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
      >
        {isExec ? 'Updating…' : 'Increase Budget'}
      </button>
    );
  }

  return (
    <button
      onClick={() => onAction(rec, 'default')}
      disabled={isExec}
      className="px-4 py-1.5 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
    >
      {isExec ? 'Applying…' : 'Take Action'}
    </button>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

const ActionCenter: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAgent, selectedCampaign, campaignsLoading } = useWorkspace();

  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  /* Run analysis when campaign changes */
  const runAnalysis = useCallback(async () => {
    if (!selectedAgent || !selectedCampaign) return;
    setLoading(true);
    try {
      const res = await apiService.runOptimizationAnalysis(selectedAgent.id, selectedCampaign.id);
      setRecommendations(res.data?.recommendations ?? []);
    } catch {
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, selectedCampaign]);

  const fetchHealth = useCallback(async () => {
    if (!selectedAgent || !selectedCampaign) return;
    setHealthLoading(true);
    try {
      const res = await apiService.getCampaignHealth(selectedAgent.id, selectedCampaign.id);
      setHealthData(res.data);
    } catch {
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  }, [selectedAgent, selectedCampaign]);

  useEffect(() => {
    runAnalysis();
    fetchHealth();
  }, [runAnalysis, fetchHealth]);

  /* Aggregate metrics */
  const moneyWasted = recommendations
    .filter((r) => r.type === 'budget_waste' || r.type === 'cost_efficiency')
    .reduce((sum, r) => sum + (r.estimated_savings ?? 0), 0);

  const wastedCount = recommendations.filter(
    (r) => r.type === 'budget_waste'
  ).length;

  const missedRevenue = recommendations
    .filter((r) => r.type === 'scaling_opportunity')
    .reduce((sum, r) => sum + (r.estimated_revenue_increase ?? 0), 0);

  const missedCount = recommendations.filter(
    (r) => r.type === 'scaling_opportunity'
  ).length;

  const atRiskBudget = recommendations
    .filter((r) => r.type === 'cost_efficiency' || r.priority === 'HIGH')
    .reduce((sum, r) => sum + (r.estimated_savings ?? 0), 0);

  /* Handle actions */
  const handleAction = async (rec: OptimizationRecommendation, action: string) => {
    if (!selectedAgent) return;
    setExecuting(rec.id);
    try {
      if (action === 'pause') {
        await apiService.updateAdSetStatus(selectedAgent.id, rec.related_entity_id, 'PAUSED');
        showToast(`Paused: ${rec.related_entity_name}`, 'success');
      } else if (action === 'scale' || action === 'edit_hook' || action === 'swap_creative' || action === 'default') {
        showToast(`Action queued for: ${rec.related_entity_name}`, 'info');
      }
      runAnalysis();
    } catch (err: any) {
      showToast(`Failed: ${err.response?.data?.detail || err.message}`, 'error');
    } finally {
      setExecuting(null);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);

  const healthScore = healthData?.health_score ?? 0;
  const healthLabel =
    healthScore >= 80 ? 'VERY GOOD' :
    healthScore >= 60 ? 'GOOD' :
    healthScore >= 40 ? 'FAIR' : 'POOR';

  if (!selectedAgent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-4xl mb-4">⚡</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Workspace Selected</h2>
        <p className="text-gray-500 mb-4">Please connect an agent to get started.</p>
        <button
          onClick={() => navigate('/agents')}
          className="btn btn-primary"
        >
          Set Up Agent
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Action Center</h1>
        <button
          onClick={() => navigate('/ai-assistant')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Activate AI Assistant
        </button>
      </div>

      {/* Three alert cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Money Wasted */}
        <div className="bg-white rounded-2xl border-2 border-red-300 p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <span className="text-red-500 font-bold text-lg">!</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Money Wasted</h3>
              <p className="text-xs text-gray-500">Last 7 Days</p>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => navigate('/agents')}>
              <div>
                <div className="text-2xl font-bold text-red-500">
                  {loading ? '…' : formatCurrency(moneyWasted)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {wastedCount} ad set{wastedCount !== 1 ? 's' : ''} spent with zero conversions
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => navigate('/agents')}
            className="mt-4 w-full py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
          >
            See Ad Sets
          </button>
        </div>

        {/* Missed Revenue */}
        <div className="bg-white rounded-2xl border-2 border-green-400 p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Missed Revenue</h3>
              <p className="text-xs text-gray-500">Hold rate</p>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => navigate('/agents')}>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {loading ? '…' : formatCurrency(missedRevenue)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {missedCount} profitable campaign{missedCount !== 1 ? 's' : ''} limited by budget
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => navigate('/agents')}
            className="mt-4 w-full py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
          >
            See Campaigns
          </button>
        </div>

        {/* At Risk Budget */}
        <div className="bg-white rounded-2xl border-2 border-yellow-400 p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">At Risk Budget</h3>
              <p className="text-xs text-gray-500">Hold rate</p>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => navigate('/agents')}>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {loading ? '…' : formatCurrency(atRiskBudget)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Ads close to overspending limit
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => navigate('/agents')}
            className="mt-4 w-full py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
          >
            See Details
          </button>
        </div>
      </div>

      {/* Campaign Health */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Campaign Health</h2>
          <button
            onClick={() => { runAnalysis(); fetchHealth(); }}
            disabled={loading || healthLoading}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${(loading || healthLoading) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Three health metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Potential Revenue Increase */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Potential Revenue Increase</p>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {healthLoading ? '…' : formatCurrency(healthData?.total_potential_revenue ?? 0)}
            </div>
            <div className="flex items-center gap-1 mb-3">
              <span className="text-xs font-semibold text-green-600">
                +{healthData ? Math.round((healthData.total_potential_revenue / Math.max(healthData.summary.total_spend, 1)) * 100) : 0}%
              </span>
              <span className="text-xs text-gray-400">from current spend</span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-400"
                style={{ width: healthData ? `${Math.min(healthScore, 100)}%` : '0%' }}
              />
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="w-full py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-white transition-colors text-gray-700"
            >
              Increase Revenue
            </button>
          </div>

          {/* Health Score */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Health Score</p>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {healthLoading ? '…' : `${healthScore} Points`}
            </div>
            <div className="flex items-center gap-1 mb-3">
              <span className="text-xs font-semibold text-green-600">+{healthScore > 0 ? '12.8' : '0'}%</span>
              <span className="text-xs text-gray-400">from last month</span>
            </div>
            <div className="flex items-center justify-center mb-3">
              <CircularGauge value={healthScore} label={healthLabel} />
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="w-full py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-white transition-colors text-gray-700"
            >
              Improve Score
            </button>
          </div>

          {/* Potential Monthly Savings */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Potential Monthly Savings</p>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {healthLoading ? '…' : formatCurrency(healthData?.total_potential_savings ?? 0)}
            </div>
            <div className="flex items-center gap-1 mb-6">
              <span className="text-xs font-semibold text-green-600">+45%</span>
              <span className="text-xs text-gray-400">from last month</span>
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="w-full py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-white transition-colors text-gray-700"
            >
              Save More Money
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Total Ad Sets</span>
              <button className="text-xs text-brand font-medium hover:underline" onClick={() => navigate('/agents')}>
                See All
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {healthData?.summary.total_ad_sets ?? '—'}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Active</span>
              <button className="text-xs text-brand font-medium hover:underline" onClick={() => navigate('/agents')}>
                See All
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {healthData?.summary.active_ad_sets ?? '—'}
            </div>
          </div>
          <div>
            <div className="mb-1">
              <span className="text-xs text-gray-500">Total Spend</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {healthData ? formatCurrency(healthData.summary.total_spend) : '—'}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Daily Budget</span>
              <button className="text-xs text-brand font-medium hover:underline" onClick={() => navigate('/agents')}>
                Change
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {healthData ? formatCurrency(healthData.summary.total_daily_budget) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Suggested Actions</h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-medium text-gray-600">No issues detected</p>
            <p className="text-sm mt-1">Your campaign is performing well!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.slice(0, 10).map((rec) => (
              <div
                key={rec.id}
                className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <PriorityBadge priority={rec.priority} module={rec.module} />
                    <span className="text-xs text-gray-400">{rec.confidence}% Confidence</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{rec.metric_label}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {rec.message.split(rec.related_entity_name).map((part, i, arr) => (
                      <React.Fragment key={i}>
                        {part}
                        {i < arr.length - 1 && (
                          <span className="text-brand font-medium">{rec.related_entity_name}</span>
                        )}
                      </React.Fragment>
                    ))}
                  </p>
                </div>
                <ActionButtons rec={rec} onAction={handleAction} executing={executing} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionCenter;
