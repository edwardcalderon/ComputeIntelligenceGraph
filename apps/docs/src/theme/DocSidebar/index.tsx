import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import type { Props } from '@theme/DocSidebar';
import './styles.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  type: string;
  label?: string;
  href?: string;
  items?: NavItem[];
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="cig-sb-menu-icon" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="cig-sb-close-icon" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`cig-sb-chevron${open ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ─── Sidebar Link ─────────────────────────────────────────────────────────────

function SidebarLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const location = useLocation();
  const href = item.href ?? '';
  const isActive = href !== '' && (location.pathname === href || location.pathname.startsWith(href + '/'));

  return (
    <li className="cig-sb-item">
      <Link to={href} onClick={onClose} className={`cig-sb-link${isActive ? ' active' : ''}`}>
        {isActive && <span className="cig-sb-active-bar" />}
        <span className="cig-sb-link-text">{item.label}</span>
      </Link>
    </li>
  );
}

// ─── Sidebar Category ─────────────────────────────────────────────────────────

function SidebarCategory({ item, onClose, depth = 0 }: { item: NavItem; onClose: () => void; depth?: number }) {
  const location = useLocation();
  const children = item.items ?? [];
  const hasActiveChild = children.some(
    (child) => child.href != null && (location.pathname === child.href || location.pathname.startsWith(child.href + '/'))
  );
  const [open, setOpen] = useState(hasActiveChild || depth === 0);

  return (
    <li className="cig-sb-category">
      <button
        className={`cig-sb-category-btn${open ? ' open' : ''}${hasActiveChild ? ' has-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="cig-sb-category-label">{item.label}</span>
        <ChevronIcon open={open} />
      </button>
      <div className={`cig-sb-category-items${open ? ' open' : ''}`}>
        <ul className="cig-sb-list cig-sb-list--nested">
          {children.map((child, i) =>
            child.type === 'category' ? (
              <SidebarCategory key={i} item={child} onClose={onClose} depth={depth + 1} />
            ) : (
              <SidebarLink key={i} item={child} onClose={onClose} />
            )
          )}
        </ul>
      </div>
    </li>
  );
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────

function SidebarContent({
  sidebar,
  version,
  landingUrl,
  onClose,
}: {
  sidebar: NavItem[];
  version: string;
  landingUrl: string;
  onClose: () => void;
}) {
  return (
    <div className="cig-sb-inner">
      {/* Brand */}
      <div className="cig-sb-brand">
        <Link to="/" className="cig-sb-brand-link" onClick={onClose}>
          <span className="cig-sb-brand-icon">
            <svg viewBox="20 20 216 216" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <linearGradient id="cigSbGrad" x1="48" y1="40" x2="208" y2="208" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#14B8A6" />
                </linearGradient>
                <radialGradient id="cigSbGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#ECFEFF" />
                  <stop offset="55%" stopColor="#A5F3FC" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </radialGradient>
              </defs>
              <g transform="rotate(90 128 128)">
                <g stroke="url(#cigSbGrad)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
                  <line x1="128" y1="52" x2="74" y2="174" />
                  <line x1="128" y1="52" x2="182" y2="174" />
                  <line x1="74" y1="174" x2="128" y2="146" />
                  <line x1="128" y1="146" x2="182" y2="174" />
                  <line x1="74" y1="174" x2="182" y2="174" />
                </g>
                <g fill="white" stroke="url(#cigSbGrad)" strokeWidth="6">
                  <circle cx="128" cy="52" r="14" />
                  <circle cx="74" cy="174" r="14" />
                  <circle cx="182" cy="174" r="14" />
                  <circle cx="128" cy="146" r="18" />
                </g>
                <circle cx="128" cy="146" r="9" fill="url(#cigSbGlow)" />
              </g>
            </svg>
          </span>
          <div className="cig-sb-brand-text">
            <span className="cig-sb-brand-name">CIG</span>
            <span className="cig-sb-brand-sub">Documentation</span>
          </div>
        </Link>
        {version && <span className="cig-sb-version">v{version}</span>}
      </div>

      {/* Nav */}
      <nav className="cig-sb-nav" aria-label="Documentation navigation">
        <ul className="cig-sb-list">
          {sidebar.map((item, i) =>
            item.type === 'category' ? (
              <SidebarCategory key={i} item={item} onClose={onClose} />
            ) : (
              <SidebarLink key={i} item={item} onClose={onClose} />
            )
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="cig-sb-footer">
        <a
          href="https://github.com/edwardcalderon/ComputeIntelligenceGraph"
          target="_blank"
          rel="noopener noreferrer"
          className="cig-sb-footer-link"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="cig-sb-footer-icon" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
          </svg>
          GitHub
        </a>
        <a
          href={landingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cig-sb-footer-link"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="cig-sb-footer-icon" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
          cig.lat
        </a>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DocSidebar({ sidebar, path: _path, onCollapse: _onCollapse, isHidden: _isHidden }: Props): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [version, setVersion] = useState('');
  const [landingUrl, setLandingUrl] = useState('https://cig.lat');
  const location = useLocation();

  // Portal guard: only render after hydration
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setVersion((window as Window & { __CIG_VERSION__?: string }).__CIG_VERSION__ ?? '');
    // In development, point the landing link to the local landing port
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setLandingUrl(`http://${window.location.hostname}:3001`);
    }
  }, []);

  const close = useCallback(() => setMobileOpen(false), []);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const items = sidebar as unknown as NavItem[];

  return (
    <>
      {/* Desktop sidebar — renders inside Docusaurus's sticky container */}
      <aside className="cig-sb cig-sb--desktop" aria-label="Documentation sidebar">
        <SidebarContent sidebar={items} version={version} landingUrl={landingUrl} onClose={close} />
      </aside>

      {/* Mobile toggle + drawer — portaled to body to escape container's display:none */}
      {mounted && createPortal(
        <>
          <button
            className="cig-sb-mobile-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="cig-sb-mobile-drawer"
          >
            <MenuIcon />
          </button>

          {mobileOpen && (
            <div className="cig-sb-overlay" onClick={close} aria-hidden="true" />
          )}

          <aside
            id="cig-sb-mobile-drawer"
            className={`cig-sb cig-sb--mobile${mobileOpen ? ' open' : ''}`}
            aria-hidden={!mobileOpen}
            aria-label="Documentation navigation"
          >
            <button className="cig-sb-close-btn" onClick={close} aria-label="Close navigation">
              <CloseIcon />
            </button>
            <SidebarContent sidebar={items} version={version} landingUrl={landingUrl} onClose={close} />
          </aside>
        </>,
        document.body
      )}
    </>
  );
}
