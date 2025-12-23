import axios from 'axios';
import { config } from '../config';
import { FIELD_CATEGORIES, ALL_FIELDS, calculateCampaignStatistics } from './ruleExecutor';
import { calculateCampaignHealth, OptimizationInsight } from './campaignOptimizer';

export interface RuleGenerationRequest {
  naturalLanguage: string;
  campaignData?: any;
  adSetsData?: any[];
  mode?: 'basic' | 'advanced';
}

export interface ConditionConfig {
  field: string;
  operator: string;
  value: any;
  value2?: any;
  time_window?: string;
}

export interface ConditionGroup {
  conditions: ConditionConfig[];
  logical_operator: 'AND' | 'OR';
}

export interface GeneratedRule {
  rule_name: string;
  description?: string;
  filter_config: {
    conditions?: ConditionConfig[];
    condition_groups?: ConditionGroup[];
    logical_operator: 'AND' | 'OR';
  };
  action: {
    type: 'PAUSE' | 'ACTIVATE';
  };
  explanation?: string;
}

export interface CampaignAnalysis {
  summary: {
    total_ad_sets: number;
    active_ad_sets: number;
    paused_ad_sets: number;
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    average_ctr: number;
    average_cpc: number;
    average_cost_per_conversion: number;
    average_roas: number;
  };
  performance_insights: string[];
  optimization_opportunities: OptimizationSuggestion[];
  underperforming_ad_sets: any[];
  top_performing_ad_sets: any[];
  statistics: any;
}

export interface OptimizationSuggestion {
  type: 'pause' | 'activate' | 'budget_adjust' | 'targeting' | 'creative' | 'bidding';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affected_ad_sets: string[];
  potential_savings?: number;
  suggested_rule?: GeneratedRule;
}

// All available operators with descriptions
const OPERATORS = {
  // Basic
  equals: { label: 'Equals', description: 'Exact match', types: ['string', 'number', 'enum', 'money'] },
  not_equals: { label: 'Not Equals', description: 'Does not match', types: ['string', 'number', 'enum', 'money'] },
  greater_than: { label: 'Greater Than', description: '> value', types: ['number', 'money', 'percentage'] },
  less_than: { label: 'Less Than', description: '< value', types: ['number', 'money', 'percentage'] },
  greater_than_or_equal: { label: 'Greater Than or Equal', description: '>= value', types: ['number', 'money', 'percentage'] },
  less_than_or_equal: { label: 'Less Than or Equal', description: '<= value', types: ['number', 'money', 'percentage'] },
  between: { label: 'Between', description: 'Value between min and max (inclusive)', types: ['number', 'money', 'percentage'] },
  contains: { label: 'Contains', description: 'String contains substring', types: ['string'] },
  not_contains: { label: 'Does Not Contain', description: 'String does not contain substring', types: ['string'] },
  starts_with: { label: 'Starts With', description: 'String starts with', types: ['string'] },
  ends_with: { label: 'Ends With', description: 'String ends with', types: ['string'] },
  in: { label: 'In List', description: 'Value is in the provided list', types: ['string', 'number', 'enum'] },
  not_in: { label: 'Not In List', description: 'Value is not in the provided list', types: ['string', 'number', 'enum'] },
  
  // Regex
  regex: { label: 'Matches Regex', description: 'Matches regular expression pattern', types: ['string'] },
  not_regex: { label: 'Does Not Match Regex', description: 'Does not match regular expression', types: ['string'] },
  
  // Date/Time
  date_equals: { label: 'Date Equals', description: 'Same day as specified date', types: ['datetime'] },
  date_before: { label: 'Date Before', description: 'Before specified date', types: ['datetime'] },
  date_after: { label: 'Date After', description: 'After specified date', types: ['datetime'] },
  date_between: { label: 'Date Between', description: 'Between two dates', types: ['datetime'] },
  days_ago_less_than: { label: 'Created/Updated Less Than X Days Ago', description: 'Less than X days ago', types: ['datetime'] },
  days_ago_greater_than: { label: 'Created/Updated More Than X Days Ago', description: 'More than X days ago', types: ['datetime'] },
  days_ago_between: { label: 'Created/Updated Between X and Y Days Ago', description: 'Between X and Y days ago', types: ['datetime'] },
  time_of_day_between: { label: 'Time of Day Between', description: 'Hour of day between (0-23)', types: ['datetime'] },
  
  // Statistics
  above_average: { label: 'Above Campaign Average', description: 'Value is above campaign average', types: ['number', 'money', 'percentage'] },
  below_average: { label: 'Below Campaign Average', description: 'Value is below campaign average', types: ['number', 'money', 'percentage'] },
  above_median: { label: 'Above Median', description: 'Value is above campaign median', types: ['number', 'money', 'percentage'] },
  below_median: { label: 'Below Median', description: 'Value is below campaign median', types: ['number', 'money', 'percentage'] },
  above_percentile: { label: 'Above Percentile', description: 'Value is above Nth percentile', types: ['number', 'money', 'percentage'] },
  below_percentile: { label: 'Below Percentile', description: 'Value is below Nth percentile', types: ['number', 'money', 'percentage'] },
  percent_change_greater: { label: 'Percent Change Greater Than', description: 'Metric changed by more than X%', types: ['number', 'money', 'percentage'] },
  percent_change_less: { label: 'Percent Change Less Than', description: 'Metric changed by less than X%', types: ['number', 'money', 'percentage'] },
  trend_increasing: { label: 'Trend Increasing', description: 'Metric is trending upward', types: ['number', 'money', 'percentage'] },
  trend_decreasing: { label: 'Trend Decreasing', description: 'Metric is trending downward', types: ['number', 'money', 'percentage'] },
  trend_stable: { label: 'Trend Stable', description: 'Metric is relatively stable', types: ['number', 'money', 'percentage'] },
  
  // Null checks
  is_null: { label: 'Is Empty/Null', description: 'Field has no value', types: ['string', 'number', 'money', 'datetime', 'array'] },
  is_not_null: { label: 'Is Not Empty', description: 'Field has a value', types: ['string', 'number', 'money', 'datetime', 'array'] },
};

