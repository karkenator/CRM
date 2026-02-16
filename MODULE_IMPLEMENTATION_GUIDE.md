# Modular Optimization System - Implementation Guide

## 🎯 Overview

This document describes the complete implementation of the **Modular Optimization System** for the Meta Ads CRM platform. The system analyzes campaigns using AI-powered logic modules to identify cost waste, creative fatigue, and scaling opportunities.

---

## 📂 Architecture

### Backend Components

1. **`backend/src/utils/computedMetrics.ts`**
   - Calculates advanced metrics not provided by Meta API
   - Metrics: Thumbstop Ratio, Hold Rate, Drop-Off Rate, CPA, ROAS
   - Enriches ad set data with computed values

2. **`backend/src/utils/optimizationModules.ts`**
   - Contains all optimization logic modules
   - **Module 1**: Bleeding Budget Detector (3 rules)
   - **Module 2**: Creative Fatigue Detector (3+ rules)
   - **Module 3**: Scaling Opportunities Detector (4 rules)
   - Returns standardized `OptimizationRecommendation` objects

3. **`backend/src/utils/sentimentAnalysis.ts`**
   - Analyzes ad comments for negative sentiment
   - Detects patterns: scam, pricing issues, quality problems
   - Protects brand reputation

4. **`backend/src/routes/optimization-insights.ts`**
   - New API endpoints for modular analysis
   - `/api/optimization-insights/analyze` - Run all modules
   - `/api/optimization-insights/module/:module_name` - Run specific module
   - `/api/optimization-insights/sentiment` - Sentiment analysis
   - `/api/optimization-insights/config` - Configure Target CPA/ROAS

5. **`backend/src/models/CampaignConfig.ts`**
   - Stores campaign-specific optimization config
   - Fields: `target_cpa`, `target_roas`

### Agent Service Updates

**`agent/app/meta_client.py`** - Enhanced Meta API client:
- Fetches video metrics (`video_3_sec_watched_actions`, `video_thruplay_watched_actions`)
- Fetches landing page metrics (`landing_page_views`, `outbound_clicks`)
- Fetches action values for ROAS calculation
- New methods:
  - `get_insights_with_breakdowns()` - Platform/time breakdowns
  - `get_platform_breakdown()` - Facebook vs Instagram performance
  - `get_hourly_breakdown()` - Dayparting analysis
  - `get_time_comparison_insights()` - Last 7d vs 30d comparison
  - `get_ad_comments()` - Fetch comments for sentiment analysis

---

## 🔍 Module Details

### Module 1: Bleeding Budget Detector

**Goal**: Identify wasted spend with zero return

#### Rule 1.1: Zero-Conversion Spend
- **Condition**: `(Spend > 2x Target_CPA) AND (Conversions == 0)`
- **Priority**: CRITICAL
- **Message**: "Pause this Ad Set immediately. You have wasted $X with 0 results."
- **Action**: Pause ad set

#### Rule 1.2: CPA Outliers
- **Condition**: `Ad_CPA > (2x Campaign_Avg_CPA)`
- **Priority**: HIGH
- **Message**: "This ad is 2x more expensive than your average. Turn it off to save budget."
- **Action**: Pause ad set

#### Rule 1.3: Learning Phase Trap
- **Condition**: `(Status == "LEARNING_LIMITED") AND (Daily_Budget < (Target_CPA / 7))`
- **Priority**: MEDIUM
- **Message**: "Your budget is too low to exit the Learning Phase. Consolidate ad sets."
- **Action**: Increase budget or consolidate

---

### Module 2: Creative Fatigue & Health

**Goal**: Detect when ads are "dying" before user notices

#### Rule 2.1: Fatigue Detection
- **Condition**: `(Frequency > 4.0) AND (CTR_Last_7d < CTR_Last_30d)`
- **Priority**: HIGH
- **Message**: "Ad Fatigue Detected: People are seeing this ad too often and ignoring it. Swap creative now."

#### Rule 2.2: Format Diversity
- **Condition**: `Ad_Types NOT INCLUDES ["Reels", "Story"]`
- **Priority**: MEDIUM
- **Message**: "You are missing 40% of inventory by not having 9:16 vertical video assets. Add 2 Reels."

