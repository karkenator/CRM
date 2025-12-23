import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import CampaignRules from '../components/CampaignRules';
import AIRuleChatbot from '../components/AIRuleChatbot';
import CampaignHealthDashboard from '../components/CampaignHealthDashboard';
import {
  Agent, 
  MetaAppInfo, 
  MetaCampaign, 
  MetaAdSet, 
  MetaAd, 
  MetaMetrics 
} from '../types';

type ViewType = 'campaigns' | 'adsets' | 'ads' | 'health' | 'optimization' | 'rules';

const AgentDetails: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [metaApp, setMetaApp] = useState<MetaAppInfo | null>(null);
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [metaMetrics, setMetaMetrics] = useState<MetaMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState<MetaCampaign | null>(null);
  const [selectedAdSet, setSelectedAdSet] = useState<MetaAdSet | null>(null);
  const [campaignAdSets, setCampaignAdSets] = useState<Record<string, MetaAdSet[]>>({});
  const [adSetAds, setAdSetAds] = useState<Record<string, MetaAd[]>>({});
  const [loadingAdSets, setLoadingAdSets] = useState<Set<string>>(new Set());
  const [loadingAds, setLoadingAds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<string>('last_30d');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [loadingOptimization, setLoadingOptimization] = useState(false);
  const [targetCostPerResult, setTargetCostPerResult] = useState(50);
  const [updatingAdSets, setUpdatingAdSets] = useState<Set<string>>(new Set());
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotCampaign, setChatbotCampaign] = useState<MetaCampaign | null>(null);
  const [rulesRefreshToken, setRulesRefreshToken] = useState(0);

  useEffect(() => {
    if (agentId) {
      fetchAgentData();
    }
  }, [agentId]);

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      setError('');

      const agentRes = await apiService.getAgent(agentId!);
      setAgent(agentRes.data);

      await fetchMetaData(agentRes.data.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch agent data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetaData = async (agentId?: string) => {
    const currentAgentId = agentId || agent?.id;
    if (!currentAgentId) {
      console.error('No agent ID available for Meta data fetch');
      return;
    }

    try {
      await apiService.testMetaConnection(currentAgentId);

      try {
        const appRes = await apiService.getMetaAccount(currentAgentId);
        setMetaApp(appRes.data.data);
      } catch (err) {
        console.warn('Failed to fetch Meta app info:', err);
      }

      try {
        const campaignsRes = await apiService.getMetaCampaigns(currentAgentId);
        setMetaCampaigns(campaignsRes.data.data || []);
      } catch (err) {
        console.warn('Failed to fetch Meta campaigns:', err);
      }

      try {
        const insightsRes = await apiService.getMetaInsights(currentAgentId);
        const insights = insightsRes.data.data || {};
        setMetaMetrics({
          spend: parseFloat(insights.spend || 0),
          impressions: parseInt(insights.impressions || 0),
          clicks: parseInt(insights.clicks || 0),
          ctr: parseFloat(insights.ctr || 0),
          cpc: parseFloat(insights.cpc || 0),
        });
      } catch (err) {
        console.warn('Failed to fetch Meta insights:', err);
        setMetaMetrics({
          spend: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          cpc: 0,
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch Meta data:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMetaData(agent?.id);
    setRefreshing(false);
  };

  const handleCampaignClick = async (campaign: MetaCampaign) => {
    setSelectedCampaign(campaign);
    setCurrentView('adsets');
    
    if (!campaignAdSets[campaign.id]) {
      setLoadingAdSets(prev => new Set(prev).add(campaign.id));
      try {
        const response = await apiService.getCampaignAdSets(agent?.id!, campaign.id);
        setCampaignAdSets(prev => ({
          ...prev,
          [campaign.id]: response.data.ad_sets || []
        }));
      } catch (err) {
        console.error('Failed to fetch ad sets:', err);
      } finally {
        setLoadingAdSets(prev => {
          const newSet = new Set(prev);
          newSet.delete(campaign.id);
          return newSet;
        });
      }
    }
  };

  const handleAdSetClick = async (adset: MetaAdSet) => {
    setSelectedAdSet(adset);
    setCurrentView('ads');
    
    if (!adSetAds[adset.id]) {
      setLoadingAds(prev => new Set(prev).add(adset.id));
      try {
        const response = await apiService.getAdSetAds(agent?.id!, adset.id);
        setAdSetAds(prev => ({
          ...prev,
          [adset.id]: response.data.ads || []
        }));
      } catch (err) {
        console.error('Failed to fetch ads:', err);
      } finally {
        setLoadingAds(prev => {
          const newSet = new Set(prev);
          newSet.delete(adset.id);
          return newSet;
        });
      }
    }
  };

  const handleBackToCampaigns = () => {
    setCurrentView('campaigns');
    setSelectedCampaign(null);
    setSelectedAdSet(null);
  };

  const handleBackToAdSets = () => {
    setCurrentView('adsets');
    setSelectedAdSet(null);
  };

  const handleAdSetStatusToggle = async (adset: MetaAdSet, newStatus: 'ACTIVE' | 'PAUSED') => {
    if (!agent?.id) {
      alert('Agent ID is missing');
      return;
    }
    
    const oldStatus = adset.status;
    setUpdatingAdSets(prev => new Set(prev).add(adset.id));
    
    // Optimistically update the UI
    if (selectedCampaign) {
      setCampaignAdSets(prev => ({
        ...prev,
        [selectedCampaign.id]: (prev[selectedCampaign.id] || []).map(a => 
          a.id === adset.id ? { ...a, status: newStatus } : a
        )
      }));
    }
    
    try {
      console.log('Updating ad set status:', { agentId: agent.id, adsetId: adset.id, newStatus });
      const updateResponse = await apiService.updateAdSetStatus(agent.id, adset.id, newStatus);
      console.log('Update response:', updateResponse);
      
      // Refresh ad sets to get updated data
      if (selectedCampaign) {
        try {
          const response = await apiService.getCampaignAdSets(agent.id, selectedCampaign.id);
          setCampaignAdSets(prev => ({
            ...prev,
            [selectedCampaign.id]: response.data.ad_sets || []
          }));
        } catch (refreshErr: any) {
          console.error('Failed to refresh ad sets after update:', refreshErr);
          // Update succeeded but refresh failed - keep the optimistic update
        }
      }
    } catch (err: any) {
      console.error('Failed to update ad set status:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
      
      // Revert optimistic update on error
      if (selectedCampaign) {
        setCampaignAdSets(prev => ({
          ...prev,
          [selectedCampaign.id]: (prev[selectedCampaign.id] || []).map(a => 
            a.id === adset.id ? { ...a, status: oldStatus } : a
          )
        }));
      }
      
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update ad set status';
      alert(`Error: ${errorMessage}`);
    } finally {
      setUpdatingAdSets(prev => {
        const newSet = new Set(prev);
        newSet.delete(adset.id);
        return newSet;
      });
    }
  };

  const fetchOptimizationData = async (campaignId: string) => {
    if (!agent?.id) return;
    
    setLoadingOptimization(true);
    try {
      const response = await apiService.getCampaignOptimization(agent.id, campaignId);
      setOptimizationData(response.data.data);
    } catch (err) {
      console.error('Failed to fetch optimization data:', err);
    } finally {
      setLoadingOptimization(false);
    }
  };

  const getDateRangeLabel = () => {
    if (isCustomRange && customStartDate && customEndDate) {
      return `${customStartDate} - ${customEndDate}`;
    }
    
    const labels: { [key: string]: string } = {
      'today': 'Today',
      'yesterday': 'Yesterday',
      'last_7d': 'Last 7 days',
      'last_14d': 'Last 14 days',
      'last_28d': 'Last 28 days',
      'last_30d': 'Last 30 days',
      'this_week': 'This week',
      'last_week': 'Last week',
      'this_month': 'This month',
      'last_month': 'Last month',
      'maximum': 'Maximum',
      'custom': 'Custom'
    };
    
    return labels[dateRange] || 'Last 30 days';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
        <button onClick={() => navigate('/agents')} className="btn btn-secondary">
          Back to Agents
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/agents')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-lighter"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{agent?.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              agent?.status === 'ONLINE'
                ? 'bg-primary text-black'
                : 'bg-red-500 text-white'
            }`}>
              {agent?.status || 'OFFLINE'}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Last heartbeat: {agent?.last_heartbeat_at 
                ? new Date(agent.last_heartbeat_at).toLocaleString()
                : 'Never'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTokenDialog(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            View Token
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2"
          >
            {refreshing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Meta Connection Status */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Meta API Connection</h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2 ${
            metaApp ? 'bg-primary text-black' : 'bg-red-500 text-white'
          }`}>
            {metaApp ? 'Connected' : 'Disconnected'}
          </span>
        </div>
          {metaApp && (
          <div className="space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">App ID: {metaApp.id}</p>
              {metaApp.name && (
              <p className="text-sm text-gray-600 dark:text-gray-400">App Name: {metaApp.name}</p>
              )}
              {metaApp.category && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Category: {metaApp.category}</p>
              )}
          </div>
          )}
      </div>

      {/* Metrics */}
      {metaMetrics && (
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Live Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                  ${metaMetrics.spend.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Spend Today</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                  {metaMetrics.impressions.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Impressions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                  {metaMetrics.clicks}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Clicks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                  {metaMetrics.ctr}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">CTR</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                  ${metaMetrics.cpc.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">CPC</div>
            </div>
          </div>
        </div>
      )}

      {/* Meta Ads Manager-like Interface */}
      <div className="card p-6 mb-6">
          {/* Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-800 mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
                onClick={() => setCurrentView('campaigns')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                currentView === 'campaigns'
                  ? 'bg-primary text-black border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              >
                Campaigns
            </button>
            <button
                onClick={() => setCurrentView('adsets')}
                disabled={!selectedCampaign}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                currentView === 'adsets'
                  ? 'bg-primary text-black border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              } ${!selectedCampaign ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Ad Sets
            </button>
            <button
                onClick={() => setCurrentView('ads')}
                disabled={!selectedAdSet}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                currentView === 'ads'
                  ? 'bg-primary text-black border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              } ${!selectedAdSet ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Ads
            </button>
            <button
                onClick={() => setCurrentView('health')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                currentView === 'health'
                  ? 'bg-primary text-black border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Campaign Health
            </button>
            <button
                onClick={() => setCurrentView('optimization')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                currentView === 'optimization'
                  ? 'bg-primary text-black border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Optimization
            </button>
            <button
                onClick={() => setCurrentView('rules')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                currentView === 'rules'
                  ? 'bg-primary text-black border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              >
                Rules
            </button>
          </div>
        </div>

          {/* Breadcrumb Navigation */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <button
                onClick={handleBackToCampaigns}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
              >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
                Campaigns
          </button>
              {selectedCampaign && (
            <>
              <span className="text-gray-400">/</span>
              <button
                  onClick={handleBackToAdSets}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                >
                  {selectedCampaign.name}
              </button>
            </>
              )}
              {selectedAdSet && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 dark:text-white">{selectedAdSet.name}</span>
            </>
          )}
        </div>

          {/* Campaigns View */}
          {currentView === 'campaigns' && (
            <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Campaigns ({metaCampaigns.length})
              </h3>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <button
                    onClick={() => setDateRangeOpen(!dateRangeOpen)}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    {getDateRangeLabel()}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dateRangeOpen && (
                    <div className="absolute right-0 mt-2 w-64 card p-4 z-10">
                      <div className="space-y-2">
                        {['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month', 'maximum'].map((range) => (
                          <label key={range} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="dateRange"
                              value={range}
                              checked={dateRange === range}
                              onChange={(e) => {
                                setDateRange(e.target.value);
                                setDateRangeOpen(false);
                                fetchMetaData(agent?.id);
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{getDateRangeLabel()}</span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="dateRange"
                            value="custom"
                            checked={isCustomRange}
                            onChange={(e) => setIsCustomRange(e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Custom</span>
                        </label>
                        {isCustomRange && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="input text-sm"
                            />
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="input text-sm"
                            />
                            <button
                              onClick={() => {
                                if (customStartDate && customEndDate) {
                                  fetchMetaData(agent?.id);
                                  setDateRangeOpen(false);
                                }
                              }}
                              className="btn btn-primary text-sm px-3 py-1"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button className="btn btn-primary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                    Create Campaign
                </button>
              </div>
            </div>
              
              {metaCampaigns.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No campaigns found. Create your first campaign to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Campaign</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Delivery</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Results</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Impressions</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Cost per result</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Amount spent</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                      {metaCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-dark-lighter">
                        <td className="py-3 px-4">
                          <button
                              onClick={() => handleCampaignClick(campaign)}
                            className="text-primary hover:underline font-medium text-left"
                            >
                              {campaign.name}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            campaign.status === 'ACTIVE'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {campaign.effective_status === 'ACTIVE' ? (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Active</span>
                            </div>
                          ) : (
                            'Off'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                              {campaign.performance_metrics?.actions?.[0]?.value || '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                              {campaign.performance_metrics?.actions?.[0]?.action_type || 'Website purchases'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {campaign.performance_metrics?.impressions?.toLocaleString() || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                              {campaign.performance_metrics?.cost_per_action?.[0]?.value ? 
                                `€${parseFloat(campaign.performance_metrics.cost_per_action[0].value).toFixed(2)}` : '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                              {campaign.performance_metrics?.cost_per_action?.[0]?.action_type || 'Per Purchase'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                              {campaign.performance_metrics?.spend ? 
                                `€${parseFloat(campaign.performance_metrics.spend).toFixed(2)}` : '€0.00'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                    onClick={() => handleCampaignClick(campaign)}
                            className="btn btn-secondary text-sm px-3 py-1"
                  >
                    View Ad Sets
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}

          {/* Ad Sets View */}
          {currentView === 'adsets' && selectedCampaign && (
            <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Ad Sets for "{selectedCampaign.name}" ({campaignAdSets[selectedCampaign.id]?.length || 0})
              </h3>
              <button
                onClick={() => {
                  setChatbotCampaign(selectedCampaign);
                  setShowChatbot(true);
                }}
                className="btn btn-primary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Create Rule with AI
              </button>
            </div>
              
              {loadingAdSets.has(selectedCampaign.id) ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
              ) : campaignAdSets[selectedCampaign.id]?.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No ad sets found for this campaign.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Ad Set</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Budget</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Results</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Impressions</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Cost per result</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Amount spent</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                      {campaignAdSets[selectedCampaign.id]?.map((adset) => (
                      <tr key={adset.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-dark-lighter">
                        <td className="py-3 px-4">
                          <button
                              onClick={() => handleAdSetClick(adset)}
                            className="text-primary hover:underline font-medium text-left"
                            >
                              {adset.name}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <label className={`relative inline-flex items-center ${updatingAdSets.has(adset.id) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={adset.status === 'ACTIVE'}
                              onChange={(e) => {
                                if (!updatingAdSets.has(adset.id)) {
                                  const newStatus = e.target.checked ? 'ACTIVE' : 'PAUSED';
                                  handleAdSetStatusToggle(adset, newStatus);
                                }
                              }}
                              disabled={updatingAdSets.has(adset.id)}
                              className="sr-only"
                            />
                            <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                              adset.status === 'ACTIVE'
                                ? 'bg-green-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                            } ${updatingAdSets.has(adset.id) ? 'opacity-50' : ''}`}>
                              <div className={`absolute top-0.5 left-0.5 bg-white rounded-full h-5 w-5 shadow-sm transition-transform duration-200 ease-in-out ${
                                adset.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'
                              }`}></div>
                            </div>
                            <span className={`ml-3 text-sm font-medium ${
                              updatingAdSets.has(adset.id)
                                ? 'text-gray-400 dark:text-gray-500'
                                : adset.status === 'ACTIVE'
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {updatingAdSets.has(adset.id) ? 'Updating...' : adset.status === 'ACTIVE' ? 'Active' : 'Paused'}
                            </span>
                          </label>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                              {adset.daily_budget ? `€${parseInt(adset.daily_budget) / 100}` : '€0.00'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Daily</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                              {adset.performance_metrics?.actions?.[0]?.value || '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                              {adset.performance_metrics?.actions?.[0]?.action_type || 'Website purchases'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {adset.performance_metrics?.impressions?.toLocaleString() || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                              {adset.performance_metrics?.cost_per_action?.[0]?.value ? 
                                `€${parseFloat(adset.performance_metrics.cost_per_action[0].value).toFixed(2)}` : '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                              {adset.performance_metrics?.cost_per_action?.[0]?.action_type || 'Per Purchase'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                              {adset.performance_metrics?.spend ? 
                                `€${parseFloat(adset.performance_metrics.spend).toFixed(2)}` : '€0.00'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                    onClick={() => handleAdSetClick(adset)}
                            className="btn btn-secondary text-sm px-3 py-1"
                  >
                    View Ads
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}

          {/* Ads View */}
          {currentView === 'ads' && selectedAdSet && (
            <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Ads for "{selectedAdSet.name}" ({adSetAds[selectedAdSet.id]?.length || 0})
              </h3>
            </div>
              
              {loadingAds.has(selectedAdSet.id) ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
              ) : adSetAds[selectedAdSet.id]?.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No ads found for this ad set.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Ad</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Results</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Impressions</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Cost per result</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Amount spent</th>
                    </tr>
                  </thead>
                  <tbody>
                      {adSetAds[selectedAdSet.id]?.map((ad) => (
                      <tr key={ad.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-dark-lighter">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center text-white text-xs font-bold">
                              AD
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{ad.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            ad.status === 'ACTIVE'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {ad.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                              {ad.performance_metrics?.actions?.[0]?.value || '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                              {ad.performance_metrics?.actions?.[0]?.action_type || 'Website Purchase'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {ad.performance_metrics?.impressions?.toLocaleString() || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                              {ad.performance_metrics?.cost_per_action?.[0]?.value ? 
                                `€${parseFloat(ad.performance_metrics.cost_per_action[0].value).toFixed(2)}` : '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                              {ad.performance_metrics?.cost_per_action?.[0]?.action_type || 'Per Purchase'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                              {ad.performance_metrics?.spend ? 
                                `€${parseFloat(ad.performance_metrics.spend).toFixed(2)}` : '€0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}

          {/* Campaign Health View */}
          {currentView === 'health' && (
            <div>
              {selectedCampaign ? (
                <div>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="mb-4 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    ← Back to Campaigns
                  </button>
                  <CampaignHealthDashboard
                    agentId={agent?.id || ''}
                    campaignId={selectedCampaign.id}
                    campaignName={selectedCampaign.name}
                  />
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Select a Campaign to Analyze
                  </h3>
                  <div className="grid gap-4">
                    {metaCampaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        onClick={() => setSelectedCampaign(campaign)}
                        className="card p-4 hover:shadow-lg cursor-pointer transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {campaign.name}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {campaign.objective} • {campaign.status}
                            </div>
                          </div>
                          <div className="text-primary">
                            View Health →
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optimization View */}
          {currentView === 'optimization' && (
            <>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Campaign Optimization Dashboard</h3>
            
            <div className="card p-6 mb-6">
              <h4 className="text-md font-semibold mb-4 text-gray-900 dark:text-white">Target Configuration</h4>
              <div className="flex gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Target Cost Per Result (€)</label>
                  <input
                      type="number"
                      value={targetCostPerResult}
                      onChange={(e) => setTargetCostPerResult(parseFloat(e.target.value) || 0)}
                    className="input w-48"
                    />
                </div>
                <button
                      onClick={() => {
                        if (metaCampaigns.length > 0) {
                          fetchOptimizationData(metaCampaigns[0].id);
                        }
                      }}
                      disabled={loadingOptimization || metaCampaigns.length === 0}
                  className="btn btn-primary mt-6"
                    >
                      {loadingOptimization ? 'Loading...' : 'Analyze Campaigns'}
                </button>
              </div>
            </div>

            <div className="card p-6 mb-6">
              <h4 className="text-md font-semibold mb-4 text-gray-900 dark:text-white">Cost Per Result Monitor</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Monitor cost per acquisition vs your target cost
              </p>
                  
                  {optimizationData ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Campaign</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Cost Per Result</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Target</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                          {metaCampaigns.map((campaign) => {
                            const campaignInsights = optimizationData.campaign_insights || {};
                            const costPerResult = campaignInsights.cost_per_action_type?.[0]?.value 
                              ? parseFloat(campaignInsights.cost_per_action_type[0].value) 
                              : 0;
                            const isAboveTarget = costPerResult > targetCostPerResult;
                            
                            return (
                          <tr key={campaign.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{campaign.name}</td>
                            <td className={`py-3 px-4 font-medium ${
                              isAboveTarget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            }`}>
                                    €{costPerResult.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-gray-900 dark:text-white">€{targetCostPerResult}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isAboveTarget
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              }`}>
                                {isAboveTarget ? 'Above Target' : 'Within Target'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                    disabled={!isAboveTarget}
                                className={`btn btn-secondary text-sm px-3 py-1 ${!isAboveTarget ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {isAboveTarget ? 'Pause Creatives' : 'Optimize'}
                              </button>
                            </td>
                          </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg">
                      Click "Analyze Campaigns" to load optimization data
                </div>
              )}
            </div>

            <div className="card p-6">
              <h4 className="text-md font-semibold mb-4 text-gray-900 dark:text-white">Waste Detection</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Identify demographic and location waste from real Meta data
              </p>
                  
                  {optimizationData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card p-4">
                    <h5 className="font-medium mb-2 text-gray-900 dark:text-white">Demographic Waste</h5>
                          {optimizationData.demographic_waste?.length > 0 ? (
                      <div className="space-y-2">
                              {optimizationData.demographic_waste.slice(0, 5).map((waste: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{waste.demographic}</span>
                            <span className="text-red-600 dark:text-red-400">
                                    {(waste.conversion_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-green-600 dark:text-green-400">No demographic waste detected</p>
                    )}
                  </div>
                  
                  <div className="card p-4">
                    <h5 className="font-medium mb-2 text-gray-900 dark:text-white">Location Waste</h5>
                          {optimizationData.location_waste?.length > 0 ? (
                      <div className="space-y-2">
                              {optimizationData.location_waste.slice(0, 5).map((waste: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{waste.location}</span>
                            <span className="text-red-600 dark:text-red-400">
                                    {(waste.conversion_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                              ))}
                      </div>
                          ) : (
                      <p className="text-sm text-green-600 dark:text-green-400">No location waste detected</p>
                          )}
                  </div>
                </div>
                  ) : (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg">
                      Click "Analyze Campaigns" to load waste detection data
                </div>
              )}
            </div>
            </>
          )}

          {/* Rules View */}
          {currentView === 'rules' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Campaign Rules
                </h3>
                {metaCampaigns.length > 0 && (
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedCampaign?.id || ''}
                      onChange={(e) => {
                        const campaign = metaCampaigns.find(c => c.id === e.target.value);
                        if (campaign) {
                          setSelectedCampaign(campaign);
                        }
                      }}
                      className="input"
                    >
                      <option value="">Select a campaign...</option>
                      {metaCampaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const campaignToUse = selectedCampaign || metaCampaigns[0];
                        if (campaignToUse) {
                          setChatbotCampaign(campaignToUse);
                          setShowChatbot(true);
                        } else {
                          alert('Please select a campaign first');
                        }
                      }}
                      disabled={!selectedCampaign && metaCampaigns.length === 0}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Create Rule with AI
                    </button>
                  </div>
                )}
              </div>
              <CampaignRules
                agentId={agent?.id || ''}
                campaigns={metaCampaigns}
                refreshToken={rulesRefreshToken}
              />
            </div>
          )}
      </div>

      {/* AI Rule Chatbot Modal */}
      {showChatbot && chatbotCampaign && agent && (
        <AIRuleChatbot
          isOpen={showChatbot}
          onClose={() => {
            setShowChatbot(false);
            setChatbotCampaign(null);
          }}
          agentId={agent.id}
          campaignId={chatbotCampaign.id}
          campaignName={chatbotCampaign.name}
          onRuleCreated={() => {
            setRulesRefreshToken((prev) => prev + 1);
          }}
        />
      )}

      {/* Token Display Dialog */}
      {showTokenDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowTokenDialog(false)}>
          <div className="card p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white text-center">Agent Token</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Agent Token</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  This is your agent's authentication token:
                </p>
                <div className="p-4 bg-gray-100 dark:bg-dark-lighter rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-sm break-all text-center">
              {agent?.bootstrap?.token || 'Token not available'}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Agent ID</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Your agent's unique identifier:
                </p>
                <div className="p-3 bg-gray-100 dark:bg-dark-lighter rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-sm text-center">
              {agent?.id || 'ID not available'}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Configuration File</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Update your agent's <code className="bg-gray-100 dark:bg-dark-lighter px-1 rounded">meta_config.json</code> file:
                </p>
                <div className="p-4 bg-gray-100 dark:bg-dark-lighter rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-xs overflow-auto max-h-64">
              {`{
  "meta_api": {
    "app_id": "YOUR_APP_ID",
    "app_secret": "YOUR_APP_SECRET",
    "access_token": "YOUR_ACCESS_TOKEN",
    "ad_account_id": "YOUR_AD_ACCOUNT_ID",
    "base_url": "https://graph.facebook.com/v20.0",
    "timeout": 30
  },
  "crm": {
    "base_url": "http://localhost:8000"
  },
  "agent": {
    "id": "${agent?.id || 'YOUR_AGENT_ID'}",
    "token": "${agent?.bootstrap?.token || 'YOUR_TOKEN_HERE'}"
  }
}`}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
            onClick={() => {
              if (agent?.bootstrap?.token) {
                navigator.clipboard.writeText(agent.bootstrap.token);
              }
            }}
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

export default AgentDetails;
