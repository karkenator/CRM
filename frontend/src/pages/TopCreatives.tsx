import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { MetaAd } from '../types';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface EnrichedAd extends MetaAd {
  adsetName?: string;
  rank: number;
}

type ViewMode = 'list' | 'grid';

/* ─── Metric config ──────────────────────────────────────────────────────── */

const ALL_METRICS = [
  { key: 'spend',             label: 'Amount Spent',      color: '#3B82F6' },
  { key: 'purchases',         label: 'Purchases',         color: '#8B5CF6' },
  { key: 'cost_per_purchase', label: 'Cost Per Purchase', color: '#F59E0B' },
  { key: 'impressions',       label: 'Impressions',       color: '#EC4899' },
  { key: 'cpm',               label: 'CPM',               color: '#10B981' },
  { key: 'ctr',               label: 'CTR',               color: '#6366F1' },
];

const DEFAULT_METRICS = ['spend', 'purchases', 'cost_per_purchase', 'impressions'];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getSpendRaw(ad: MetaAd): number {
  return parseFloat(ad.performance_metrics?.spend ?? '0') || 0;
}

function getMetricValue(ad: MetaAd, key: string): string {
  const pm = ad.performance_metrics;
  if (!pm) return '—';
  switch (key) {
    case 'spend':
      return pm.spend ? `€${parseFloat(pm.spend).toFixed(2)}` : '—';
    case 'purchases':
      return (
        pm.actions?.find(
          (a: any) =>
            a.action_type === 'purchase' ||
            a.action_type === 'offsite_conversion.fb_pixel_purchase'
        )?.value ?? '—'
      );
    case 'cost_per_purchase':
      return pm.cost_per_action?.[0]?.value
        ? `€${parseFloat(pm.cost_per_action[0].value).toFixed(2)}`
        : '—';
    case 'impressions':
      return pm.impressions ? `${(Number(pm.impressions) / 1000).toFixed(1)}K` : '—';
    case 'cpm':
      return pm.cpm ? `€${parseFloat(pm.cpm).toFixed(2)}` : '—';
    case 'ctr':
      return pm.ctr ? `${parseFloat(pm.ctr).toFixed(2)}%` : '—';
    default:
      return '—';
  }
}

function getResults(ad: MetaAd): string {
  return ad.performance_metrics?.actions?.[0]?.value ?? '—';
}

function getCostPerResult(ad: MetaAd): string {
  const v = ad.performance_metrics?.cost_per_action?.[0]?.value;
  return v ? `€${parseFloat(v).toFixed(2)}` : '—';
}

function getCPM(ad: MetaAd): string {
  const v = ad.performance_metrics?.cpm;
  return v ? `€${parseFloat(v).toFixed(2)}` : '—';
}

function getImpressions(ad: MetaAd): string {
  const v = ad.performance_metrics?.impressions;
  return v ? `${(Number(v) / 1000).toFixed(1)}K` : '—';
}

function getAmountSpent(ad: MetaAd): string {
  const v = ad.performance_metrics?.spend;
  return v ? `€${parseFloat(v).toFixed(2)}` : '—';
}

function getLikes(ad: MetaAd): number {
  const pm = ad.performance_metrics;
  if (!pm) return 0;
  if (pm.reactions) return Number(pm.reactions);
  const found = pm.actions?.find(
    (a: any) =>
      a.action_type === 'post_reaction' ||
      a.action_type === 'like' ||
      a.action_type === 'post.like'
  );
  return Number(found?.value ?? 0);
}

function getThumbnail(ad: MetaAd): string | null {
  const pm = ad.performance_metrics;
  return pm?.thumbnail_url ?? pm?.creative?.thumbnail_url ?? null;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

const ThumbsUp: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
  </svg>
);