// Build the system prompt for rule generation
function buildSystemPrompt(mode: 'basic' | 'advanced' = 'basic'): string {
  const fieldsByCategory = mode === 'basic' 
    ? {
        basic: FIELD_CATEGORIES.basic,
        performance: FIELD_CATEGORIES.performance,
        conversions: FIELD_CATEGORIES.conversions,
        datetime: FIELD_CATEGORIES.datetime,
      }
    : FIELD_CATEGORIES;

  const fieldsDescription = Object.entries(fieldsByCategory)
    .map(([key, cat]) => {
      const fields = cat.fields.map(f => `  - ${f.id}: ${f.label} (${f.type})`).join('\n');
      return `${cat.name}:\n${fields}`;
    })
    .join('\n\n');

  const operatorsDescription = Object.entries(OPERATORS)
    .map(([key, op]) => `  - ${key}: ${op.description}`)
    .join('\n');

  return `You are an expert AI assistant for Meta (Facebook) Ads optimization. Your role is to help create sophisticated rules for managing Ad Sets based on performance metrics and business logic.

## Available Fields for Filtering

${fieldsDescription}

## Available Operators

${operatorsDescription}

## Time Windows for Statistics
You can specify time_window for metrics: "today", "yesterday", "last_7d", "last_14d", "last_30d"

## Rule Structure

Return a JSON object with this structure:
{
  "rule_name": "Descriptive rule name",
  "description": "What this rule does and why",
  "filter_config": {
    "conditions": [
      {
        "field": "field_name",
        "operator": "operator_name",
        "value": value,
        "value2": optional_value_for_between,
        "time_window": "optional_time_window"
      }
    ],
    "condition_groups": [
      {
        "conditions": [...],
        "logical_operator": "AND" or "OR"
      }
    ],
    "logical_operator": "AND" or "OR"
  },
  "action": {
    "type": "PAUSE" or "ACTIVATE"
  },
  "explanation": "Detailed explanation of the rule logic"
}

## Guidelines

1. For monetary values (spend, cost, budget), use the base currency unit (e.g., 60 for $60)
2. For percentages (ctr, conversion_rate), use decimal format (e.g., 2.5 for 2.5%)
3. Use condition_groups for complex nested logic
4. Use statistical operators (above_average, below_percentile) for relative comparisons
5. Use date operators for time-based rules
6. Use regex for pattern matching on names
7. Consider using multiple conditions with AND/OR logic for precise targeting
8. Always explain your reasoning in the explanation field

Return ONLY valid JSON, no additional text.`;
}