#### Rule 2.3: Hook Rate Diagnosis
- **Condition**: `Thumbstop_Ratio < 25%`
- **Priority**: MEDIUM
- **Message**: "Your video hook is weak. The first 3 seconds are losing 75% of viewers. Test a new intro."

#### Additional Rules (Bonus):
- **Hold Rate**: Video completion after hook
- **Drop-Off Rate**: Clicks but no landing page views

---

### Module 3: Scaling Opportunities

**Goal**: Show how to make more money

#### Rule 3.1: Restricted Winner
- **Condition**: `(ROAS > 4.0) AND (Budget_Utilization > 95%)`
- **Priority**: OPPORTUNITY
- **Message**: "Uncap Growth: This campaign is profitable (4x ROAS) but limited by budget. Increase daily budget by 20%."

#### Rule 3.2: Dayparting Opportunity
- **Condition**: `Conversion_Rate_Night > 2x Conversion_Rate_Morning`
- **Priority**: OPPORTUNITY
- **Message**: "Dayparting Opp: Your customers buy at night. Shift 70% of budget to 6 PM - 12 AM."

#### Rule 3.3: Platform Arbitrage
- **Condition**: `CPA_Instagram < 0.5 * CPA_Facebook`
- **Priority**: OPPORTUNITY
- **Message**: "Platform Win: Instagram generates leads at half the cost. Shift budget to Instagram Only placements."

#### Rule 3.4: Horizontal Scaling
- **Condition**: `(Audience == "Lookalike_1%") AND (ROAS > Target_ROAS)`
- **Priority**: OPPORTUNITY
- **Message**: "Your 1% Lookalike is maxed out. Launch a 3-5% Lookalike audience using the same creative."

---

### Sentiment Analysis Module

**Goal**: Protect brand reputation

#### Logic:
1. Fetch ad comments via Meta API
2. Scan for negative keyword clusters: `['scam', 'fake', 'too expensive', 'broken', 'fraud']`
3. Calculate negative percentage: `(Negative_Comments / Total_Comments) * 100`
4. **Threshold**: 20% negative comments

#### Output:
- **Priority**: CRITICAL if > 40% negative, HIGH if > 20%
- **Message**: "Your ad has high Negative Sentiment. People are commenting 'Scam'. Pause this ad to protect brand reputation."

---

## 📊 Computed Metrics

### Video Metrics

```typescript
Thumbstop Ratio = (video_3_sec_watched_actions / impressions) * 100
// Industry benchmark: 25%

Hold Rate = (video_thruplay_watched_actions / video_3_sec_watched_actions) * 100
// Measures if people watch beyond 3 seconds
```

### Funnel Metrics

```typescript
Drop-Off Rate = ((clicks - landing_page_views) / clicks) * 100
// High drop-off (>40%) = broken links, slow pages

Click-to-Landing Rate = (landing_page_views / clicks) * 100
```

### Cost Efficiency

```typescript
CPA = spend / conversions
ROAS = revenue / spend
Budget Utilization = (spend / daily_budget) * 100
```

---

## 🚀 API Usage

### Run All Optimization Modules

```bash
POST /api/optimization-insights/analyze
{
  "agent_id": "agt_123",
  "campaign_id": "campaign_456",
  "modules": ["all"],  // or specific: ["bleeding_budget", "creative_fatigue", "scaling"]
  "include_sentiment": false
}
```

**Response:**

```json
{
  "campaign_id": "campaign_456",
  "recommendations": [
    {
      "id": "rec_bleeding_zero_12345",
      "type": "budget_waste",
      "priority": "CRITICAL",
      "related_entity_id": "adset_12345",
      "related_entity_name": "US_Broad_18-65",
      "detected_value": 450.00,
      "benchmark_value": 0,
      "metric_label": "Wasted Spend (Zero Conversions)",
      "message": "🚨 Pause this Ad Set immediately. You have wasted $450.00 with 0 results...",
      "action_endpoint": "/api/adsets/adset_12345/pause",
      "estimated_savings": 450.00,
      "confidence": 95,
      "module": "Bleeding Budget Detector"
    }
  ],
  "summary": {
    "total_recommendations": 15,
    "critical_issues": 2,
    "high_priority": 5,
    "opportunities": 3,
    "total_estimated_savings": 1250.00,
    "total_estimated_revenue_increase": 3500.00,
    "modules_run": ["Bleeding Budget", "Creative Fatigue", "Scaling Opportunities"]
  },
  "config": {
    "target_cpa": 50.00,
    "target_roas": 4.0,
    "account_avg_cpa": 45.50
  },
  "analyzed_at": "2026-01-13T10:30:00.000Z"
}
```

