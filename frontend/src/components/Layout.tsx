import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

/* ─── Icons ─────────────────────────────────────────────────────────────── */

const DashboardIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AgentsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

/* ─── Nav config ─────────────────────────────────────────────────────────── */

const navItems: NavItem[] = [
  { label: 'Dashboard',       path: '/dashboard',       icon: <DashboardIcon /> },
  { label: 'Agents',          path: '/agents',          icon: <AgentsIcon /> },
  { label: 'Users',           path: '/users',           icon: <UsersIcon /> },
  { label: 'Creative Studio', path: '/creative-studio', icon: <CreativeStudioIcon /> },
  { label: 'Notifications',   path: '/notifications',   icon: <NotificationsIcon /> },
];

/* ─── JWT helper ─────────────────────────────────────────────────────────── */

function parseToken(token: string | null): { email: string; role: string } | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      // prefer email over sub — sub is the MongoDB user ID
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
  const navigate  = useNavigate();
  const location  = useLocation();

  const user = useMemo(
    () => parseToken(localStorage.getItem('access_token')),
    // re-parse whenever storage changes (login/logout)
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
            'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
            active
              ? 'bg-brand text-white'
              : 'text-gray-800 hover:bg-brand-light',
          ].join(' ')}
        >
          <span className={active ? 'text-white' : 'text-gray-400'}>
            {item.icon}
          </span>
          {item.label}
        </button>
      );
    });

  /* ── Bottom actions ── */
  const renderBottom = (onNavigate?: () => void) => (
    <>
      <button
        onClick={() => { navigate('/settings'); onNavigate?.(); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-800 hover:bg-brand-light transition-colors"
      >
        <span className="text-gray-400"><SettingsIcon /></span>
        Settings
      </button>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-800 hover:bg-brand-light transition-colors"
      >
        <span className="text-gray-400"><LogoutIcon /></span>
        Logout
      </button>
    </>
  );

  /* ── Sidebar shell ── */
  const sidebarShell = (onNavigate?: () => void) => (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="px-5 py-5 shrink-0">
        <Logo />
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-1">
        {renderNav(onNavigate)}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-5 pt-3 border-t border-gray-100 shrink-0 space-y-0.5">
        {renderBottom(onNavigate)}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[200px] shrink-0">
        {sidebarShell()}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[200px] z-50">
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

          {/* Spacer for desktop (no title in header — title is inside page content) */}
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
