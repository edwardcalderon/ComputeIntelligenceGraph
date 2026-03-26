"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import type { Props } from '@theme/DocSidebar';
import './styles.css';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`cig-sidebar-chevron ${open ? 'open' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="cig-sidebar-close-icon">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarItem {
  type: string;
  label?: string;
  href?: string;
  docId?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
  collapsible?: boolean;
  className?: string;
}

// ─── Sidebar Item ─────────────────────────────────────────────────────────────

function SidebarLink({ item, onClose }: { item: SidebarItem; onClose: () => void }) {
  const location = useLocation();
  const href = item.href || '';
  const isActive = location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <li className="cig-sidebar-item">
      <Link
        to={href}
        onClick={onClose}
        className={`cig-sidebar-link ${isActive ? 'active' : ''}`}
      >
        {isActive && <span className="cig-sidebar-active-bar" />}
        <span className="cig-sidebar-link-text">{item.label}</span>
      </Link>
    </li>
  );
}

// ─── Sidebar Category ─────────────────────────────────────────────────────────

function SidebarCategory({ item, onClose, depth = 0 }: { item: SidebarItem; onClose: () => void; depth?: number }) {
  const location = useLocation();
  const hasActiveChild = item.items?.some(
    (child) => child.href && (location.pathname === child.href || location.pathname.startsWith(child.href + '/'))
  );
  const [open, setOpen] = useState(hasActiveChild ?? depth === 0);

  return (
    <li className="cig-sidebar-category">
      <button
        className={`cig-sidebar-category-btn ${open ? 'open' : ''} ${hasActiveChild ? 'has-active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="cig-sidebar-category-label">{item.label}</span>
        <ChevronIcon open={open} />
      </button>
      <div className={`cig-sidebar-category-items ${open ? 'open' : ''}`}>
        <ul className="cig-sidebar-list cig-sidebar-list--nested">
          {item.items?.map((child, i) =>
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

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function DocSidebar({ sidebar, path, onCollapse, isHidden }: Props): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    setVersion((window as any).__CIG_VERSION__ || '');
  }, []);

  const close = useCallback(() => setMobileOpen(false), []);

  // Close on route change
  const location = useLocation();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const SidebarContent = () => (
    <div className="cig-sidebar-inner">
      {/* Brand */}
      <div className="cig-sidebar-brand">
        <Link to="/" className="cig-sidebar-brand-link" onClick={close}>
          <span className="cig-sidebar-brand-icon">
            <svg viewBox="20 20 216 216" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <linearGradient id="sbGrad" x1="48" y1="40" x2="208" y2="208" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#14B8A6" />
                </linearGradient>
                <radialGradient id="sbGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#ECFEFF" />
                  <stop offset="55%" stopColor="#A5F3FC" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </radialGradient>
              </defs>
              <g transform="rotate(90 128 128)">
                <g stroke="url(#sbGrad)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
                  <line x1="128" y1="52" x2="74" y2="174" />
                  <line x1="128" y1="52" x2="182" y2="174" />
                  <line x1="74" y1="174" x2="128" y2="146" />
                  <line x1="128" y1="146" x2="182" y2="174" />
                  <line x1="74" y1="174" x2="182" y2="174" />
                </g>
                <g fill="white" stroke="url(#sbGrad)" strokeWidth="6">
                  <circle cx="128" cy="52" r="14" />
                  <circle cx="74" cy="174" r="14" />
                  <circle cx="182" cy="174" r="14" />
                  <circle cx="128" cy="146" r="18" />
                </g>
                <circle cx="128" cy="146" r="9" fill="url(#sbGlow)" />
              </g>
            </svg>
          </span>
          <div className="cig-sidebar-brand-text">
            <span className="cig-sidebar-brand-name">CIG</span>
            <span className="cig-sidebar-brand-sub">Documentation</span>
          </div>
        </Link>
        {version && <span className="cig-sidebar-version">v{version}</span>}
      </div>

      {/* Nav */}
      <nav className="cig-sidebar-nav" aria-label="Documentation navigation">
        <ul className="cig-sidebar-list">
          {sidebar.map((item, i) =>
            item.type === 'category' ? (
              <SidebarCategory key={i} item={item as SidebarItem} onClose={close} />
            ) : (
              <SidebarLink key={i} item={item as SidebarItem} onClose={close} />
            )
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="cig-sidebar-footer">
        <a href="https://github.com/edwardcalderon/ComputeIntelligenceGraph" target="_blank" rel="noopener noreferrer" className="cig-sidebar-footer-link">
          <svg viewBox="0 0 24 24" fill="currentColor" className="cig-sidebar-footer-icon" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
          </svg>
          GitHub
        </a>
        <a href="https://cig.lat" target="_blank" rel="noopener noreferrer" className="cig-sidebar-footer-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="cig-sidebar-footer-icon" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" />
          </svg>
          cig.lat
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="cig-sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="cig-sidebar-overlay" onClick={close} aria-hidden="true" />
      )}

      {/* Desktop sidebar */}
      <aside className="cig-sidebar cig-sidebar--desktop">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <aside className={`cig-sidebar cig-sidebar--mobile ${mobileOpen ? 'open' : ''}`} aria-hidden={!mobileOpen}>
        <button className="cig-sidebar-close-btn" onClick={close} aria-label="Close navigation">
          <CloseIcon />
        </button>
        <SidebarContent />
      </aside>
    </>
  );
}