### Run Specific Module

```bash
POST /api/optimization-insights/module/bleeding_budget
{
  "agent_id": "agt_123",
  "campaign_id": "campaign_456"
}
```

### Configure Campaign

```bash
POST /api/optimization-insights/config
{
  "agent_id": "agt_123",
  "campaign_id": "campaign_456",
  "target_cpa": 50.00,
  "target_roas": 4.0
}
```

### Sentiment Analysis

```bash
POST /api/optimization-insights/sentiment
{
  "agent_id": "agt_123",
  "ad_ids": ["ad_111", "ad_222", "ad_333"]
}
```

---

## 🎨 Frontend Integration

### New Component (To Be Updated)

`frontend/src/components/OptimizationInsightsDashboard.tsx`

Display recommendations with:
- Priority badges (CRITICAL, HIGH, MEDIUM, OPPORTUNITY)
- Module labels
- Action buttons (Pause Ad Set, View Details)
- Estimated savings/revenue
- Confidence scores

### Update Existing Component

`frontend/src/components/CampaignHealthDashboard.tsx`

Add:
- Button to run modular analysis
- Display new recommendation format
- Configuration panel for Target CPA/ROAS

---

## 🧪 Testing

### Test Scenarios

1. **Zero Conversions Test**
   - Ad set with $100 spend, 0 conversions
   - Should trigger "Bleeding Budget" CRITICAL alert

2. **CPA Outlier Test**
   - Campaign avg CPA: $25
   - Ad set CPA: $60
   - Should trigger CPA Outlier HIGH alert

3. **Creative Fatigue Test**
   - Frequency: 5.2
   - CTR last 7d: 1.2%, CTR last 30d: 2.1%
   - Should trigger Fatigue Detection HIGH alert

4. **Scaling Opportunity Test**
   - ROAS: 5.5
   - Budget utilization: 98%
   - Should trigger Restricted Winner OPPORTUNITY

5. **Sentiment Analysis Test**
   - 50 comments, 15 negative (30%)
   - Should trigger Sentiment Warning HIGH alert

---

## 📝 Configuration

### Target CPA Sources (Priority Order)

1. **User-configured**: Set via `/api/optimization-insights/config`
2. **Campaign average**: Calculated from ad set performance
3. **Account average**: Calculated from all campaigns

### Default Values

```typescript
{
  target_roas: 4.0,
  negative_sentiment_threshold: 20, // percent
  thumbstop_benchmark: 25, // percent
  frequency_threshold: 4.0,
  budget_utilization_threshold: 95 // percent
}
```

---

## 🔄 Future Enhancements

1. **ML-Based Predictions**: Train models on historical data to predict ad fatigue before it happens
2. **Automated Actions**: Auto-pause ads based on rules (with user approval)
3. **A/B Test Recommendations**: Suggest specific creative tests based on winning patterns
4. **Competitive Analysis**: Compare performance against industry benchmarks
5. **Budget Reallocation Simulator**: "What if" scenarios for budget shifts

---

## 📞 Support

For questions or issues:
- Check logs: `backend/logs/` and `agent/logs/`
- Review API responses for error details
- Verify Meta API permissions and token validity

---

## ✅ Implementation Checklist

- [x] Update Meta API client with enhanced fields
- [x] Create computed metrics helper
- [x] Implement Module 1: Bleeding Budget Detector
- [x] Implement Module 2: Creative Fatigue Detector
- [x] Implement Module 3: Scaling Opportunities Detector
- [x] Add Sentiment Analysis module
- [x] Create new API endpoints
- [x] Add CampaignConfig model
- [x] Update API response structure
- [ ] Update frontend to display new insights ← IN PROGRESS
- [ ] Add unit tests for modules
- [ ] Add integration tests for API endpoints
- [ ] Create user documentation
- [ ] Deploy to production

---

**Version**: 1.0  
**Last Updated**: 2026-01-13  
**Implemented By**: AI Assistant



