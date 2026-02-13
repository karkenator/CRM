/**
 * Optimization Insights API Routes
 * New modular optimization system with standardized response format
 */

import { Router, Response } from 'express';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';
import { Agent } from '../models';
import { config } from '../config';
import axios from 'axios';
import {
  BleedingBudgetDetector,
  CreativeFatigueDetector,
  ScalingOpportunitiesDetector,
  runAllOptimizationModules,
  ModuleConfig,
  OptimizationRecommendation,
} from '../utils/optimizationModules';
import { 
  batchAnalyzeAdSentiments,
  AdSentimentResult,
} from '../utils/sentimentAnalysis';
import { enrichArrayWithComputedMetrics } from '../utils/computedMetrics';

const router = Router();

/**
 * Get campaign configuration (Target CPA, Target ROAS, etc.)
 */
async function getCampaignConfig(agentId: string, campaignId: string): Promise<ModuleConfig> {
  // TODO: Implement database storage for campaign-specific configs
  // For now, return defaults and calculate from data
  
  return {
    target_cpa: undefined, // Will be calculated if not set
    target_roas: 4.0, // Default target
    account_avg_cpa: undefined, // Will be calculated
  };
}

/**
 * Calculate account average CPA from ad sets
 */
function calculateAccountAverageCPA(adSets: any[]): number {
  let totalSpend = 0;
  let totalConversions = 0;
  
  for (const adSet of adSets) {
    const metrics = adSet.performance_metrics || {};
    totalSpend += parseFloat(metrics.spend || 0);
    
    const actions = metrics.actions || [];
    const conversions = actions.find((a: any) => 
      a.action_type === 'purchase' || a.action_type === 'omni_purchase' || a.action_type === 'lead'
    );
    totalConversions += conversions ? parseInt(conversions.value || 0) : 0;
  }
  
  return totalConversions > 0 ? totalSpend / totalConversions : 0;
}

/**
 * POST /api/optimization-insights/analyze
 * Run all optimization modules and return standardized recommendations
 */
