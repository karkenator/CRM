export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  last_heartbeat_at?: string;
  allowed_ip?: string;
  bootstrap?: {
    token: string;
    docker_run: string;
  };
}

export interface AgentCreate {
  name: string;
  user_id?: string;
  allowed_ip?: string;
}

export interface AdAccount {
  id: string;
  user_id: string;
  agent_id?: string;
  meta_ad_account_id: string;
  name: string;
  cred_ref?: string;
  currency_code?: string;
  is_active: boolean;
}

export interface Campaign {
  id: string;
  ad_account_id: string;
  meta_id: string;
  name: string;
  status: string;
}

export interface Command {
  id: string;
  ad_account_id: string;
  target_type: string;
  target_id: string;
  action: string;
  payload: Record<string, any>;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  idempotency_key: string;
  created_by: string;
  created_at: string;
}

export interface MetricSnapshot {
  id: string;
  ad_account_id: string;
  campaign_id?: string;
  ad_set_id?: string;
  ad_id?: string;
  ts: string;
  impressions: number;
  clicks: number;
  spend_minor: number;
  conversions: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Rule Operator Types
export type RuleOperator = 
  // Basic
  | 'equals' | 'not_equals' | 'greater_than' | 'less_than' 
  | 'greater_than_or_equal' | 'less_than_or_equal' | 'between'
  | 'contains' | 'not_contains' | 'in' | 'not_in'
  | 'starts_with' | 'ends_with'
  // Regex
  | 'regex' | 'not_regex'
  // Date/Time
  | 'date_equals' | 'date_before' | 'date_after' | 'date_between'
  | 'days_ago_less_than' | 'days_ago_greater_than' | 'days_ago_between'
  | 'time_of_day_between'
  // Statistics
  | 'above_average' | 'below_average' | 'above_median' | 'below_median'
  | 'above_percentile' | 'below_percentile'
  | 'percent_change_greater' | 'percent_change_less'
  | 'trend_increasing' | 'trend_decreasing' | 'trend_stable'
  // Null checks
  | 'is_null' | 'is_not_null';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: any;
  value2?: any;
  time_window?: string;
}

export interface ConditionGroup {
  conditions: RuleCondition[];
  logical_operator: 'AND' | 'OR';
}

export interface FilterConfig {
  conditions?: RuleCondition[];
  condition_groups?: ConditionGroup[];
  logical_operator: 'AND' | 'OR';
}

// Ad Set Rule Types
export interface AdSetRule {
  id: string;
  user_id: string;
  agent_id: string;
  campaign_id: string;
  rule_name: string;
  description?: string;
  is_active: boolean;
  execution_mode: 'AUTO' | 'MANUAL';
  filter_config: FilterConfig;
  action: {
    type: 'PAUSE' | 'ACTIVATE';
  };
  last_executed_at?: string;
  execution_count: number;
  last_action?: string;
  last_matched_count?: number;
  meta_rule_id?: string;  // ID of the synced rule on Meta's servers
  created_at: string;
  updated_at: string;
}

export interface AdSetRuleCreate {
  agent_id: string;
  campaign_id: string;
  rule_name: string;
  description?: string;
  filter_config: FilterConfig;
  action: {
    type: 'PAUSE' | 'ACTIVATE';
  };
  execution_mode?: 'AUTO' | 'MANUAL';
  execute_immediately?: boolean;  // Execute the rule right after creating (applies action to matching ad sets NOW)
  // Note: Rules are ALWAYS created on both CRM and Meta simultaneously
}

export interface AdSetRuleUpdate {
  rule_name?: string;
  description?: string;
  is_active?: boolean;
  execution_mode?: 'AUTO' | 'MANUAL';
  filter_config?: FilterConfig;
  action?: {
    type: 'PAUSE' | 'ACTIVATE';
  };
}

export interface RulePreview {
  total_ad_sets: number;
  matching_ad_sets: number;
  matched_ad_sets: Array<{
    id: string;
    name: string;
    status: string;
    effective_status: string;
    daily_budget?: number;
    lifetime_budget?: number;
    performance_metrics?: Record<string, any>;
  }>;
  campaign_statistics?: CampaignStatistics;
}

export interface GeneratedRule {
  rule_name: string;
  description?: string;
  filter_config: FilterConfig;
  action: {
    type: 'PAUSE' | 'ACTIVATE';
  };
  explanation?: string;
  agent_id: string;
  campaign_id: string;
}

// Campaign Analysis Types
export interface CampaignStatistics {
  averages: Record<string, number>;
  medians: Record<string, number>;
  percentiles: Record<string, Record<number, number>>;
  trends: Record<string, 'increasing' | 'decreasing' | 'stable'>;
  totals: Record<string, number>;
}

export interface CampaignAnalysisSummary {
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

export interface CampaignAnalysis {
  summary: CampaignAnalysisSummary;
  performance_insights: string[];
  optimization_opportunities: OptimizationSuggestion[];
  underperforming_ad_sets: any[];
  top_performing_ad_sets: any[];
  statistics: CampaignStatistics;
}

// Rule Schema Types
export interface FieldDefinition {
  id: string;
  label: string;
  type: 'string' | 'number' | 'money' | 'percentage' | 'datetime' | 'enum' | 'array';
  values?: string[];
}

export interface FieldCategory {
  name: string;
  fields: FieldDefinition[];
}

export interface OperatorDefinition {
  label: string;
  description: string;
  types: string[];
}

export interface RuleSchema {
  fields: Record<string, FieldCategory>;
  operators: Record<string, OperatorDefinition>;
  actions: string[];
  time_windows: string[];
}

// Meta API Types
export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  daily_budget?: number | string;
  lifetime_budget?: number | string;
  performance_metrics?: Record<string, any>;
  ad_sets?: MetaAdSet[];
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: number;
  lifetime_budget?: number;
  optimization_goal?: string;
  performance_metrics?: Record<string, any>;
  ads?: MetaAd[];
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  creative?: {
    id: string;
    name: string;
  };
  performance_metrics?: Record<string, any>;
}

export interface MetaAppInfo {
  id: string;
  name?: string;
  category?: string;
  link?: string;
}

export interface MetaMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

