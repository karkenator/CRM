import axios, { AxiosInstance } from 'axios';
import { 
  LoginRequest, 
  TokenPair, 
  User, 
  Agent,
  AgentCreate,
  Command, 
  PasswordResetRequest,
  PasswordResetConfirm,
  AdSetRule,
  AdSetRuleCreate,
  AdSetRuleUpdate,
  RulePreview,
  GeneratedRule,
  CampaignAnalysis,
  RuleSchema,
  FilterConfig,
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const response = await this.refreshToken({ refresh: refreshToken });
              localStorage.setItem('access_token', response.data.access);
              localStorage.setItem('refresh_token', response.data.refresh);
              // Retry the original request
              return this.api.request(error.config);
            } catch (refreshError) {
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              window.location.href = '/login';
            }
          } else {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<{ data: TokenPair }> {
    return this.api.post('/api/auth/login', credentials);
  }

  async refreshToken(payload: { refresh: string }): Promise<{ data: TokenPair }> {
    return this.api.post('/api/auth/refresh', payload);
  }

  async requestPasswordReset(payload: PasswordResetRequest): Promise<{ data: { message: string } }> {
    return this.api.post('/api/auth/request-password-reset', payload);
  }

  async resetPassword(payload: PasswordResetConfirm): Promise<{ data: { message: string } }> {
    return this.api.post('/api/auth/reset-password', payload);
  }

  // User endpoints
  async getUsers(): Promise<{ data: User[] }> {
    return this.api.get('/api/users/');
  }

  async createUser(user: Omit<User, 'created_at' | 'last_login'> & { password: string }): Promise<{ data: User }> {
    return this.api.post('/api/users/', user);
  }

  async deleteUser(userId: string): Promise<void> {
    return this.api.delete(`/api/users/${userId}`);
  }

  // Agent endpoints
  async getAgents(): Promise<{ data: Agent[] }> {
    return this.api.get('/api/agents/');
  }

  async createAgent(agent: AgentCreate): Promise<{ data: Agent }> {
    return this.api.post('/api/agents/', agent);
  }

  async getAgent(agentId: string): Promise<{ data: Agent }> {
    return this.api.get(`/api/agents/${agentId}`);
  }

  async updateAgent(agentId: string, agent: Partial<Agent>): Promise<{ data: Agent }> {
    return this.api.put(`/api/agents/${agentId}`, agent);
  }

  async deleteAgent(agentId: string): Promise<void> {
    return this.api.delete(`/api/agents/${agentId}`);
  }

  // Command endpoints
  async getCommands(status?: string): Promise<{ data: Command[] }> {
    const params = status ? { status_eq: status } : {};
    return this.api.get('/api/commands/', { params });
  }

  async getCommand(id: string): Promise<{ data: Command }> {
    return this.api.get(`/api/commands/${id}`);
  }

  async createCommand(command: Omit<Command, 'id' | 'status' | 'created_at'>): Promise<{ data: Command }> {
    return this.api.post('/api/commands/', command);
  }

  // Health check
  async healthCheck(): Promise<{ data: { status: string } }> {
    return this.api.get('/healthz');
  }

  // Meta API endpoints
  async testMetaConnection(agentId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/test?agent_id=${agentId}`);
  }

  async getMetaAccount(agentId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/account?agent_id=${agentId}`);
  }

  async getMetaCampaigns(agentId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/campaigns?agent_id=${agentId}`);
  }

  async getMetaInsights(agentId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/insights?agent_id=${agentId}`);
  }

  async getHierarchicalCampaigns(agentId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/campaigns/hierarchical?agent_id=${agentId}`);
  }

  async getCampaignAdSets(agentId: string, campaignId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/campaigns/${campaignId}/adsets?agent_id=${agentId}`);
  }

  async getAdSetAds(agentId: string, adsetId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/adsets/${adsetId}/ads?agent_id=${agentId}`);
  }

  async updateAdSetStatus(agentId: string, adsetId: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'): Promise<{ data: any }> {
    return this.api.put(`/meta/adsets/${adsetId}/status?agent_id=${agentId}`, { status });
  }

  async getCampaignOptimization(agentId: string, campaignId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/optimization/${campaignId}?agent_id=${agentId}`);
  }

  async getAdSetDemographics(agentId: string, adsetId: string): Promise<{ data: any }> {
    return this.api.get(`/meta/demographics/${adsetId}?agent_id=${agentId}`);
  }

  // Ad Set Rules endpoints
  async getAdSetRules(agentId?: string, campaignId?: string): Promise<{ data: AdSetRule[] }> {
    const params: any = {};
    if (agentId) params.agent_id = agentId;
    if (campaignId) params.campaign_id = campaignId;
    return this.api.get('/api/ad-set-rules/', { params });
  }

  async getAdSetRule(ruleId: string): Promise<{ data: AdSetRule }> {
    return this.api.get(`/api/ad-set-rules/${ruleId}`);
  }

  async getRuleSchema(mode: 'basic' | 'advanced' = 'basic'): Promise<{ data: RuleSchema }> {
    return this.api.get(`/api/ad-set-rules/schema?mode=${mode}`);
  }

  async generateRule(
    naturalLanguage: string, 
    agentId: string, 
    campaignId: string,
    mode: 'basic' | 'advanced' = 'basic'
  ): Promise<{ data: GeneratedRule }> {
    return this.api.post('/api/ad-set-rules/generate', {
      natural_language: naturalLanguage,
      agent_id: agentId,
      campaign_id: campaignId,
      mode,
    });
  }

  async analyzeCampaign(agentId: string, campaignId: string): Promise<{ data: CampaignAnalysis }> {
    return this.api.post('/api/ad-set-rules/analyze', {
      agent_id: agentId,
      campaign_id: campaignId,
    });
  }

  async previewRule(agentId: string, campaignId: string, filterConfig: FilterConfig): Promise<{ data: RulePreview }> {
    return this.api.post('/api/ad-set-rules/preview', {
      agent_id: agentId,
      campaign_id: campaignId,
      filter_config: filterConfig,
    });
  }

  async createAdSetRule(rule: AdSetRuleCreate): Promise<{ data: AdSetRule }> {
    return this.api.post('/api/ad-set-rules/', rule);
  }

  async updateAdSetRule(ruleId: string, rule: AdSetRuleUpdate): Promise<{ data: AdSetRule }> {
    return this.api.put(`/api/ad-set-rules/${ruleId}`, rule);
  }

  async deleteAdSetRule(ruleId: string): Promise<void> {
    return this.api.delete(`/api/ad-set-rules/${ruleId}`);
  }

  async executeRule(ruleId: string): Promise<{ data: any }> {
    return this.api.post(`/api/ad-set-rules/${ruleId}/execute`);
  }

  // Campaign Insights endpoints
  async getCampaignHealth(agentId: string, campaignId: string): Promise<{ data: any }> {
    return this.api.post('/api/campaign-insights/health', { agent_id: agentId, campaign_id: campaignId });
  }

  async getQuickWins(agentId: string, campaignId: string): Promise<{ data: any }> {
    return this.api.post('/api/campaign-insights/quick-wins', { agent_id: agentId, campaign_id: campaignId });
  }
}

export const apiService = new ApiService();