router.post('/analyze', authenticate, requireRoles('USER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { agent_id, campaign_id, modules, include_sentiment } = req.body;
    
    if (!agent_id || !campaign_id) {
      return res.status(400).json({ detail: 'agent_id and campaign_id are required' });
    }
    
    // Verify agent access
    const agent = await Agent.findOne({ id: agent_id });
    if (!agent) {
      return res.status(404).json({ detail: 'Agent not found' });
    }
    
    if (req.user!.role !== 'ADMIN' && agent.user_id !== req.user!.id) {
      return res.status(403).json({ detail: 'Access denied' });
    }
    
    // Fetch campaign and ad sets data from agent
    const agentUrl = `${config.agent.baseUrl}/meta/campaigns/${campaign_id}/adsets`;
    const response = await axios.get(agentUrl, { timeout: 15000 });
    const adSets = response.data?.ad_sets || response.data?.data || [];
    
    if (adSets.length === 0) {
      return res.status(404).json({ detail: 'No ad sets found for this campaign' });
    }
    
    // Enrich with computed metrics
    const enrichedAdSets = enrichArrayWithComputedMetrics(adSets);
    
    // Get campaign config
    const campaignConfig = await getCampaignConfig(agent_id, campaign_id);
    
    // Calculate account average CPA if not set
    if (!campaignConfig.account_avg_cpa) {
      campaignConfig.account_avg_cpa = calculateAccountAverageCPA(enrichedAdSets);
    }
    
    // Determine which modules to run
    const modulesToRun = modules || ['all'];
    const runAll = modulesToRun.includes('all');
    
    let recommendations: OptimizationRecommendation[] = [];
    
    // Module 1: Bleeding Budget
    if (runAll || modulesToRun.includes('bleeding_budget')) {
      const detector = new BleedingBudgetDetector(campaignConfig);
      recommendations.push(...detector.analyze(enrichedAdSets));
    }
    
    // Module 2: Creative Fatigue
    if (runAll || modulesToRun.includes('creative_fatigue')) {
      const detector = new CreativeFatigueDetector();
      // TODO: Fetch time comparison data from Meta API
      recommendations.push(...detector.analyze(enrichedAdSets));
    }
    
    // Module 3: Scaling Opportunities
    if (runAll || modulesToRun.includes('scaling')) {
      const detector = new ScalingOpportunitiesDetector(campaignConfig);
      // TODO: Fetch platform and hourly breakdowns from Meta API
      recommendations.push(...detector.analyze(enrichedAdSets));
    }
    
    // Module 4: Sentiment Analysis (optional, requires comments data)
    let sentimentResults: AdSentimentResult[] = [];
    if (include_sentiment) {
      try {
        // TODO: Fetch comments for each ad
        // For now, skip sentiment analysis if not available
      } catch (error) {
        console.error('Sentiment analysis error:', error);
      }
    }
    
    // Calculate summary statistics
    const summary = {
      total_recommendations: recommendations.length,
      critical_issues: recommendations.filter(r => r.priority === 'CRITICAL').length,
      high_priority: recommendations.filter(r => r.priority === 'HIGH').length,
      opportunities: recommendations.filter(r => r.priority === 'OPPORTUNITY').length,
      total_estimated_savings: recommendations.reduce((sum, r) => sum + (r.estimated_savings || 0), 0),
      total_estimated_revenue_increase: recommendations.reduce((sum, r) => sum + (r.estimated_revenue_increase || 0), 0),
      modules_run: runAll ? ['Bleeding Budget', 'Creative Fatigue', 'Scaling Opportunities'] : modulesToRun,
    };
    
    res.json({
      campaign_id,
      recommendations,
      summary,
      config: {
        target_cpa: campaignConfig.target_cpa || campaignConfig.account_avg_cpa,
        target_roas: campaignConfig.target_roas,
        account_avg_cpa: campaignConfig.account_avg_cpa,
      },
      analyzed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Optimization analysis error:', error);
    res.status(500).json({ detail: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/optimization-insights/module/:module_name
 * Run a specific optimization module
 */
router.post('/module/:module_name', authenticate, requireRoles('USER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { module_name } = req.params;
    const { agent_id, campaign_id } = req.body;
    
    if (!agent_id || !campaign_id) {
      return res.status(400).json({ detail: 'agent_id and campaign_id are required' });
    }
    
    // Verify agent access
    const agent = await Agent.findOne({ id: agent_id });
    if (!agent) {
      return res.status(404).json({ detail: 'Agent not found' });
    }
    
    if (req.user!.role !== 'ADMIN' && agent.user_id !== req.user!.id) {
      return res.status(403).json({ detail: 'Access denied' });
    }
    
    // Fetch ad sets data
    const agentUrl = `${config.agent.baseUrl}/meta/campaigns/${campaign_id}/adsets`;
    const response = await axios.get(agentUrl, { timeout: 15000 });
    const adSets = response.data?.ad_sets || response.data?.data || [];
    
    if (adSets.length === 0) {
      return res.status(404).json({ detail: 'No ad sets found for this campaign' });
    }
    
    // Enrich with computed metrics
    const enrichedAdSets = enrichArrayWithComputedMetrics(adSets);
    
    // Get campaign config
    const campaignConfig = await getCampaignConfig(agent_id, campaign_id);
    if (!campaignConfig.account_avg_cpa) {
      campaignConfig.account_avg_cpa = calculateAccountAverageCPA(enrichedAdSets);
    }
    
    let recommendations: OptimizationRecommendation[] = [];
    
    // Run specific module
    switch (module_name) {
      case 'bleeding_budget':
        const bleedingBudget = new BleedingBudgetDetector(campaignConfig);
        recommendations = bleedingBudget.analyze(enrichedAdSets);
        break;
        
      case 'creative_fatigue':
        const creativeFatigue = new CreativeFatigueDetector();
        recommendations = creativeFatigue.analyze(enrichedAdSets);
        break;
        
      case 'scaling':
        const scaling = new ScalingOpportunitiesDetector(campaignConfig);
        recommendations = scaling.analyze(enrichedAdSets);
        break;
        
      default:
        return res.status(400).json({ 
          detail: `Unknown module: ${module_name}. Available: bleeding_budget, creative_fatigue, scaling` 
        });
    }
    
    res.json({
      campaign_id,
      module: module_name,
      recommendations,
      count: recommendations.length,
      analyzed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`Module ${req.params.module_name} error:`, error);
    res.status(500).json({ detail: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/optimization-insights/sentiment
 * Run sentiment analysis on ad comments
 */
router.post('/sentiment', authenticate, requireRoles('USER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { agent_id, ad_ids } = req.body;
    
    if (!agent_id || !ad_ids || !Array.isArray(ad_ids)) {
      return res.status(400).json({ detail: 'agent_id and ad_ids (array) are required' });
    }
    
    // Verify agent access
    const agent = await Agent.findOne({ id: agent_id });
    if (!agent) {
      return res.status(404).json({ detail: 'Agent not found' });
    }
    
    if (req.user!.role !== 'ADMIN' && agent.user_id !== req.user!.id) {
      return res.status(403).json({ detail: 'Access denied' });
    }
    
    // Fetch comments for each ad from Meta API
    // TODO: Implement Meta API comment fetching through agent
    const adsWithComments: Array<{ ad: any; comments: any[] }> = [];
    
    // For now, return placeholder
    const result = await batchAnalyzeAdSentiments(adsWithComments);
    
    res.json({
      ...result,
      analyzed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({ detail: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/optimization-insights/config
 * Update campaign optimization config (Target CPA, Target ROAS)
 */
router.post('/config', authenticate, requireRoles('USER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { agent_id, campaign_id, target_cpa, target_roas } = req.body;
    
    if (!agent_id || !campaign_id) {
      return res.status(400).json({ detail: 'agent_id and campaign_id are required' });
    }
    
    // Verify agent access
    const agent = await Agent.findOne({ id: agent_id });
    if (!agent) {
      return res.status(404).json({ detail: 'Agent not found' });
    }
    
    if (req.user!.role !== 'ADMIN' && agent.user_id !== req.user!.id) {
      return res.status(403).json({ detail: 'Access denied' });
    }
    
    // TODO: Store config in database (create CampaignConfig model)
    // For now, just validate and return
    
    const config: ModuleConfig = {};
    
    if (target_cpa !== undefined) {
      if (typeof target_cpa !== 'number' || target_cpa <= 0) {
        return res.status(400).json({ detail: 'target_cpa must be a positive number' });
      }
      config.target_cpa = target_cpa;
    }
    
    if (target_roas !== undefined) {
      if (typeof target_roas !== 'number' || target_roas <= 0) {
        return res.status(400).json({ detail: 'target_roas must be a positive number' });
      }
      config.target_roas = target_roas;
    }
    
    res.json({
      campaign_id,
      config,
      message: 'Configuration updated successfully',
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Config update error:', error);
    res.status(500).json({ detail: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/optimization-insights/execute-action
 * Execute a recommended action (pause, activate, budget change) on a Meta ad set
 */
router.post('/execute-action', authenticate, requireRoles('USER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { agent_id, action_type, entity_id, action_params } = req.body;

    if (!agent_id || !action_type || !entity_id) {
      return res.status(400).json({ detail: 'agent_id, action_type, and entity_id are required' });
    }

    // Verify agent access
    const agent = await Agent.findOne({ id: agent_id });
    if (!agent) {
      return res.status(404).json({ detail: 'Agent not found' });
    }

    if (req.user!.role !== 'ADMIN' && agent.user_id !== req.user!.id) {
      return res.status(403).json({ detail: 'Access denied' });
    }

    let result;

    switch (action_type) {
      case 'pause':
        // Pause the ad set
        const pauseUrl = `${config.agent.baseUrl}/meta/adsets/${entity_id}/status`;
        const pauseResponse = await axios.put(pauseUrl, { status: 'PAUSED' }, { timeout: 15000 });
        result = pauseResponse.data;
        break;

      case 'activate':
        // Activate the ad set
        const activateUrl = `${config.agent.baseUrl}/meta/adsets/${entity_id}/status`;
        const activateResponse = await axios.put(activateUrl, { status: 'ACTIVE' }, { timeout: 15000 });
        result = activateResponse.data;
        break;

      case 'budget':
        // Update ad set budget
        if (!action_params || (!action_params.daily_budget && !action_params.lifetime_budget)) {
          return res.status(400).json({ detail: 'budget action requires daily_budget or lifetime_budget in action_params' });
        }
        const budgetUrl = `${config.agent.baseUrl}/meta/adsets/${entity_id}/budget`;
        const budgetPayload: any = {};
        if (action_params.daily_budget) {
          budgetPayload.daily_budget = action_params.daily_budget;
        }
        if (action_params.lifetime_budget) {
          budgetPayload.lifetime_budget = action_params.lifetime_budget;
        }
        const budgetResponse = await axios.put(budgetUrl, budgetPayload, { timeout: 15000 });
        result = budgetResponse.data;
        break;

      default:
        return res.status(400).json({
          detail: `Unknown action_type: ${action_type}. Supported: pause, activate, budget`
        });
    }

    // Check for application-level errors in the response
    if (result && result.status === 'error') {
      return res.status(400).json({
        success: false,
        detail: result.message || result.error_details || 'Agent returned an error',
        agent_response: result,
      });
    }

    res.json({
      success: true,
      action_type,
      entity_id,
      result,
      executed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Execute action error:', error);

    let errorMessage = error.message || 'Internal server error';

    // Extract detailed error from axios response
    if (error.response) {
      if (error.response.data) {
        if (error.response.data.status === 'error') {
          errorMessage = error.response.data.message || error.response.data.error_details || errorMessage;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        }
      }
    }

    res.status(500).json({
      success: false,
      detail: errorMessage,
    });
  }
});

export default router;



