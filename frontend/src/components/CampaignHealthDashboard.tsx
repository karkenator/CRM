import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { AdSetRuleCreate } from '../types';
import { showToast } from './Toast';

interface CampaignHealthProps {
  agentId: string;
  campaignId: string;
  campaignName: string;
  onRuleCreated?: () => void;
}

interface OptimizationInsight {
  type: string;
  priority: string;
  category: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  affected_entities: string[]; // Ad set IDs
  estimated_savings?: number;
  estimated_revenue_increase?: number;
  confidence: number;
}

const CampaignHealthDashboard: React.FC<CampaignHealthProps> = ({ agentId, campaignId, campaignName, onRuleCreated }) => {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedInsight, setSelectedInsight] = useState<OptimizationInsight | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);

  useEffect(() => {
    fetchHealthData();
  }, [agentId, campaignId]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCampaignHealth(agentId, campaignId);
      setHealthData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch campaign health');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
        {error}
      </div>
    );
  }

  if (!healthData) return null;

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'needs_attention': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthBgColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100';
      case 'good': return 'bg-blue-100';
      case 'needs_attention': return 'bg-yellow-100';
      case 'critical': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const handleCreateRule = async (insight: OptimizationInsight) => {
    if (!insight.affected_entities || insight.affected_entities.length === 0) {
      showToast('No affected ad sets found for this insight', 'error');
      return;
    }

    setCreatingRule(true);
    try {
      // Determine action type based on insight type and recommendation
      const recommendation = insight.recommendation.toLowerCase();
      const title = insight.title.toLowerCase();

      // Determine action: pause for warnings/issues, activate for opportunities that suggest scaling
      let actionType: 'PAUSE' | 'ACTIVATE' = 'PAUSE';
      if (insight.type === 'opportunity' && (recommendation.includes('scale') || recommendation.includes('increase budget'))) {
        actionType = 'ACTIVATE'; // For scaling opportunities, we keep them active
      }
      if (recommendation.includes('pause') || title.includes('zero conversion') || title.includes('poor conversion')) {
        actionType = 'PAUSE';
      }

      // Create a descriptive rule name
      const ruleName = `[AI] ${insight.title.substring(0, 50)}`;

      // For each affected ad set, we need to execute the action directly
      // Since the insight already identified specific ad sets, we execute immediately on those
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const adSetId of insight.affected_entities) {
        try {
          const status = actionType === 'PAUSE' ? 'PAUSED' : 'ACTIVE';
          await apiService.updateAdSetStatus(agentId, adSetId, status);
          successCount++;
        } catch (err: any) {
          failCount++;
          errors.push(`${adSetId}: ${err.message}`);
        }
      }

      // Also create a rule in CRM for tracking/history (with filter that matches by spending threshold)
      // This rule will also be synced to Meta for ongoing monitoring
      const filterConfig = {
        conditions: [
          {
            field: 'spend',
            operator: 'greater_than',
            value: 0, // Will match ad sets with any spend
          },
        ],
        logical_operator: 'AND' as const,
      };

      const ruleToCreate: AdSetRuleCreate = {
        agent_id: agentId,
        campaign_id: campaignId,
        rule_name: ruleName,
        description: `${insight.description}\n\nImpact: ${insight.impact}\n\nRecommendation: ${insight.recommendation}\n\nAffected Ad Sets: ${insight.affected_entities.length}`,
        filter_config: filterConfig,
        action: { type: actionType },
        execution_mode: 'MANUAL',
        execute_immediately: false, // Already executed above
      };

      const response = await apiService.createAdSetRule(ruleToCreate);
      const result = response.data as any;

      // Build success message
      let successMessage = '';
      if (successCount > 0) {
        successMessage = `${actionType === 'PAUSE' ? 'Paused' : 'Activated'} ${successCount} ad set(s)!`;
      }
      if (failCount > 0) {
        successMessage += ` ${failCount} failed.`;
      }
      if (result.meta_rule_result?.data?.id) {
        successMessage += ' Rule synced to Meta.';
      }

      showToast(successMessage || 'Rule created', successCount > 0 ? 'success' : 'error');
      setSelectedInsight(null);

      // Refresh the health data to show updated status
      fetchHealthData();

      // Notify parent to refresh rules list
      if (onRuleCreated) {
        onRuleCreated();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create rule';
      showToast(`Failed: ${errorMessage}`, 'error');
    } finally {
      setCreatingRule(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Campaign Health: {campaignName}
          </h2>
          <button
            onClick={fetchHealthData}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Health Score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-6 rounded-lg ${getHealthBgColor(healthData.status)}`}>
            <div className="text-center">
              <div className={`text-5xl font-bold ${getHealthColor(healthData.status)} mb-2`}>
                {healthData.health_score}
              </div>
              <div className="text-sm font-medium text-gray-700 uppercase">
                Health Score
              </div>
              <div className={`text-xs mt-2 ${getHealthColor(healthData.status)} font-semibold uppercase`}>
                {healthData.status.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {formatCurrency(healthData.total_potential_savings || 0)}
              </div>
              <div className="text-sm font-medium text-gray-700">
                Potential Monthly Savings
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatCurrency(healthData.total_potential_revenue || 0)}
              </div>
              <div className="text-sm font-medium text-gray-700">
                Potential Revenue Increase
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {healthData.summary.total_ad_sets}
            </div>
            <div className="text-xs text-gray-600">Total Ad Sets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {healthData.summary.active_ad_sets}
            </div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(healthData.summary.total_spend)}
            </div>
            <div className="text-xs text-gray-600">Total Spend</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(healthData.summary.total_daily_budget)}
            </div>
            <div className="text-xs text-gray-600">Daily Budget</div>
          </div>
        </div>
      </div>

      {/* Insights by Category */}
      {healthData.insights_by_category && Object.keys(healthData.insights_by_category).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Optimization Insights
          </h3>
          <div className="space-y-4">
            {Object.entries(healthData.insights_by_category).map(([category, insights]: [string, any]) => (
              <div key={category} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">{getCategoryIcon(category)}</span>
                  {category}
                  <span className="ml-2 text-sm text-gray-500">
                    ({insights.length})
                  </span>
                </h4>
                <div className="space-y-2">
                  {insights.map((insight: OptimizationInsight, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => setSelectedInsight(insight)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(insight.priority)}`}>
                              {insight.priority.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">
                              {insight.confidence}% confidence
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {insight.title}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {insight.description.substring(0, 100)}...
                          </div>
                          {insight.affected_entities && insight.affected_entities.length > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              {insight.affected_entities.length} ad set(s) affected
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          {insight.estimated_savings && (
                            <div className="text-sm font-semibold text-green-600">
                              Save {formatCurrency(insight.estimated_savings)}
                            </div>
                          )}
                          {insight.estimated_revenue_increase && (
                            <div className="text-sm font-semibold text-blue-600">
                              Gain {formatCurrency(insight.estimated_revenue_increase)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Insight Modal */}
      {selectedInsight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(selectedInsight.priority)}`}>
                      {selectedInsight.priority.toUpperCase()} PRIORITY
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {selectedInsight.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedInsight.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">📝 Description</h4>
                  <p className="text-gray-700 text-sm">{selectedInsight.description}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">💡 Impact</h4>
                  <p className="text-gray-700 text-sm">{selectedInsight.impact}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">🎯 Recommendation</h4>
                  <p className="text-gray-700 text-sm whitespace-pre-line">
                    {selectedInsight.recommendation}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  {selectedInsight.estimated_savings && (
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(selectedInsight.estimated_savings)}
                      </div>
                      <div className="text-xs text-gray-600">Potential Savings</div>
                    </div>
                  )}
                  {selectedInsight.estimated_revenue_increase && (
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(selectedInsight.estimated_revenue_increase)}
                      </div>
                      <div className="text-xs text-gray-600">Revenue Increase</div>
                    </div>
                  )}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedInsight.confidence}%
                    </div>
                    <div className="text-xs text-gray-600">Confidence Level</div>
                  </div>
                </div>
              </div>

              {selectedInsight.affected_entities && selectedInsight.affected_entities.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-800 mb-2">
                    Clicking "Apply Action" will:
                  </p>
                  <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                    <li>
                      <strong>
                        {selectedInsight.recommendation.toLowerCase().includes('pause') ||
                         selectedInsight.title.toLowerCase().includes('zero conversion') ||
                         selectedInsight.title.toLowerCase().includes('poor conversion')
                          ? 'Pause'
                          : 'Keep Active'
                        }
                      </strong> {selectedInsight.affected_entities.length} ad set(s) immediately
                    </li>
                    <li>Create a tracking rule in CRM and Meta Ads Manager</li>
                    <li>The rule will appear in Custom Rules for future management</li>
                  </ul>
                  <p className="text-xs text-blue-600 mt-2">
                    Ad Set IDs: {selectedInsight.affected_entities.slice(0, 3).join(', ')}
                    {selectedInsight.affected_entities.length > 3 && ` +${selectedInsight.affected_entities.length - 3} more`}
                  </p>
                </div>
              )}

              {(!selectedInsight.affected_entities || selectedInsight.affected_entities.length === 0) && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    No specific ad sets identified for this insight. This is a general recommendation.
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedInsight(null)}
                  disabled={creatingRule}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  onClick={() => handleCreateRule(selectedInsight)}
                  disabled={creatingRule || !selectedInsight.affected_entities || selectedInsight.affected_entities.length === 0}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 rounded-lg disabled:opacity-50"
                >
                  {creatingRule ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Applying...
                    </span>
                  ) : (
                    `Apply Action (${selectedInsight.affected_entities?.length || 0} ad sets)`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Conversion Rate': '🎯',
    'Conversion Funnel': '🔄',
    'Creative Fatigue': '🎨',
    'Budget Allocation': '💰',
    'Scaling': '📈',
    'Learning Phase': '🎓',
    'Creative Refresh': '✨',
    'Audience Overlap': '👥',
    'Ad Scheduling': '⏰',
  };
  return icons[category] || '📊';
}

export default CampaignHealthDashboard;

