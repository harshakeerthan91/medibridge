'use client';

import {useState} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {createSupabaseBrowserClient} from '@/lib/supabase/client';

interface AppLayoutProps {
  children: React.ReactNode;
  locale: string;
}

const NAV_ITEMS = [
  {key: 'home', href: '/home', icon: 'home'},
  {key: 'records', href: '/records', icon: 'file-text'},
  {key: 'ask', href: '/ask', icon: 'message-circle'},
  {key: 'schedule', href: '/schedule', icon: 'calendar'},
  {key: 'diary', href: '/diary', icon: 'book-open'},
] as const;

const SECONDARY_NAV = [
  {key: 'trends', href: '/trends', icon: 'trending-up'},
  {key: 'questions', href: '/questions', icon: 'help-circle'},
  {key: 'visitBrief', href: '/visit-brief', icon: 'clipboard'},
  {key: 'settings', href: '/settings', icon: 'settings'},
] as const;

function NavIcon({name}: {name: string}) {
  const icons: Record<string, React.ReactNode> = {
    'home': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    'file-text': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    'message-circle': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    'calendar': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    'book-open': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
    'trending-up': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    'help-circle': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    'clipboard': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    'settings': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    'log-out': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    'activity': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    'menu': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    'x': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  };
  return <>{icons[name] || null}</>;
}

export default function AppLayout({children, locale}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  function isActive(href: string) {
    return pathname.includes(href);
  }

  return (
    <div className="app-shell">
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 25}}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav className={`sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Main navigation">
        {/* Logo */}
        <Link href={`/${locale}/home`} className="nav-logo" onClick={() => setSidebarOpen(false)}>
          <div className="nav-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <span className="nav-logo-text">{t('app.name')}</span>
        </Link>

        {/* Primary nav */}
        <div className="nav-section" style={{flex: 1}}>
          <p className="nav-section-label">Navigation</p>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={`nav-item${isActive(item.href) ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              {t(`nav.${item.key}`)}
            </Link>
          ))}

          <div style={{height: '1px', background: 'var(--color-border)', margin: '12px 0'}} />
          <p className="nav-section-label">More</p>
          {SECONDARY_NAV.map(item => (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={`nav-item${isActive(item.href) ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <div style={{padding: '1rem', borderTop: '1px solid var(--color-border)'}}>
          <button className="nav-item w-full" onClick={handleSignOut} id="signout-btn">
            <NavIcon name="log-out" />
            {t('auth.logout')}
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="main-content">
        {/* Mobile header */}
        <header className="mobile-header">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >
            <NavIcon name={sidebarOpen ? 'x' : 'menu'} />
          </button>
          <span style={{fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-teal-700)'}}>
            {t('app.name')}
          </span>
          <div style={{width: 36}} />
        </header>

        {children}

        {/* Mobile bottom nav */}
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {NAV_ITEMS.slice(0, 5).map(item => (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={`mobile-nav-item${isActive(item.href) ? ' active' : ''}`}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
