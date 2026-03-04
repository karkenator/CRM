import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

/* ─── Icons ─────────────────────────────────────────────────────────────── */

const ActionCenterIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const TopCreativesIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TopAdsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const AgentsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.318 2.552l-3.55-.532a54.077 54.077 0 00-8.518 0l-3.55.532c-1.348.246-2.317-1.552-1.318-2.552L5 14.5" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m9-9.13a4 4 0 11-8 0 4 4 0 018 0zm-9 0a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CreativeStudioIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
  </svg>
);

const NotificationsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
  </svg>
);

/* ─── Nav config ─────────────────────────────────────────────────────────── */

const navItems: NavItem[] = [
  { label: 'Action Center',  path: '/action-center',  icon: <ActionCenterIcon /> },
  { label: 'Top Creatives',  path: '/top-creatives',  icon: <TopCreativesIcon /> },
  { label: 'Top Ads',        path: '/top-ads',        icon: <TopAdsIcon /> },
  { label: 'Agents',         path: '/agents',         icon: <AgentsIcon /> },
  { label: 'Users',          path: '/users',          icon: <UsersIcon /> },
  { label: 'Creative Studio',path: '/creative-studio',icon: <CreativeStudioIcon /> },
  { label: 'Notifications',  path: '/notifications',  icon: <NotificationsIcon /> },
];

/* ─── JWT helper ─────────────────────────────────────────────────────────── */

function parseToken(token: string | null): { email: string; role: string } | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      email: payload.email ?? payload.sub ?? '',
      role:  payload.role ?? 'USER',
    };
  } catch {
    return null;
  }
}

function initials(email: string): string {
  return email.charAt(0).toUpperCase() || 'A';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/* ─── Component ──────────────────────────────────────────────────────────── */

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const {
    campaigns,
    selectedCampaign,
    setSelectedCampaign,
    loading: workspaceLoading,
    campaignsLoading,
  } = useWorkspace();

  const user = useMemo(
    () => parseToken(localStorage.getItem('access_token')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localStorage.getItem('access_token')]
  );

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  /* ── Sidebar nav items ── */
  const renderNav = (onNavigate?: () => void) =>
    navItems.map((item) => {
      const active = isActive(item.path);
      return (
        <button
          key={item.path}
          onClick={() => { navigate(item.path); onNavigate?.(); }}
          className={[
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            active
              ? 'bg-brand text-white'
              : 'text-gray-700 hover:bg-brand-light',
          ].join(' ')}
        >
          <span className={active ? 'text-white' : 'text-gray-400'}>
            {item.icon}
          </span>
          {item.label}
        </button>
      );
    });

  /* ── Sidebar shell ── */
  const sidebarShell = (onNavigate?: () => void) => (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="px-5 py-4 shrink-0">
        <Logo />
      </div>

      {/* Workspace Selector — shows campaigns */}
      <div className="px-3 pb-3 shrink-0 relative">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-1">
          Workspace
        </p>
        <button
          onClick={() => setWorkspaceOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-900 truncate">
            {workspaceLoading || campaignsLoading
              ? '…'
              : selectedCampaign?.name ?? 'No campaigns'}
          </span>
          <ChevronDownIcon />
        </button>

        {workspaceOpen && campaigns.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => {
                  setSelectedCampaign(campaign);
                  setWorkspaceOpen(false);
                  onNavigate?.();
                }}
                className={[
                  'w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-gray-50',
                  selectedCampaign?.id === campaign.id
                    ? 'text-brand font-semibold bg-blue-50'
                    : 'text-gray-700',
                ].join(' ')}
              >
                <div className="truncate">{campaign.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                  {campaign.objective} · {campaign.status}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-1">
        {renderNav(onNavigate)}
      </nav>

      {/* AI Assistant button */}
      <div className="px-3 pb-2 shrink-0">
        <button
          onClick={() => { navigate('/ai-assistant'); onNavigate?.(); }}
          className={[
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            isActive('/ai-assistant')
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90',
          ].join(' ')}
        >
          <SparkleIcon />
          AI Assistant
        </button>
      </div>

      {/* Bottom actions */}
      <div className="px-3 pb-5 pt-2 border-t border-gray-100 shrink-0 space-y-0.5">
        <button
          onClick={() => { navigate('/settings'); onNavigate?.(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-light transition-colors"
        >
          <span className="text-gray-400"><SettingsIcon /></span>
          Settings
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-light transition-colors"
        >
          <span className="text-gray-400"><LogoutIcon /></span>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0">
        {sidebarShell()}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[220px] z-50">
            {sidebarShell(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 h-[60px] flex items-center justify-between shrink-0">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden md:block" />

          {/* User identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {user ? initials(user.email) : 'A'}
            </div>
            {user && (
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">
                  {user.email}
                </span>
                <span className="text-xs text-gray-500">{capitalize(user.role)}</span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