const AdThumbnail: React.FC<{ ad: MetaAd; className?: string }> = ({ ad, className = '' }) => {
  const url = getThumbnail(ad);
  return url ? (
    <img src={url} alt="" className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-gradient-to-br from-brand-light to-gray-100 ${className}`}>
      <span className="text-brand text-xs font-bold select-none">
        {ad.name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

const TopCreatives: React.FC = () => {
  const { selectedAgent, selectedCampaign, campaignsLoading } = useWorkspace();

  const [ads, setAds] = useState<EnrichedAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeMetrics, setActiveMetrics] = useState<string[]>(DEFAULT_METRICS);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  /* Fetch all ads for the selected campaign */
  const fetchCreatives = useCallback(async () => {
    if (!selectedAgent || !selectedCampaign) return;
    setLoading(true);
    try {
      const adsetsRes = await apiService.getCampaignAdSets(selectedAgent.id, selectedCampaign.id);
      const adsets = adsetsRes.data?.data ?? adsetsRes.data ?? [];

      const all: Omit<EnrichedAd, 'rank'>[] = [];
      await Promise.all(
        adsets.map(async (adset: any) => {
          try {
            const adsRes = await apiService.getAdSetAds(selectedAgent.id, adset.id);
            const adsetAds: MetaAd[] = adsRes.data?.data ?? adsRes.data ?? [];
            adsetAds.forEach((ad) => all.push({ ...ad, adsetName: adset.name }));
          } catch {
            /* skip failed adset */
          }
        })
      );

      all.sort((a, b) => getSpendRaw(b) - getSpendRaw(a));
      setAds(all.map((ad, i) => ({ ...ad, rank: i + 1 })));
    } catch {
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, selectedCampaign]);

  useEffect(() => { fetchCreatives(); }, [fetchCreatives]);

  /* Close picker on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = ads.filter((ad) =>
    ad.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleMetric = (key: string) =>
    setActiveMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const availableToAdd = ALL_METRICS.filter((m) => !activeMetrics.includes(m.key));

  /* ── Early exits ── */
  if (!selectedAgent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Agent Connected</h2>
        <p className="text-gray-500">Please connect an agent to view top creatives.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Top Creatives</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
          This report shows your highest-spending ads along with key performance metrics like ROAS and CTR.<br />
          You can adjust the sorting in the table below the chart.<br />
          A common use case is adding your preferred conversion action for deeper analysis.
        </p>
      </div>

      {/* ── Controls row: metrics chips + view toggle ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Metrics chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeMetrics.map((key) => {
            const meta = ALL_METRICS.find((m) => m.key === key);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full border border-gray-200 bg-white text-sm text-gray-700"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: meta?.color ?? '#6B7280' }}
                />
                {meta?.label ?? key}
                <button
                  onClick={() => toggleMetric(key)}
                  className="ml-0.5 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}

          {/* Add metrics */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add metrics
            </button>
            {showPicker && availableToAdd.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px]">
                {availableToAdd.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => { toggleMetric(m.key); setShowPicker(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg shrink-0">
          <button
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={[
              'p-1.5 rounded-md transition-colors',
              viewMode === 'list' ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={[
              'p-1.5 rounded-md transition-colors',
              viewMode === 'grid' ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search creatives..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading || campaignsLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      ) : !selectedCampaign ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-gray-500">Select a campaign from the workspace to view top creatives.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-gray-500">
            {ads.length === 0 ? 'No creatives found for this campaign.' : 'No results match your search.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* ════════════════════ LIST VIEW ════════════════════ */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3.5 text-sm font-medium text-gray-600 min-w-[280px]">Ad Name</th>
                  <th className="text-left px-5 py-3.5 text-sm font-medium text-gray-600">Amount Spent</th>
                  <th className="text-left px-5 py-3.5 text-sm font-medium text-gray-600">Impressions</th>
                  <th className="text-left px-5 py-3.5 text-sm font-medium text-gray-600">
                    CPM
                    <span className="block text-[11px] font-normal text-gray-400">(Cost Per Mile)</span>
                  </th>
                  <th className="text-left px-5 py-3.5 text-sm font-medium text-gray-600">Results</th>
                  <th className="text-left px-5 py-3.5 text-sm font-medium text-gray-600">Cost Per Result</th>
                  <th className="text-left px-5 py-3.5 text-sm font-medium text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                      Likes
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ad, idx) => {
                  const likes = getLikes(ad);
                  return (
                    <tr
                      key={ad.id}
                      className={[
                        'transition-colors hover:bg-gray-50',
                        idx < filtered.length - 1 ? 'border-b border-gray-100' : '',
                      ].join(' ')}
                    >
                      {/* Ad Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                            <AdThumbnail ad={ad} className="w-12 h-12" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2 max-w-[260px]">
                              {ad.name}
                            </div>
                            {ad.adsetName && (
                              <div className="text-xs text-gray-400 truncate max-w-[260px]">{ad.adsetName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-900">{getAmountSpent(ad)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-900">{getImpressions(ad)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-900">{getCPM(ad)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-900">{getResults(ad)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-900">{getCostPerResult(ad)}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                          <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                          {likes > 0 ? likes.toLocaleString() : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ════════════════════ GRID VIEW ════════════════════ */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((ad) => {
            const likes = getLikes(ad);
            const url = getThumbnail(ad);
            const metricsList = activeMetrics.map((key) => ({
              key,
              label: ALL_METRICS.find((m) => m.key === key)?.label ?? key,
              value: getMetricValue(ad, key),
              color: ALL_METRICS.find((m) => m.key === key)?.color ?? '#6B7280',
            }));

            return (
              <div
                key={ad.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100">
                  {url ? (
                    <img src={url} alt={ad.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-light to-gray-100">
                      <span className="text-brand text-lg font-bold select-none">
                        {ad.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Rank badge */}
                  <div className="absolute top-2 left-2 bg-brand/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    #{ad.rank}
                  </div>

                  {/* Thumbs-up overlay (FB style) */}
                  {likes > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
                      <ThumbsUp className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] font-semibold text-gray-700">{likes.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Video badge */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                    Video
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3">
                  <div className="text-xs font-semibold text-gray-900 line-clamp-2 mb-2 leading-tight">
                    #{ad.rank} {ad.name}
                  </div>

                  {/* Metrics */}
                  <div className="space-y-1.5">
                    {metricsList.map(({ key, label, value, color }) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-gray-500 truncate mr-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          {label}
                        </span>
                        <span className="font-semibold text-gray-900 shrink-0">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* FB-style thumbs up row */}
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs text-gray-500">
                      {likes > 0 ? likes.toLocaleString() : '—'} likes
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TopCreatives;
