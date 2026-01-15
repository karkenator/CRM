import React, { useState } from 'react';
import CampaignHealthDashboard from './CampaignHealthDashboard';
import OptimizationInsightsDashboard from './OptimizationInsightsDashboard';
import CampaignRules from './CampaignRules';

interface UnifiedOptimizationDashboardProps {
  agentId: string;
  campaignId: string;
  campaignName: string;
  campaigns: any[];
  onOpenAIChatbot?: () => void;
}

type TabType = 'analysis' | 'insights' | 'rules';

const UnifiedOptimizationDashboard: React.FC<UnifiedOptimizationDashboardProps> = ({
  agentId,
  campaignId,
  campaignName,
  campaigns,
  onOpenAIChatbot,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('insights');

  const tabs = [
    {
      id: 'analysis' as TabType,
      label: '📊 Analysis Results',
      description: 'Campaign health score and performance insights',
    },
    {
      id: 'insights' as TabType,
      label: '🎯 AI Insights',
      description: 'AI-powered optimization recommendations',
    },
    {
      id: 'rules' as TabType,
      label: '⚙️ Custom Rules',
      description: 'Create and manage automation rules',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🤖 AI Analysis and Optimization
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Complete AI-powered analysis, insights, and automation for: <span className="font-semibold text-gray-900 dark:text-white">{campaignName}</span>
        </p>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="text-center">
                <div className="text-base">{tab.label}</div>
                <div className="text-xs mt-0.5 opacity-75">{tab.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Analysis Results Tab */}
        {activeTab === 'analysis' && (
          <div>
            <CampaignHealthDashboard
              agentId={agentId}
              campaignId={campaignId}
              campaignName={campaignName}
            />
          </div>
        )}

        {/* AI Insights Tab */}
        {activeTab === 'insights' && (
          <div>
            <OptimizationInsightsDashboard
              agentId={agentId}
              campaignId={campaignId}
              campaignName={campaignName}
            />
          </div>
        )}

        {/* Custom Rules Tab */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Custom Automation Rules
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Create rules to automatically manage your ad sets based on performance metrics
                  </p>
                </div>
                {onOpenAIChatbot && (
                  <button
                    onClick={onOpenAIChatbot}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Create Rule with AI
                  </button>
                )}
              </div>

              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                      💡 Pro Tip: Use AI Insights First
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Check the <span className="font-semibold">🎯 AI Insights</span> tab first to see intelligent recommendations. 
                      Then create custom rules here to automate those optimizations!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <CampaignRules
              agentId={agentId}
              campaigns={campaigns}
              refreshToken={0}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedOptimizationDashboard;

