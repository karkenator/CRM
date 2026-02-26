import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { 
  GeneratedRule, 
  RulePreview, 
  AdSetRuleCreate, 
  CampaignAnalysis,
  OptimizationSuggestion,
  RuleSchema,
} from '../types';

interface AIRuleChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  campaignId: string;
  campaignName: string;
  onRuleCreated?: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'analysis' | 'suggestion';
  content: string;
  timestamp: Date;
  data?: any;
}

const AIRuleChatbot: React.FC<AIRuleChatbotProps> = ({
  isOpen,
  onClose,
  agentId,
  campaignId,
  campaignName,
  onRuleCreated,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRule, setGeneratedRule] = useState<GeneratedRule | null>(null);
  const [preview, setPreview] = useState<RulePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [executionMode, setExecutionMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic');
  const [analysis, setAnalysis] = useState<CampaignAnalysis | null>(null);
  const [analyzingCampaign, setAnalyzingCampaign] = useState(false);
  const [schema, setSchema] = useState<RuleSchema | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setMessages([{
        id: '1',
        type: 'system',
        content: `👋 Hi! I'm your AI assistant for optimizing campaign "${campaignName}".

**What I can do:**
• Create rules using natural language (e.g., "Pause ad sets with cost per conversion above $50")
• Analyze campaign performance and suggest optimizations
• Handle complex conditions with date ranges, regex patterns, and statistical comparisons

**Quick commands:**
• Type "analyze" to get a full campaign analysis
• Switch to "Advanced" mode for more operators and fields

How can I help you today?`,
        timestamp: new Date(),
      }]);
      setGeneratedRule(null);
      setPreview(null);
      setAnalysis(null);
      
      // Load schema
      loadSchema();
    }
  }, [isOpen, campaignName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSchema = async () => {
    try {
      const response = await apiService.getRuleSchema(mode);
      setSchema(response.data);
    } catch (error) {
      console.error('Failed to load schema:', error);
    }
  };

  useEffect(() => {
    loadSchema();
  }, [mode]);

  const handleAnalyze = async () => {
    setAnalyzingCampaign(true);
    setActiveTab('analysis');
    
    const analysisMsg: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: '🔍 Analyzing campaign performance...',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, analysisMsg]);

    try {
      const response = await apiService.analyzeCampaign(agentId, campaignId);
      setAnalysis(response.data);
      
      // Add analysis summary message
      const summaryMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'analysis',
        content: `📊 **Campaign Analysis Complete**

**Summary:**
• Total Ad Sets: ${response.data.summary.total_ad_sets} (${response.data.summary.active_ad_sets} active, ${response.data.summary.paused_ad_sets} paused)
• Total Spend: $${response.data.summary.total_spend.toFixed(2)}
• Total Conversions: ${response.data.summary.total_conversions}
• Average Cost/Conversion: $${response.data.summary.average_cost_per_conversion.toFixed(2)}
• Average CTR: ${response.data.summary.average_ctr.toFixed(2)}%
• ROAS: ${response.data.summary.average_roas.toFixed(2)}

**Insights:**
${response.data.performance_insights.map((i: string) => `• ${i}`).join('\n')}

${response.data.optimization_opportunities.length > 0 
  ? `\n**🎯 ${response.data.optimization_opportunities.length} Optimization Opportunities Found!**\nClick on a suggestion below to create a rule.`
  : ''}`,
        timestamp: new Date(),
        data: response.data,
      };
      setMessages(prev => [...prev.slice(0, -1), summaryMsg]);
    } catch (error: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `❌ Failed to analyze campaign: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev.slice(0, -1), errorMsg]);
    } finally {
      setAnalyzingCampaign(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userInput = input.trim().toLowerCase();
    
    // Handle special commands
    if (userInput === 'analyze' || userInput === 'analysis') {
      setInput('');
      await handleAnalyze();
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setGeneratedRule(null);
    setPreview(null);

    try {
      const response = await apiService.generateRule(input.trim(), agentId, campaignId, mode);
      const rule = response.data;

      setGeneratedRule(rule);

      // Format conditions for display
      const conditionsList = rule.filter_config.conditions?.map(c => {
        let condStr = `${c.field} ${c.operator} ${c.value}`;
        if (c.value2 !== undefined) condStr += ` and ${c.value2}`;
        if (c.time_window) condStr += ` (${c.time_window})`;
        return condStr;
      }).join('\n• ') || '';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `✅ **Generated Rule: ${rule.rule_name}**

${rule.description || ''}

**Action:** ${rule.action.type === 'PAUSE' ? '⏸️ Pause' : '▶️ Activate'} matching ad sets

**Conditions:**
• ${conditionsList}

${rule.explanation ? `\n**Reasoning:** ${rule.explanation}` : ''}`,
        timestamp: new Date(),
        data: rule,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-preview
      try {
        const previewResponse = await apiService.previewRule(agentId, campaignId, rule.filter_config);
        setPreview(previewResponse.data);
        
        const previewMsg: Message = {
          id: (Date.now() + 2).toString(),
          type: 'system',
          content: `📋 **Preview:** ${previewResponse.data.matching_ad_sets} out of ${previewResponse.data.total_ad_sets} ad sets match this rule.`,
          timestamp: new Date(),
          data: previewResponse.data,
        };
        setMessages(prev => [...prev, previewMsg]);
      } catch (error: any) {
        console.error('Preview error:', error);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error.response?.data?.detail || error.message || 'Unknown error'}. 

Please try rephrasing your request or check if the OpenAI API key is configured.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = async (suggestion: OptimizationSuggestion) => {
    if (!suggestion.suggested_rule) return;
    
    setGeneratedRule({
      ...suggestion.suggested_rule,
      agent_id: agentId,
      campaign_id: campaignId,
    });
    setActiveTab('chat');
    
    const msg: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content: `📝 Applied suggestion: **${suggestion.title}**

${suggestion.description}

${suggestion.potential_savings ? `💰 Potential savings: $${suggestion.potential_savings.toFixed(2)}` : ''}

You can preview and save this rule below.`,
      timestamp: new Date(),
      data: suggestion.suggested_rule,
    };
    setMessages(prev => [...prev, msg]);

    // Auto-preview
    if (suggestion.suggested_rule.filter_config) {
      try {
        const previewResponse = await apiService.previewRule(agentId, campaignId, suggestion.suggested_rule.filter_config);
        setPreview(previewResponse.data);
      } catch (error) {
        console.error('Preview error:', error);
      }
    }
  };

  const handlePreview = async () => {
    if (!generatedRule) return;

    setLoading(true);
    try {
      const response = await apiService.previewRule(agentId, campaignId, generatedRule.filter_config);
      setPreview(response.data);
      
      const msg: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `📋 **Updated Preview:** ${response.data.matching_ad_sets} out of ${response.data.total_ad_sets} ad sets match.`,
        timestamp: new Date(),
        data: response.data,
      };
      setMessages(prev => [...prev, msg]);
    } catch (error: any) {
      alert(`Failed to preview rule: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (shouldExecute: boolean = false) => {
    if (!generatedRule) return;

    setSaving(true);
    try {
      const ruleToCreate: AdSetRuleCreate = {
        agent_id: agentId,
        campaign_id: campaignId,
        rule_name: generatedRule.rule_name,
        description: generatedRule.description,
        filter_config: generatedRule.filter_config,
        action: generatedRule.action,
        execution_mode: executionMode,
        execute_immediately: shouldExecute,
      };

      const response = await apiService.createAdSetRule(ruleToCreate);
      const result = response.data as any;

      // Build success message based on what happened
      let successContent = `🎉 Rule "${generatedRule.rule_name}" created successfully!\n\n`;

      // Show Meta sync status first
      if (result.meta_rule_result?.status === 'success') {
        successContent += `✅ **Synced to Meta:** Rule is now active in Meta Ads Manager.\n`;
      } else if (result.meta_rule_result?.status === 'warning') {
        successContent += `⚠️ **Meta:** ${result.meta_rule_result.message}\n`;
      } else if (result.meta_rule_result?.error) {
        successContent += `⚠️ **Meta sync failed:** ${result.meta_rule_result.error}\n`;
      }

      // Show execution results if executed immediately
      if (shouldExecute && result.execution_result) {
        if (result.execution_result.successful_count > 0) {
          successContent += `\n⚡ **Executed now:** ${result.execution_result.action || generatedRule.action.type} applied to ${result.execution_result.successful_count} ad set(s).`;
        }
        if (result.execution_result.failed_count > 0) {
          successContent += `\n⚠️ ${result.execution_result.failed_count} ad set(s) failed to update.`;
        }
        if (result.execution_result.matched_count === 0) {
          successContent += `\nℹ️ No ad sets currently match this rule.`;
        }
      }

      // Show scheduling info
      if (!shouldExecute) {
        successContent += executionMode === 'AUTO'
          ? '\n\n⏰ Rule will run automatically on both CRM and Meta.'
          : '\n\n👆 You can run it manually from the Rules tab.';
      }

      const successMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: successContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, successMessage]);
      setGeneratedRule(null);
      setPreview(null);
      setInput('');

      if (onRuleCreated) {
        onRuleCreated();
      }

      // Close after a delay
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error: any) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `❌ Failed to create rule: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-96 flex flex-col bg-white shadow-2xl border-l border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white leading-tight">AI Rule Assistant</h2>
            <p className="text-xs text-white/70 truncate">Campaign: {campaignName}</p>
          </div>

          <div className="flex items-center gap-2 ml-3 shrink-0">
            {/* Mode Toggle */}
            <div className="flex bg-white/20 rounded p-0.5">
              <button
                onClick={() => setMode('basic')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  mode === 'basic' ? 'bg-white text-blue-600' : 'text-white hover:bg-white/10'
                }`}
              >
                Basic
              </button>
              <button
                onClick={() => setMode('advanced')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  mode === 'advanced' ? 'bg-white text-purple-600' : 'text-white hover:bg-white/10'
                }`}
              >
                Adv
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => {
              setActiveTab('analysis');
              if (!analysis && !analyzingCampaign) {
                handleAnalyze();
              }
            }}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'analysis'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            📊 Analysis {analysis && '✓'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Chat Panel */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl p-3 text-sm ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : message.type === 'system'
                          ? 'bg-gray-100 text-gray-800'
                          : message.type === 'analysis'
                          ? 'bg-purple-50 text-gray-800 border border-purple-200'
                          : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                      }`}
                    >
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                        {message.content}
                      </div>
                      <p className="text-xs mt-2 opacity-60">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-200">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        <span className="ml-2 text-sm text-gray-500">
                          {mode === 'advanced' ? 'Creating advanced rule...' : 'Thinking...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Card */}
                {preview && preview.matched_ad_sets.length > 0 && (
                  <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">
                      Matching Ad Sets ({preview.matching_ad_sets}/{preview.total_ad_sets})
                    </h4>
                    <div className="max-h-32 overflow-y-auto">
                      <ul className="text-sm space-y-1">
                        {preview.matched_ad_sets.slice(0, 8).map((adSet) => (
                          <li key={adSet.id} className="text-green-700 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${adSet.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            {adSet.name}
                          </li>
                        ))}
                        {preview.matched_ad_sets.length > 8 && (
                          <li className="text-green-600 italic">
                            ... and {preview.matched_ad_sets.length - 8} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Generated Rule Actions */}
              {generatedRule && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Execution Mode:
                    </span>
                    <div className="flex bg-gray-200 rounded-lg p-1">
                      <button
                        onClick={() => setExecutionMode('MANUAL')}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                          executionMode === 'MANUAL'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600'
                        }`}
                      >
                        Manual
                      </button>
                      <button
                        onClick={() => setExecutionMode('AUTO')}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                          executionMode === 'AUTO'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600'
                        }`}
                      >
                        Auto (5 min)
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePreview}
                      disabled={loading}
                      className="btn btn-secondary"
                    >
                      🔍 Preview
                    </button>
                    <button
                      onClick={() => handleSave(false)}
                      disabled={saving}
                      className="btn btn-secondary flex-1"
                    >
                      {saving ? '💾 Saving...' : '💾 Save Rule'}
                    </button>
                    <button
                      onClick={() => handleSave(true)}
                      disabled={saving}
                      className="btn btn-primary flex-1"
                    >
                      {saving ? '⚡ Applying...' : '⚡ Apply Now'}
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="border-t border-gray-100 p-3 bg-white">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={mode === 'advanced'
                      ? "e.g. Pause ad sets above avg cost, older than 7 days"
                      : "e.g. Pause ad sets with spend over $50, no conversions"
                    }
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                    disabled={loading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="btn btn-primary px-4 rounded-xl shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzingCampaign}
                  className="text-xs text-blue-600 hover:underline"
                >
                  📊 Analyze Campaign
                </button>
              </div>
            </div>
          )}

          {/* Analysis Panel */}
          {activeTab === 'analysis' && (
            <div className="flex-1 overflow-y-auto p-4">
              {analyzingCampaign ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Analyzing campaign performance...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500">Total Spend</div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${analysis.summary.total_spend.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500">Conversions</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {analysis.summary.total_conversions}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500">Avg Cost/Conv</div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${analysis.summary.average_cost_per_conversion.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500">ROAS</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {analysis.summary.average_roas.toFixed(2)}x
                      </div>
                    </div>
                  </div>

                  {/* Insights */}
                  {analysis.performance_insights.length > 0 && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        📈 Performance Insights
                      </h3>
                      <ul className="space-y-2">
                        {analysis.performance_insights.map((insight, idx) => (
                          <li key={idx} className="text-gray-700 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Optimization Opportunities */}
                  {analysis.optimization_opportunities.length > 0 && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        🎯 Optimization Opportunities
                      </h3>
                      <div className="space-y-3">
                        {analysis.optimization_opportunities.map((opp, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-lg border ${
                              opp.priority === 'high' 
                                ? 'bg-red-50 border-red-200'
                                : opp.priority === 'medium'
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-blue-50 border-blue-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                    opp.priority === 'high' 
                                      ? 'bg-red-200 text-red-800'
                                      : opp.priority === 'medium'
                                      ? 'bg-yellow-200 text-yellow-800'
                                      : 'bg-blue-200 text-blue-800'
                                  }`}>
                                    {opp.priority.toUpperCase()}
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {opp.title}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  {opp.description}
                                </p>
                                {opp.potential_savings && (
                                  <p className="text-sm font-medium text-green-600">
                                    💰 Potential savings: ${opp.potential_savings.toFixed(2)}
                                  </p>
                                )}
                              </div>
                              {opp.suggested_rule && (
                                <div className="flex gap-2 ml-4">
                                  <button
                                    onClick={() => handleApplySuggestion(opp)}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    Review
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        setSaving(true);
                                        const ruleToCreate: AdSetRuleCreate = {
                                          agent_id: agentId,
                                          campaign_id: campaignId,
                                          rule_name: opp.suggested_rule!.rule_name,
                                          description: opp.description,
                                          filter_config: opp.suggested_rule!.filter_config,
                                          action: opp.suggested_rule!.action,
                                          execution_mode: 'MANUAL',
                                          execute_immediately: true,
                                        };
                                        const response = await apiService.createAdSetRule(ruleToCreate);
                                        const result = response.data as any;

                                        let msg = `✅ Applied: ${opp.title}`;
                                        if (result.execution_result?.successful_count > 0) {
                                          msg += `\n⚡ ${result.execution_result.successful_count} ad set(s) updated.`;
                                        }

                                        const successMsg: Message = {
                                          id: Date.now().toString(),
                                          type: 'system',
                                          content: msg,
                                          timestamp: new Date(),
                                        };
                                        setMessages(prev => [...prev, successMsg]);

                                        // Refresh analysis
                                        handleAnalyze();

                                        if (onRuleCreated) onRuleCreated();
                                      } catch (err: any) {
                                        const errorMsg: Message = {
                                          id: Date.now().toString(),
                                          type: 'system',
                                          content: `❌ Failed: ${err.response?.data?.detail || err.message}`,
                                          timestamp: new Date(),
                                        };
                                        setMessages(prev => [...prev, errorMsg]);
                                      } finally {
                                        setSaving(false);
                                      }
                                    }}
                                    disabled={saving}
                                    className="btn btn-primary btn-sm"
                                  >
                                    {saving ? '⏳' : '⚡'} Apply Now
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Underperforming Ad Sets */}
                  {analysis.underperforming_ad_sets.length > 0 && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        ⚠️ Underperforming Ad Sets
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-gray-500 border-b border-gray-200">
                            <tr>
                              <th className="pb-2">Name</th>
                              <th className="pb-2">Status</th>
                              <th className="pb-2">Spend</th>
                              <th className="pb-2">Conv.</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-700">
                            {analysis.underperforming_ad_sets.slice(0, 5).map((adSet: any) => (
                              <tr key={adSet.id} className="border-b border-gray-100">
                                <td className="py-2">{adSet.name}</td>
                                <td className="py-2">
                                  <span className={`px-2 py-0.5 text-xs rounded ${
                                    adSet.status === 'ACTIVE' 
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {adSet.status}
                                  </span>
                                </td>
                                <td className="py-2">${parseFloat(adSet.performance_metrics?.spend || 0).toFixed(2)}</td>
                                <td className="py-2">
                                  {adSet.performance_metrics?.actions?.[0]?.value || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Refresh Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzingCampaign}
                      className="btn btn-secondary"
                    >
                      🔄 Refresh Analysis
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Campaign Analysis
                  </h3>
                  <p className="text-gray-600 mb-4 text-center">
                    Get AI-powered insights and optimization suggestions for your campaign.
                  </p>
                  <button
                    onClick={handleAnalyze}
                    className="btn btn-primary"
                  >
                    Start Analysis
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
};

export default AIRuleChatbot;
