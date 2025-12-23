import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface CampaignHealthProps {
  agentId: string;
  campaignId: string;
  campaignName: string;
}

interface OptimizationInsight {
  type: string;
  priority: string;
  category: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  estimated_savings?: number;
  estimated_revenue_increase?: number;
  confidence: number;
}

const CampaignHealthDashboard: React.FC<CampaignHealthProps> = ({ agentId, campaignId, campaignName }) => {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedInsight, setSelectedInsight] = useState<OptimizationInsight | null>(null);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
        {error}
      </div>
    );
  }

  if (!healthData) return null;

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-blue-600 dark:text-blue-400';
      case 'needs_attention': return 'text-yellow-600 dark:text-yellow-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getHealthBgColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 dark:bg-green-900/30';
      case 'good': return 'bg-blue-100 dark:bg-blue-900/30';
      case 'needs_attention': return 'bg-yellow-100 dark:bg-yellow-900/30';
      case 'critical': return 'bg-red-100 dark:bg-red-900/30';
      default: return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
      medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      low: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Campaign Health: {campaignName}
          </h2>
          <button
            onClick={fetchHealthData}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase">
                Health Score
              </div>
              <div className={`text-xs mt-2 ${getHealthColor(healthData.status)} font-semibold uppercase`}>
                {healthData.status.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                {formatCurrency(healthData.total_potential_savings || 0)}
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Potential Monthly Savings
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {formatCurrency(healthData.total_potential_revenue || 0)}
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Potential Revenue Increase
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {healthData.summary.total_ad_sets}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Ad Sets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {healthData.summary.active_ad_sets}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(healthData.summary.total_spend)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Spend</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(healthData.summary.total_daily_budget)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Daily Budget</div>
          </div>
        </div>
      </div>

      {/* Insights by Category */}
      {healthData.insights_by_category && Object.keys(healthData.insights_by_category).length > 0 && (
        <div className="card p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Optimization Insights
          </h3>
          <div className="space-y-4">
            {Object.entries(healthData.insights_by_category).map(([category, insights]: [string, any]) => (
              <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">{getCategoryIcon(category)}</span>
                  {category}
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    ({insights.length})
                  </span>
                </h4>
                <div className="space-y-2">
                  {insights.map((insight: OptimizationInsight, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => setSelectedInsight(insight)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(insight.priority)}`}>
                              {insight.priority.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {insight.confidence}% confidence
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {insight.title}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {insight.description.substring(0, 100)}...
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          {insight.estimated_savings && (
                            <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                              Save {formatCurrency(insight.estimated_savings)}
                            </div>
                          )}
                          {insight.estimated_revenue_increase && (
                            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
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
          <div className="bg-white dark:bg-dark-lighter rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(selectedInsight.priority)}`}>
                      {selectedInsight.priority.toUpperCase()} PRIORITY
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      {selectedInsight.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedInsight.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📝 Description</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{selectedInsight.description}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">💡 Impact</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{selectedInsight.impact}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Recommendation</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-line">
                    {selectedInsight.recommendation}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {selectedInsight.estimated_savings && (
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(selectedInsight.estimated_savings)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Potential Savings</div>
                    </div>
                  )}
                  {selectedInsight.estimated_revenue_increase && (
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(selectedInsight.estimated_revenue_increase)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Revenue Increase</div>
                    </div>
                  )}
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedInsight.confidence}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Confidence Level</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                >
                  Close
                </button>
                <button
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg"
                >
                  Create Rule
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
    'Creative Fatigue': '🎨',
    'Budget Allocation': '💰',
    'Scaling': '📈',
    'Learning Phase': '🎯',
    'Creative Refresh': '🔄',
    'Audience Overlap': '👥',
    'Ad Scheduling': '⏰',
  };
  return icons[category] || '📊';
}

export default CampaignHealthDashboard;

