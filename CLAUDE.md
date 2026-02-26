# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AcesMaster CRM is a Meta Ads management platform for campaign optimization and analysis. It is a three-tier monorepo:

- **`frontend/`** — React + TypeScript (Vite, Tailwind CSS)
- **`backend/`** — Node.js Express + TypeScript (MongoDB via Mongoose)
- **`agent/`** — Python FastAPI service that interfaces with the Meta Ads API

## Commands

### Frontend
```bash
cd frontend
npm run dev      # Dev server on port 3000 (proxies API to localhost:8000)
npm run build    # TypeScript compile + Vite build
npm run preview  # Preview production build
```

### Backend
```bash
cd backend
npm run dev      # Development with tsx watch
npm run build    # Compile TypeScript
npm start        # Run compiled output
npm run create-admin  # Create an admin user
```

### Agent (Python)
```bash
cd agent
source .venv/bin/activate
python run.py    # Start FastAPI/Uvicorn server
```

## Architecture

### Data Flow
Meta Ads API → Agent (Python/FastAPI) → Backend (Express) → MongoDB → Frontend (React)

The **agent** fetches data from Meta and POSTs it to the backend `/api/ingest` route. The backend stores it and exposes aggregated data to the frontend via REST APIs. The frontend proxies all `/api/*` requests to `http://localhost:8000` (the backend).

### Backend Structure

**Routes** (`backend/src/routes/`): auth, users, agents, ad-accounts, commands, ingest, ad-set-rules, campaign-insights, optimization-insights, meta (proxy), healthz

**Key Utilities** (`backend/src/utils/`):
- `computedMetrics.ts` — Calculates Thumbstop Ratio, Hold Rate, Drop-Off Rate, CPA, ROAS, and other derived metrics
- `optimizationModules.ts` — Three modular optimization engines (Bleeding Budget, Creative Fatigue, Scaling Opportunities)
- `sentimentAnalysis.ts` — Analyzes ad comments for negative sentiment
- `ruleExecutor.ts` — Executes automation rules (PAUSE/ACTIVATE) on ad sets
- `ai.ts` — OpenAI integration for AI-generated insights

**Background Tasks** (`backend/src/tasks/`): Scheduled via `node-cron` for optimization analysis, metric collection, and health checks.

**Models** (`backend/src/models/`): User, Agent, AdAccount, Campaign, AdSet, Ad, DailyMetric, MetricSnapshot, Command, CommandResult, AdSetRule, CampaignConfig, PasswordReset

### Frontend Structure

**Pages** (`frontend/src/pages/`): Dashboard, Agents, AgentDetails (main view), Commands, Users

**Key Components** (`frontend/src/components/`):
- `OptimizationInsightsDashboard.tsx` — Main optimization analysis UI
- `CampaignHealthDashboard.tsx` — Campaign performance metrics
- `AIRuleChatbot.tsx` — AI-powered rule creation chatbot
- `CampaignRules.tsx` — Rule management UI
- `Layout.tsx` — Sidebar and navigation wrapper

**Services** (`frontend/src/services/api.ts`): Axios client with JWT auth interceptors and auto-refresh on 401.

### Optimization System

The core feature is a three-module optimization engine in `optimizationModules.ts`:

1. **Bleeding Budget Detector** — Zero-conversion spend, CPA outliers, learning phase traps
2. **Creative Fatigue Detector** — High frequency + declining CTR, weak hook rate, hold rate/drop-off issues
3. **Scaling Opportunities Detector** — Budget-restricted winners, dayparting, platform arbitrage (Instagram vs Facebook), lookalike expansion

All recommendations follow a standard `OptimizationRecommendation` interface with `priority` (CRITICAL/HIGH/MEDIUM/LOW/OPPORTUNITY), `detected_value`, `benchmark_value`, `estimated_savings`, `estimated_revenue_increase`, and `confidence` fields.

### Authentication

JWT-based with access + refresh tokens. Tokens are stored in localStorage. The backend middleware in `backend/src/middleware/auth.ts` handles role-based access control (USER, ADMIN). Auth and general requests are rate-limited separately.

### Configuration

Backend config is loaded from `backend/src/config/index.ts` and reads from environment variables: MongoDB URI, JWT secret, SMTP settings, CORS origin, agent base URL, and OpenAI API key.

### Agent Service

`agent/app/meta_client.py` provides:
- `get_insights_with_breakdowns()` — Platform/time breakdowns
- `get_platform_breakdown()` — Facebook vs Instagram CPA comparison
- `get_hourly_breakdown()` — Dayparting analysis
- `get_ad_comments()` — Data for sentiment analysis

# Project: CRM x Meta Multi-Account Manager with AI Optimization

## Objective
Build a CRM that:
1. Connects and manages multiple Meta Ad Accounts per CRM account
2. Provides deterministic AI-driven campaign optimization recommendations

---

## Core Principles

- Multi-tenant safe: every query scoped to crm_account_id
- Deterministic rules engine (no LLM for budget logic)
- Idempotent sync jobs
- Strict audit logging for destructive actions
- No prompt injection from ad comments or creative names
- Never hardcode tokens

---

## Architecture

Backend responsibilities:
- OAuth for Meta
- Ad account discovery
- Insights ingestion
- Custom metric computation
- Rules engine evaluation
- Recommendations API
- Action endpoints (pause, scale, etc.)

Frontend responsibilities:
- Multi-account switcher
- Recommendations dashboard
- Action confirmation UI

---

## AI Engine Rules

- Use computed metrics:
  thumbstopRatio
  holdRate
  dropOffRate
- Apply rule modules:
  Budget waste
  Creative fatigue
  Scaling opportunity
  Optional sentiment module
- Output stable JSON contract for recommendations

---

## Non-Negotiable Safety Rules

- Never mix tenants
- Never execute ad actions without explicit user confirmation
- Always include audit log
- Handle Meta API rate limits with retry & backoff
- Do not hallucinate metrics