// Build the system prompt for campaign analysis
function buildAnalysisPrompt(): string {
  return `You are an expert Meta Ads analyst. Analyze campaign performance data and provide actionable insights.

Your analysis should include:
1. Performance summary with key metrics
2. Identification of underperforming ad sets (high cost, low conversions)
3. Identification of top performing ad sets
4. Specific optimization opportunities with suggested rules
5. Budget allocation recommendations
6. Trend analysis

For each optimization opportunity, suggest a specific rule that can be applied automatically.

Return a JSON object with this structure:
{
  "performance_insights": ["insight1", "insight2", ...],
  "optimization_opportunities": [
    {
      "type": "pause|activate|budget_adjust|targeting|creative|bidding",
      "priority": "high|medium|low",
      "title": "Short title",
      "description": "Detailed description",
      "affected_ad_sets": ["ad_set_id1", ...],
      "potential_savings": number_or_null,
      "suggested_rule": { rule_object_or_null }
    }
  ],
  "budget_recommendations": "Text recommendations for budget",
  "summary_text": "Overall campaign health summary"
}`;
}

export async function generateRuleFromNaturalLanguage(
  request: RuleGenerationRequest
): Promise<GeneratedRule> {
  if (!config.openai.apiKey) {
    throw new Error('OpenAI API key is not configured. Please add OPENAI_API_KEY to your environment variables.');
  }

  const mode = request.mode || 'basic';
  const systemPrompt = buildSystemPrompt(mode);

  let userPrompt = `Convert this natural language request into a rule configuration:
"${request.naturalLanguage}"`;

  // Add campaign context if available
  if (request.campaignData) {
    userPrompt += `\n\nCampaign context:
- Name: ${request.campaignData.name}
- Status: ${request.campaignData.status}
- Objective: ${request.campaignData.objective || 'N/A'}`;
  }

  // Add ad sets summary if available
  if (request.adSetsData && request.adSetsData.length > 0) {
    const stats = calculateCampaignStatistics(request.adSetsData);
    userPrompt += `\n\nCampaign Statistics:
- Total Ad Sets: ${request.adSetsData.length}
- Average Spend: ${stats.averages.spend?.toFixed(2) || 'N/A'}
- Average CPC: ${stats.averages.cpc?.toFixed(2) || 'N/A'}
- Average CTR: ${stats.averages.ctr?.toFixed(2) || 'N/A'}%
- Average Cost per Conversion: ${stats.averages.cost_per_conversion?.toFixed(2) || 'N/A'}`;
  }

  userPrompt += `\n\nCreate a ${mode === 'advanced' ? 'sophisticated' : 'simple'} rule based on this request.
Return ONLY valid JSON.`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    // Validate the structure
    if (!parsed.rule_name || !parsed.filter_config || !parsed.action) {
      throw new Error('Invalid rule structure from AI');
    }

    return parsed as GeneratedRule;
  } catch (error: any) {
    if (error.response) {
      throw new Error(`OpenAI API error: ${error.response.data?.error?.message || error.message}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
    throw error;
  }
}

export async function analyzeCampaign(
  campaignData: any,
  adSetsData: any[]
): Promise<CampaignAnalysis> {
  // Run advanced campaign health analysis
  const healthAnalysis = calculateCampaignHealth(adSetsData);
  
  // Calculate statistics
  const stats = calculateCampaignStatistics(adSetsData);
  
  // Calculate summary
  const activeAdSets = adSetsData.filter(a => a.status === 'ACTIVE');
  const pausedAdSets = adSetsData.filter(a => a.status === 'PAUSED');
  
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalPurchaseValue = 0;

  for (const adSet of adSetsData) {
    const metrics = adSet.performance_metrics || {};
    totalSpend += parseFloat(metrics.spend || 0);
    totalImpressions += parseInt(metrics.impressions || 0);
    totalClicks += parseInt(metrics.clicks || 0);
    
    if (metrics.actions && Array.isArray(metrics.actions)) {
      const purchase = metrics.actions.find((a: any) => 
        a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      if (purchase) {
        totalConversions += parseInt(purchase.value || 0);
      }
    }
    
    if (metrics.action_values && Array.isArray(metrics.action_values)) {
      const purchaseValue = metrics.action_values.find((a: any) => 
        a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      if (purchaseValue) {
        totalPurchaseValue += parseFloat(purchaseValue.value || 0);
      }
    }
  }

  const summary = {
    total_ad_sets: adSetsData.length,
    active_ad_sets: activeAdSets.length,
    paused_ad_sets: pausedAdSets.length,
    total_spend: totalSpend,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    total_conversions: totalConversions,
    average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    average_cost_per_conversion: totalConversions > 0 ? totalSpend / totalConversions : 0,
    average_roas: totalSpend > 0 ? totalPurchaseValue / totalSpend : 0,
  };

  // Identify underperforming ad sets (high spend, low/no conversions)
  const underperforming = adSetsData
    .filter(adSet => {
      const metrics = adSet.performance_metrics || {};
      const spend = parseFloat(metrics.spend || 0);
      const conversions = getConversions(metrics);
      const costPerConversion = conversions > 0 ? spend / conversions : Infinity;
      
      // High spend with no conversions, or cost per conversion is way above average
      return (spend > 10 && conversions === 0) || 
             (costPerConversion > summary.average_cost_per_conversion * 2 && spend > 5);
    })
    .slice(0, 10);

  // Identify top performing ad sets
  const topPerforming = adSetsData
    .filter(adSet => {
      const metrics = adSet.performance_metrics || {};
      const conversions = getConversions(metrics);
      return conversions > 0;
    })
    .sort((a, b) => {
      const aMetrics = a.performance_metrics || {};
      const bMetrics = b.performance_metrics || {};
      const aCPC = getConversions(aMetrics) > 0 ? parseFloat(aMetrics.spend || 0) / getConversions(aMetrics) : Infinity;
      const bCPC = getConversions(bMetrics) > 0 ? parseFloat(bMetrics.spend || 0) / getConversions(bMetrics) : Infinity;
      return aCPC - bCPC;
    })
    .slice(0, 10);

  // Add research-based insights to the basic insights
  const researchBasedInsights = generateResearchBasedInsights(healthAnalysis, summary, adSetsData);
  
  // Use AI for deeper insights if API key is available
  let performanceInsights: string[] = [];
  let optimizationOpportunities: OptimizationSuggestion[] = [];

  if (config.openai.apiKey) {
    try {
      const aiAnalysis = await getAIAnalysis(campaignData, adSetsData, summary, stats);
      performanceInsights = aiAnalysis.performance_insights || [];
      optimizationOpportunities = aiAnalysis.optimization_opportunities || [];
    } catch (error) {
      console.error('AI analysis failed:', error);
      // Fall back to rule-based insights
      performanceInsights = generateBasicInsights(summary, underperforming, topPerforming);
      optimizationOpportunities = generateBasicOptimizations(underperforming, summary);
    }
  } else {
    performanceInsights = generateBasicInsights(summary, underperforming, topPerforming);
    optimizationOpportunities = generateBasicOptimizations(underperforming, summary);
  }

  // Combine AI insights with research-based insights
  const allInsights = [...researchBasedInsights, ...performanceInsights];
  const allOpportunities = [
    ...convertInsightsToOpportunities(healthAnalysis.insights),
    ...optimizationOpportunities
  ];
  
  return {
    summary: {
      ...summary,
      health_score: healthAnalysis.score,
      health_status: healthAnalysis.status,
    },
    performance_insights: allInsights,
    optimization_opportunities: allOpportunities,
    underperforming_ad_sets: underperforming,
    top_performing_ad_sets: topPerforming,
    statistics: stats,
  };
}

function generateResearchBasedInsights(
  healthAnalysis: any,
  summary: any,
  adSetsData: any[]
): string[] {
  const insights: string[] = [];
  
  // Add health score insight
  insights.push(`📊 Campaign Health Score: ${healthAnalysis.score}/100 (${healthAnalysis.status.toUpperCase()})`);
  
  // Budget allocation insights
  const totalBudget = adSetsData.reduce((sum, a) => sum + parseFloat(a.daily_budget || a.lifetime_budget || 0), 0);
  if (totalBudget > 0) {
    insights.push(`💰 Total Daily Budget: $${totalBudget.toFixed(2)} across ${adSetsData.length} ad sets`);
  }
  
  // Frequency insights
  const highFrequency = adSetsData.filter(a => parseFloat(a.performance_metrics?.frequency || 0) > 1.7);
  if (highFrequency.length > 0) {
    insights.push(`⚠️ ${highFrequency.length} ad set(s) showing signs of ad fatigue (frequency > 1.7)`);
  }
  
  // Learning phase insights
  const inLearning = adSetsData.filter(a => {
    const createdDate = new Date(a.created_time);
    const daysActive = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysActive > 7 && daysActive < 30;
  });
  if (inLearning.length > 0) {
    insights.push(`🎯 ${inLearning.length} ad set(s) in learning phase - maintain consistent budget to optimize faster`);
  }
  
  // Add critical warnings first
  const criticalInsights = healthAnalysis.insights.filter((i: any) => i.priority === 'critical' || i.priority === 'high');
  if (criticalInsights.length > 0) {
    insights.push(`🚨 ${criticalInsights.length} high-priority optimization opportunity(ies) identified`);
  }
  
  return insights;
}

function convertInsightsToOpportunities(insights: OptimizationInsight[]): OptimizationSuggestion[] {
  return insights.slice(0, 10).map(insight => ({
    type: insight.category.toLowerCase().includes('budget') ? 'budget_adjust' :
          insight.category.toLowerCase().includes('creative') ? 'creative' :
          insight.category.toLowerCase().includes('audience') ? 'targeting' :
          insight.type === 'warning' ? 'pause' : 'activate',
    priority: insight.priority === 'critical' || insight.priority === 'high' ? 'high' :
              insight.priority === 'medium' ? 'medium' : 'low',
    title: insight.title,
    description: `${insight.description}\n\n💡 ${insight.recommendation}`,
    affected_ad_sets: insight.affected_entities,
    potential_savings: insight.estimated_savings,
  }));
}

async function getAIAnalysis(
  campaignData: any,
  adSetsData: any[],
  summary: any,
  stats: any
): Promise<any> {
  const systemPrompt = buildAnalysisPrompt();

  const adSetsSummary = adSetsData.slice(0, 20).map(adSet => {
    const metrics = adSet.performance_metrics || {};
    return {
      id: adSet.id,
      name: adSet.name,
      status: adSet.status,
      spend: metrics.spend,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      ctr: metrics.ctr,
      cpc: metrics.cpc,
      conversions: getConversions(metrics),
      cost_per_conversion: getConversions(metrics) > 0 
        ? (parseFloat(metrics.spend || 0) / getConversions(metrics)).toFixed(2) 
        : 'N/A',
    };
  });

  const userPrompt = `Analyze this campaign performance data:

Campaign: ${campaignData.name}
Status: ${campaignData.status}
Objective: ${campaignData.objective || 'N/A'}

Summary:
- Total Ad Sets: ${summary.total_ad_sets}
- Active: ${summary.active_ad_sets}, Paused: ${summary.paused_ad_sets}
- Total Spend: $${summary.total_spend.toFixed(2)}
- Total Conversions: ${summary.total_conversions}
- Average Cost per Conversion: $${summary.average_cost_per_conversion.toFixed(2)}
- Average CTR: ${summary.average_ctr.toFixed(2)}%
- Average CPC: $${summary.average_cpc.toFixed(2)}
- ROAS: ${summary.average_roas.toFixed(2)}

Statistics:
- Median Spend: $${stats.medians.spend?.toFixed(2) || 'N/A'}
- 75th Percentile Cost per Conversion: $${stats.percentiles.cost_per_conversion?.[75]?.toFixed(2) || 'N/A'}

Ad Sets (sample):
${JSON.stringify(adSetsSummary, null, 2)}

Provide actionable insights and optimization suggestions with specific rules that can be applied.`;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const content = response.data.choices[0]?.message?.content;
  return JSON.parse(content);
}

function getConversions(metrics: any): number {
  if (!metrics.actions || !Array.isArray(metrics.actions)) return 0;
  const purchase = metrics.actions.find((a: any) => 
    a.action_type === 'purchase' || a.action_type === 'omni_purchase' || a.action_type === 'lead'
  );
  return purchase ? parseInt(purchase.value || 0) : 0;
}

function generateBasicInsights(summary: any, underperforming: any[], topPerforming: any[]): string[] {
  const insights: string[] = [];

  if (summary.total_conversions === 0 && summary.total_spend > 0) {
    insights.push(`⚠️ No conversions recorded despite $${summary.total_spend.toFixed(2)} in spend. Consider reviewing targeting or creative.`);
  }

  if (underperforming.length > 0) {
    insights.push(`📉 Found ${underperforming.length} underperforming ad sets with high spend and low/no conversions.`);
  }

  if (topPerforming.length > 0) {
    const bestCPC = topPerforming[0].performance_metrics?.spend / getConversions(topPerforming[0].performance_metrics);
    insights.push(`📈 Top performer has a cost per conversion of $${bestCPC?.toFixed(2) || 'N/A'}.`);
  }

  if (summary.average_ctr < 1) {
    insights.push(`📊 Average CTR is below 1%. Consider testing new ad creatives or audiences.`);
  }

  if (summary.average_roas > 0 && summary.average_roas < 1) {
    insights.push(`💰 ROAS is below 1.0, meaning you're spending more than you're earning. Optimization needed.`);
  } else if (summary.average_roas >= 3) {
    insights.push(`🎯 Excellent ROAS of ${summary.average_roas.toFixed(2)}! Consider scaling successful ad sets.`);
  }

  return insights;
}

function generateBasicOptimizations(underperforming: any[], summary: any): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  if (underperforming.length > 0) {
    suggestions.push({
      type: 'pause',
      priority: 'high',
      title: 'Pause Underperforming Ad Sets',
      description: `${underperforming.length} ad sets have high spend with little to no conversions. Pausing them could save budget for better performers.`,
      affected_ad_sets: underperforming.map(a => a.id),
      potential_savings: underperforming.reduce((sum, a) => sum + parseFloat(a.performance_metrics?.spend || 0), 0),
      suggested_rule: {
        rule_name: 'Pause High-Spend Zero-Conversion Ad Sets',
        description: 'Automatically pause ad sets spending money without generating conversions',
        filter_config: {
          conditions: [
            { field: 'spend', operator: 'greater_than', value: 10 },
            { field: 'conversions', operator: 'equals', value: 0 },
          ],
          logical_operator: 'AND',
        },
        action: { type: 'PAUSE' },
        explanation: 'Pauses ad sets that have spent over $10 without any conversions',
      },
    });
  }

  if (summary.average_cost_per_conversion > 0) {
    const threshold = summary.average_cost_per_conversion * 2;
    suggestions.push({
      type: 'pause',
      priority: 'medium',
      title: 'Pause High Cost-Per-Conversion Ad Sets',
      description: `Pause ad sets where cost per conversion exceeds 2x the average ($${threshold.toFixed(2)})`,
      affected_ad_sets: [],
      suggested_rule: {
        rule_name: 'Pause Above-Average Cost Ad Sets',
        description: 'Pause ad sets with cost per conversion above campaign average',
        filter_config: {
          conditions: [
            { field: 'cost_per_conversion', operator: 'above_average', value: null },
            { field: 'spend', operator: 'greater_than', value: 5 },
          ],
          logical_operator: 'AND',
        },
        action: { type: 'PAUSE' },
        explanation: 'Uses statistical comparison to pause ad sets performing worse than average',
      },
    });
  }

  return suggestions;
}

// Export operators and fields for frontend
export function getAvailableOperators() {
  return OPERATORS;
}

export function getAvailableFields(mode: 'basic' | 'advanced' = 'basic') {
  if (mode === 'basic') {
    return {
      basic: FIELD_CATEGORIES.basic,
      performance: FIELD_CATEGORIES.performance,
      conversions: FIELD_CATEGORIES.conversions,
      datetime: FIELD_CATEGORIES.datetime,
    };
  }
  return FIELD_CATEGORIES;
}
