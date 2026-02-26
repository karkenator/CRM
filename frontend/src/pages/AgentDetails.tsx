import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import AIRuleChatbot from '../components/AIRuleChatbot';
import CampaignHealthDashboard from '../components/CampaignHealthDashboard';
import UnifiedOptimizationDashboard from '../components/UnifiedOptimizationDashboard';
import CampaignRules from '../components/CampaignRules';
import {
  Agent, 
  MetaAppInfo, 
  MetaCampaign, 
  MetaAdSet, 
  MetaAd, 
  MetaMetrics 
} from '../types';

type ViewType = 'campaigns' | 'adsets' | 'ads' | 'campaignhealth' | 'optimization' | 'rules';

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

  const getCheckoutRate = (metrics: Record<string, any> | undefined): string => {
    if (!metrics) return '—';
    const actions: any[] = metrics.actions || [];
    const landingPageViews = metrics.landing_page_views
      ? parseInt(metrics.landing_page_views)
      : (actions.find((a) => a.action_type === 'landing_page_view')?.value
          ? parseInt(actions.find((a) => a.action_type === 'landing_page_view').value)
          : 0);
    const initiateCheckout = actions.find((a) => a.action_type === 'initiate_checkout')?.value
      ? parseInt(actions.find((a) => a.action_type === 'initiate_checkout').value)
      : 0;
    if (landingPageViews === 0) return '—';
    return `${((initiateCheckout / landingPageViews) * 100).toFixed(2)}%`;
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
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
        <button onClick={() => navigate('/agents')} className="btn btn-secondary">
          Back to Agents
        </button>
      </div>
    );
  }

  return (
    <div className={showChatbot ? 'pr-96' : ''}>
      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Agents</h1>

      {/* Agent info row */}
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/agents')}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900">{agent?.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Last heartbeat:{' '}
            {agent?.last_heartbeat_at
              ? new Date(agent.last_heartbeat_at).toLocaleString()
              : 'Never'}
          </p>
        </div>
        <span
          className={[
            'inline-flex items-center px-3 py-0.5 rounded text-xs font-semibold',
            agent?.status === 'ONLINE' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700',
          ].join(' ')}
        >
          {agent?.status || 'OFFLINE'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTokenDialog(true)}
            className="btn btn-secondary flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            View Token
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 text-sm"
          >
            {refreshing ? (
              <div className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Meta Connection Status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            <h2 className="text-base font-semibold text-gray-900">Meta API Connection</h2>
          </div>
          <span
            className={[
              'inline-flex items-center px-3 py-0.5 rounded text-xs font-semibold',
              metaApp ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
            ].join(' ')}
          >
            {metaApp ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {metaApp && (
          <div className="space-y-1">
            <p className="text-sm text-gray-500">App ID: <span className="text-gray-900">{metaApp.id}</span></p>
            {metaApp.name && (
              <p className="text-sm text-gray-500">App Name: <span className="text-gray-900">{metaApp.name}</span></p>
            )}
            {metaApp.category && (
              <p className="text-sm text-gray-500">Category: <span className="text-gray-900">{metaApp.category}</span></p>
            )}
          </div>
        )}
      </div>

      {/* Live Metrics */}
      {metaMetrics && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Live Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Spend Today', value: `$${metaMetrics.spend.toFixed(2)}` },
              { label: 'Impressions', value: metaMetrics.impressions.toLocaleString() },
              { label: 'Clicks', value: metaMetrics.clicks.toString() },
              { label: 'CTR', value: `${metaMetrics.ctr}%` },
              { label: 'CPC', value: `$${metaMetrics.cpc.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        {/* Navigation Tabs */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          <button
            onClick={() => setCurrentView('campaigns')}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'campaigns' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            Campaigns
          </button>
          <button
            onClick={() => setCurrentView('adsets')}
            disabled={!selectedCampaign}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'adsets' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100',
              !selectedCampaign ? 'opacity-40 cursor-not-allowed' : '',
            ].join(' ')}
          >
            Ad Sets
          </button>
          <button
            onClick={() => setCurrentView('ads')}
            disabled={!selectedAdSet}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'ads' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100',
              !selectedAdSet ? 'opacity-40 cursor-not-allowed' : '',
            ].join(' ')}
          >
            Ads
          </button>
          <button
            onClick={() => setCurrentView('campaignhealth')}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'campaignhealth' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            Campaign Health
          </button>
          <button
            onClick={() => setCurrentView('optimization')}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'optimization' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            Optimization
          </button>
          <button
            onClick={() => setCurrentView('rules')}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'rules' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            Rules
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        {(currentView === 'campaigns' || currentView === 'adsets' || currentView === 'ads') && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <button
              onClick={handleBackToCampaigns}
              className="text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Campaigns
            </button>
            {selectedCampaign && (
              <>
                <span className="text-gray-300">/</span>
                <button
                  onClick={handleBackToAdSets}
                  className="text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {selectedCampaign.name}
                </button>
              </>
            )}
            {selectedAdSet && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900">{selectedAdSet.name}</span>
              </>
            )}
          </div>
        )}

          {/* Campaigns View */}
          {currentView === 'campaigns' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Campaigns ({metaCampaigns.length})
                </h3>
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <button
                      onClick={() => setDateRangeOpen(!dateRangeOpen)}
                      className="btn btn-secondary flex items-center gap-2 text-sm"
                    >
                      {getDateRangeLabel()}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {dateRangeOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg p-4 z-10">
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
                              <span className="text-sm text-gray-700">{getDateRangeLabel()}</span>
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
                            <span className="text-sm text-gray-700">Custom</span>
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
                </div>
              </div>

              {metaCampaigns.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">
                  No campaigns found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Campaign</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Delivery</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Results</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Impressions</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cost/Result</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount Spent</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Checkout Rate</th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {metaCampaigns.map((campaign, idx) => (
                        <tr
                          key={campaign.id}
                          className={[
                            'transition-colors hover:bg-gray-50',
                            idx < metaCampaigns.length - 1 ? 'border-b border-gray-100' : '',
                          ].join(' ')}
                        >
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleCampaignClick(campaign)}
                              className="text-brand hover:underline font-medium text-left text-sm"
                            >
                              {campaign.name}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={[
                                'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold',
                                campaign.status === 'ACTIVE'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-700',
                              ].join(' ')}
                            >
                              {campaign.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {campaign.effective_status === 'ACTIVE' ? (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <span>Active</span>
                              </div>
                            ) : (
                              'Off'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {campaign.performance_metrics?.actions?.[0]?.value || '—'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {campaign.performance_metrics?.actions?.[0]?.action_type || 'Website purchases'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {campaign.performance_metrics?.impressions?.toLocaleString() || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {campaign.performance_metrics?.cost_per_action?.[0]?.value
                                ? `€${parseFloat(campaign.performance_metrics.cost_per_action[0].value).toFixed(2)}`
                                : '—'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {campaign.performance_metrics?.cost_per_action?.[0]?.action_type || 'Per Purchase'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {campaign.performance_metrics?.spend
                              ? `€${parseFloat(campaign.performance_metrics.spend).toFixed(2)}`
                              : '€0.00'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {getCheckoutRate(campaign.performance_metrics)}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleCampaignClick(campaign)}
                              className="btn btn-secondary text-xs px-3 py-1"
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
                <h3 className="text-sm font-semibold text-gray-900">
                  Ad Sets for "{selectedCampaign.name}" ({campaignAdSets[selectedCampaign.id]?.length || 0})
                </h3>
                <button
                  onClick={() => {
                    setChatbotCampaign(selectedCampaign);
                    setShowChatbot(true);
                  }}
                  className="btn btn-primary flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Create Rule with AI
                </button>
              </div>

              {loadingAdSets.has(selectedCampaign.id) ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                </div>
              ) : (campaignAdSets[selectedCampaign.id]?.length ?? 0) === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">
                  No ad sets found for this campaign.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Ad Set</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Budget</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Results</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Impressions</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cost/Result</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount Spent</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Checkout Rate</th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {campaignAdSets[selectedCampaign.id]?.map((adset, idx) => (
                        <tr
                          key={adset.id}
                          className={[
                            'transition-colors hover:bg-gray-50',
                            idx < (campaignAdSets[selectedCampaign.id]?.length ?? 0) - 1
                              ? 'border-b border-gray-100'
                              : '',
                          ].join(' ')}
                        >
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleAdSetClick(adset)}
                              className="text-brand hover:underline font-medium text-left text-sm"
                            >
                              {adset.name}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <label
                              className={`relative inline-flex items-center ${
                                updatingAdSets.has(adset.id) ? 'cursor-not-allowed' : 'cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={adset.status === 'ACTIVE'}
                                onChange={(e) => {
                                  if (!updatingAdSets.has(adset.id)) {
                                    handleAdSetStatusToggle(adset, e.target.checked ? 'ACTIVE' : 'PAUSED');
                                  }
                                }}
                                disabled={updatingAdSets.has(adset.id)}
                                className="sr-only"
                              />
                              <div
                                className={[
                                  'relative w-10 h-5 rounded-full transition-colors duration-200',
                                  adset.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300',
                                  updatingAdSets.has(adset.id) ? 'opacity-50' : '',
                                ].join(' ')}
                              >
                                <div
                                  className={[
                                    'absolute top-0.5 left-0.5 bg-white rounded-full h-4 w-4 shadow-sm transition-transform duration-200',
                                    adset.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0',
                                  ].join(' ')}
                                />
                              </div>
                              <span
                                className={[
                                  'ml-2 text-xs font-medium',
                                  updatingAdSets.has(adset.id)
                                    ? 'text-gray-400'
                                    : adset.status === 'ACTIVE'
                                    ? 'text-green-600'
                                    : 'text-gray-500',
                                ].join(' ')}
                              >
                                {updatingAdSets.has(adset.id)
                                  ? 'Updating…'
                                  : adset.status === 'ACTIVE'
                                  ? 'Active'
                                  : 'Paused'}
                              </span>
                            </label>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {adset.daily_budget ? `€${Number(adset.daily_budget) / 100}` : '€0.00'}
                            </div>
                            <div className="text-xs text-gray-400">Daily</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {adset.performance_metrics?.actions?.[0]?.value || '—'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {adset.performance_metrics?.actions?.[0]?.action_type || 'Website purchases'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {adset.performance_metrics?.impressions?.toLocaleString() || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {adset.performance_metrics?.cost_per_action?.[0]?.value
                                ? `€${parseFloat(adset.performance_metrics.cost_per_action[0].value).toFixed(2)}`
                                : '—'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {adset.performance_metrics?.cost_per_action?.[0]?.action_type || 'Per Purchase'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {adset.performance_metrics?.spend
                              ? `€${parseFloat(adset.performance_metrics.spend).toFixed(2)}`
                              : '€0.00'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {getCheckoutRate(adset.performance_metrics)}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleAdSetClick(adset)}
                              className="btn btn-secondary text-xs px-3 py-1"
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
                <h3 className="text-sm font-semibold text-gray-900">
                  Ads for "{selectedAdSet.name}" ({adSetAds[selectedAdSet.id]?.length || 0})
                </h3>
              </div>

              {loadingAds.has(selectedAdSet.id) ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                </div>
              ) : (adSetAds[selectedAdSet.id]?.length ?? 0) === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">
                  No ads found for this ad set.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Ad</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Results</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Impressions</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cost/Result</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adSetAds[selectedAdSet.id]?.map((ad, idx) => (
                        <tr
                          key={ad.id}
                          className={[
                            'transition-colors hover:bg-gray-50',
                            idx < (adSetAds[selectedAdSet.id]?.length ?? 0) - 1
                              ? 'border-b border-gray-100'
                              : '',
                          ].join(' ')}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-brand-light rounded flex items-center justify-center text-brand text-xs font-bold shrink-0">
                                AD
                              </div>
                              <span className="text-sm font-medium text-gray-900">{ad.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={[
                                'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold',
                                ad.status === 'ACTIVE'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-700',
                              ].join(' ')}
                            >
                              {ad.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {ad.performance_metrics?.actions?.[0]?.value || '—'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {ad.performance_metrics?.actions?.[0]?.action_type || 'Website Purchase'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {ad.performance_metrics?.impressions?.toLocaleString() || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {ad.performance_metrics?.cost_per_action?.[0]?.value
                                ? `€${parseFloat(ad.performance_metrics.cost_per_action[0].value).toFixed(2)}`
                                : '—'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {ad.performance_metrics?.cost_per_action?.[0]?.action_type || 'Per Purchase'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {ad.performance_metrics?.spend
                              ? `€${parseFloat(ad.performance_metrics.spend).toFixed(2)}`
                              : '€0.00'}
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
          {currentView === 'campaignhealth' && (
            <div>
              {selectedCampaign ? (
                <div>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="mb-4 text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Campaigns
                  </button>
                  <CampaignHealthDashboard
                    agentId={agent?.id || ''}
                    campaignId={selectedCampaign.id}
                    campaignName={selectedCampaign.name}
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Select a campaign</p>
                  <p className="text-sm text-gray-500 mb-4">View detailed health metrics for your campaigns.</p>
                  <div className="grid gap-3">
                    {metaCampaigns.map((campaign) => (
                      <button
                        key={campaign.id}
                        onClick={() => setSelectedCampaign(campaign)}
                        className="bg-gray-50 hover:bg-brand-light border border-gray-200 hover:border-brand rounded-xl p-4 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{campaign.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{campaign.objective} • {campaign.status}</p>
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optimization View */}
          {currentView === 'optimization' && (
            <div>
              {selectedCampaign ? (
                <div>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="mb-4 text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Campaigns
                  </button>
                  <UnifiedOptimizationDashboard
                    agentId={agent?.id || ''}
                    campaignId={selectedCampaign.id}
                    campaignName={selectedCampaign.name}
                    campaigns={metaCampaigns}
                    onOpenAIChatbot={() => {
                      setChatbotCampaign(selectedCampaign);
                      setShowChatbot(true);
                    }}
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Select a campaign</p>
                  <p className="text-sm text-gray-500 mb-4">Get AI-powered analysis, insights, and automation for your campaigns.</p>
                  <div className="grid gap-3">
                    {metaCampaigns.map((campaign) => (
                      <button
                        key={campaign.id}
                        onClick={() => setSelectedCampaign(campaign)}
                        className="bg-gray-50 hover:bg-brand-light border border-gray-200 hover:border-brand rounded-xl p-4 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{campaign.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{campaign.objective} • {campaign.status}</p>
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rules View */}
          {currentView === 'rules' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-900">Automation Rules</p>
                {metaCampaigns.length > 0 && (
                  <button
                    onClick={() => {
                      setChatbotCampaign(metaCampaigns[0]);
                      setShowChatbot(true);
                    }}
                    className="btn btn-primary flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Create Rule with AI
                  </button>
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

      {/* Token Display modal */}
      {showTokenDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowTokenDialog(false)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-5 text-center">Agent Token</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Agent Token</p>
                <p className="text-xs text-gray-500 mb-2">This is your agent's authentication token:</p>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 font-mono text-sm break-all text-center text-gray-900">
                  {agent?.bootstrap?.token || 'Token not available'}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Agent ID</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 font-mono text-sm text-center text-gray-900">
                  {agent?.id || 'ID not available'}
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

            <div className="flex justify-end gap-3 mt-6">
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
              <button onClick={() => setShowTokenDialog(false)} className="btn btn-primary">
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
