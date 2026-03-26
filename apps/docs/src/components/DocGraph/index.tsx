'use client';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/* ─── Types ──────────────────────────────────────────────────────────── */

type NodeKind = 'root' | 'section' | 'page';
type NodeStatus = 'stable' | 'active' | 'beta';

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  icon: string;
  href: string;
  parentId: string | null;
  color: string;
  // physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  visible: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'tree' | 'cross';
}

/* ─── Graph data ─────────────────────────────────────────────────────── */

const BASE = '/documentation/docs/en';

const RAW_NODES: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy' | 'radius' | 'visible'>[] = [
  // Root
  { id: 'root', label: 'CIG', kind: 'root', status: 'stable', icon: '◈', href: '/documentation', parentId: null, color: '#22d3ee' },

  // Sections
  { id: 'getting-started', label: 'Getting Started', kind: 'section', status: 'stable', icon: '🚀', href: `${BASE}/getting-started/`, parentId: 'root', color: '#34d399' },
  { id: 'architecture',    label: 'Architecture',    kind: 'section', status: 'stable', icon: '🏗️', href: `${BASE}/architecture/`,    parentId: 'root', color: '#60a5fa' },
  { id: 'api-reference',   label: 'API Reference',   kind: 'section', status: 'stable', icon: '⚡', href: `${BASE}/api-reference/`,   parentId: 'root', color: '#f59e0b' },
  { id: 'user-guide',      label: 'User Guide',      kind: 'section', status: 'stable', icon: '📖', href: `${BASE}/user-guide/`,      parentId: 'root', color: '#a78bfa' },
  { id: 'developer-guide', label: 'Developer Guide', kind: 'section', status: 'active', icon: '🛠️', href: `${BASE}/developer-guide/`, parentId: 'root', color: '#fb923c' },
  { id: 'troubleshooting', label: 'Troubleshooting', kind: 'section', status: 'stable', icon: '🔧', href: `${BASE}/troubleshooting/`, parentId: 'root', color: '#f87171' },
  { id: 'changelog',       label: 'Changelog',       kind: 'section', status: 'active', icon: '📋', href: `${BASE}/changelog/`,       parentId: 'root', color: '#94a3b8' },
  { id: 'faq',             label: 'FAQ',             kind: 'section', status: 'stable', icon: '💡', href: `${BASE}/faq/`,             parentId: 'root', color: '#fbbf24' },

  // Getting Started children
  { id: 'gs-installation', label: 'Installation',  kind: 'page', status: 'stable', icon: '📦', href: `${BASE}/getting-started/installation`, parentId: 'getting-started', color: '#34d399' },
  { id: 'gs-quickstart',   label: 'Quick Start',   kind: 'page', status: 'stable', icon: '▶️', href: `${BASE}/getting-started/quick-start`,  parentId: 'getting-started', color: '#34d399' },

  // Architecture children
  { id: 'arch-system',     label: 'System Design', kind: 'page', status: 'stable', icon: '🗺️', href: `${BASE}/architecture/system-design`, parentId: 'architecture', color: '#60a5fa' },
  { id: 'arch-components', label: 'Components',    kind: 'page', status: 'stable', icon: '🧩', href: `${BASE}/architecture/components`,   parentId: 'architecture', color: '#60a5fa' },

  // API Reference children
  { id: 'api-endpoints',   label: 'Endpoints',     kind: 'page', status: 'stable', icon: '🔌', href: `${BASE}/api-reference/endpoints`, parentId: 'api-reference', color: '#f59e0b' },

  // User Guide children
  { id: 'ug-features',     label: 'Features',      kind: 'page', status: 'stable', icon: '✨', href: `${BASE}/user-guide/features`, parentId: 'user-guide', color: '#a78bfa' },

  // Developer Guide children
  { id: 'dg-contributing', label: 'Contributing',  kind: 'page', status: 'active', icon: '🤝', href: `${BASE}/developer-guide/contributing`, parentId: 'developer-guide', color: '#fb923c' },

  // Troubleshooting children
  { id: 'ts-common',       label: 'Common Issues', kind: 'page', status: 'stable', icon: '🐛', href: `${BASE}/troubleshooting/common-issues`, parentId: 'troubleshooting', color: '#f87171' },
];

// Cross-section edges (semantic relationships)
const CROSS_EDGES: GraphEdge[] = [
  { source: 'getting-started', target: 'architecture',    type: 'cross' },
  { source: 'getting-started', target: 'developer-guide', type: 'cross' },
  { source: 'architecture',    target: 'api-reference',   type: 'cross' },
  { source: 'architecture',    target: 'user-guide',      type: 'cross' },
  { source: 'api-reference',   target: 'developer-guide', type: 'cross' },
  { source: 'user-guide',      target: 'faq',             type: 'cross' },
  { source: 'troubleshooting', target: 'faq',             type: 'cross' },
  { source: 'developer-guide', target: 'changelog',       type: 'cross' },
  { source: 'gs-installation', target: 'gs-quickstart',   type: 'cross' },
  { source: 'arch-system',     target: 'arch-components', type: 'cross' },
];

/* ─── Physics constants ──────────────────────────────────────────────── */
const REPULSION   = 6000;
const SPRING_LEN  = { root: 160, section: 110, page: 70 };
const SPRING_K    = { root: 0.04, section: 0.06, page: 0.08 };
const DAMPING     = 0.82;
const CENTER_PULL = 0.012;

/* ─── Helpers ────────────────────────────────────────────────────────── */
function kindRadius(kind: NodeKind): number {
  return kind === 'root' ? 32 : kind === 'section' ? 22 : 16;
}

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const visible = new Set(nodes.filter(n => n.visible).map(n => n.id));
  const tree: GraphEdge[] = [];
  for (const n of nodes) {
    if (n.visible && n.parentId && visible.has(n.parentId)) {
      tree.push({ source: n.parentId, target: n.id, type: 'tree' });
    }
  }
  const cross = CROSS_EDGES.filter(e => visible.has(e.source) && visible.has(e.target));
  return [...tree, ...cross];
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function DocGraph(): React.ReactElement {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const nodesRef   = useRef<GraphNode[]>([]);
  const rafRef     = useRef<number>(0);
  const dragRef    = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const panRef     = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const offsetRef  = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scaleRef   = useRef<number>(1);
  const hoveredRef = useRef<string | null>(null);
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null);
  const { siteConfig } = useDocusaurusContext();
  void siteConfig;

  /* ── Init nodes ── */
  const initNodes = useCallback(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    nodesRef.current = RAW_NODES.map(n => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      radius: kindRadius(n.kind),
      visible: n.kind !== 'page', // pages hidden until parent clicked
    }));
  }, []);

  /* ── Physics tick ── */
  const tick = useCallback(() => {
    const nodes = nodesRef.current;
    const visible = nodes.filter(n => n.visible);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // Repulsion between all visible nodes
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i], b = visible[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Spring forces along edges
    const edges = buildEdges(nodes);
    for (const e of edges) {
      const a = nodes.find(n => n.id === e.source);
      const b = nodes.find(n => n.id === e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetLen = e.type === 'tree'
        ? SPRING_LEN[b.kind as keyof typeof SPRING_LEN]
        : SPRING_LEN.section * 1.4;
      const k = e.type === 'tree'
        ? SPRING_K[b.kind as keyof typeof SPRING_K]
        : 0.02;
      const stretch = dist - targetLen;
      const fx = (dx / dist) * stretch * k;
      const fy = (dy / dist) * stretch * k;
      if (dragRef.current?.id !== a.id) { a.vx += fx; a.vy += fy; }
      if (dragRef.current?.id !== b.id) { b.vx -= fx; b.vy -= fy; }
    }

    // Center pull + integrate
    for (const n of visible) {
      if (dragRef.current?.id === n.id) continue;
      if (n.kind !== 'root') {
        n.vx += (cx - n.x) * CENTER_PULL * 0.3;
        n.vy += (cy - n.y) * CENTER_PULL * 0.3;
      }
      n.vx *= DAMPING; n.vy *= DAMPING;
      n.x += n.vx; n.y += n.vy;
    }
  }, []);

  /* ── Draw ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = isDark ? '#0a0a0f' : '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(offsetRef.current.x, offsetRef.current.y);
    ctx.scale(scaleRef.current, scaleRef.current);

    const nodes = nodesRef.current;
    const edges = buildEdges(nodes);

    // Draw edges
    for (const e of edges) {
      const a = nodes.find(n => n.id === e.source);
      const b = nodes.find(n => n.id === e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (e.type === 'tree') {
        ctx.strokeStyle = isDark ? 'rgba(34,211,238,0.25)' : 'rgba(6,182,212,0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw nodes
    for (const n of nodes) {
      if (!n.visible) continue;
      const isHovered = hoveredRef.current === n.id;
      const r = n.radius + (isHovered ? 4 : 0);

      // Glow
      if (n.kind === 'root' || isHovered) {
        const grd = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, r * 2.5);
        grd.addColorStop(0, n.color + '55');
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Circle fill
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (n.kind === 'root') {
        const grd = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
        grd.addColorStop(0, '#67e8f9');
        grd.addColorStop(0.5, '#22d3ee');
        grd.addColorStop(1, '#0891b2');
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = isDark
          ? `${n.color}22`
          : `${n.color}18`;
      }
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered ? n.color : (isDark ? `${n.color}99` : `${n.color}cc`);
      ctx.lineWidth = n.kind === 'root' ? 2.5 : isHovered ? 2 : 1.5;
      ctx.stroke();

      // Icon / label
      if (n.kind === 'root') {
        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CIG', n.x, n.y);
      } else {
        // Icon inside
        ctx.font = `${n.kind === 'section' ? 13 : 10}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.icon, n.x, n.y);

        // Label below
        ctx.font = `${n.kind === 'section' ? '600 10px' : '500 9px'} system-ui`;
        ctx.fillStyle = isDark
          ? (isHovered ? '#fff' : 'rgba(255,255,255,0.7)')
          : (isHovered ? '#09090b' : 'rgba(9,9,11,0.65)');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.label.toUpperCase(), n.x, n.y + r + 5);
      }

      // "has children" indicator dot
      const hasHiddenChildren = nodes.some(c => c.parentId === n.id && !c.visible);
      if (hasHiddenChildren) {
        ctx.beginPath();
        ctx.arc(n.x + r * 0.7, n.y - r * 0.7, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
      }
    }

    ctx.restore();
  }, []);

  /* ── Animation loop ── */
  const loop = useCallback(() => {
    tick();
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [tick, draw]);

  /* ── Canvas resize ── */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  /* ── World coords from canvas event ── */
  const toWorld = (ex: number, ey: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = (ex - rect.left - offsetRef.current.x) / scaleRef.current;
    const cy = (ey - rect.top  - offsetRef.current.y) / scaleRef.current;
    return { cx, cy };
  };

  /* ── Hit test ── */
  const hitNode = (ex: number, ey: number): GraphNode | null => {
    const { cx, cy } = toWorld(ex, ey);
    const nodes = nodesRef.current.filter(n => n.visible);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = cx - n.x, dy = cy - n.y;
      if (dx * dx + dy * dy <= (n.radius + 6) ** 2) return n;
    }
    return null;
  };

  /* ── Toggle children ── */
  const toggleChildren = useCallback((nodeId: string) => {
    const nodes = nodesRef.current;
    const parent = nodes.find(n => n.id === nodeId);
    if (!parent) return;
    const children = nodes.filter(n => n.parentId === nodeId);
    if (children.length === 0) return;

    const anyVisible = children.some(c => c.visible);
    for (const c of children) {
      c.visible = !anyVisible;
      if (!anyVisible) {
        // Spawn near parent
        c.x = parent.x + (Math.random() - 0.5) * 60;
        c.y = parent.y + (Math.random() - 0.5) * 60;
        c.vx = (Math.random() - 0.5) * 2;
        c.vy = (Math.random() - 0.5) * 2;
      }
    }
  }, []);

  /* ── Pointer events ── */
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = hitNode(e.clientX, e.clientY);
    if (hit) {
      dragRef.current = { id: hit.id, ox: hit.x, oy: hit.y };
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else {
      panRef.current = {
        startX: e.clientX, startY: e.clientY,
        ox: offsetRef.current.x, oy: offsetRef.current.y,
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const { cx, cy } = toWorld(e.clientX, e.clientY);
      const n = nodesRef.current.find(n => n.id === dragRef.current!.id);
      if (n) { n.x = cx; n.y = cy; n.vx = 0; n.vy = 0; }
    } else if (panRef.current) {
      offsetRef.current = {
        x: panRef.current.ox + (e.clientX - panRef.current.startX),
        y: panRef.current.oy + (e.clientY - panRef.current.startY),
      };
    } else {
      const hit = hitNode(e.clientX, e.clientY);
      const newHover = hit?.id ?? null;
      if (newHover !== hoveredRef.current) {
        hoveredRef.current = newHover;
        (canvasRef.current as HTMLCanvasElement).style.cursor = newHover ? 'pointer' : 'grab';
        setTooltip(newHover && hit ? { id: newHover, x: e.clientX, y: e.clientY } : null);
      } else if (newHover && hit) {
        setTooltip({ id: newHover, x: e.clientX, y: e.clientY });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      // If barely moved, treat as click
      const n = nodesRef.current.find(n => n.id === dragRef.current!.id);
      if (n) {
        const dx = n.x - dragRef.current.ox, dy = n.y - dragRef.current.oy;
        if (Math.sqrt(dx * dx + dy * dy) < 6) {
          toggleChildren(n.id);
        }
      }
      dragRef.current = null;
    }
    panRef.current = null;
    void e;
  }, [toggleChildren]);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Navigate on double-click
    const hit = hitNode(e.clientX, e.clientY);
    if (hit && e.detail === 2 && hit.href) {
      window.location.href = hit.href;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    offsetRef.current = {
      x: mx - (mx - offsetRef.current.x) * factor,
      y: my - (my - offsetRef.current.y) * factor,
    };
    scaleRef.current = Math.min(3, Math.max(0.3, scaleRef.current * factor));
  }, []);

  /* ── Mount ── */
  useEffect(() => {
    resize();
    initNodes();
    window.addEventListener('resize', resize);
    const canvas = canvasRef.current!;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [resize, initNodes, loop, onWheel]);

  /* ── Tooltip node ── */
  const tooltipNode = tooltip ? nodesRef.current.find(n => n.id === tooltip.id) : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
      />

      {/* Tooltip */}
      {tooltipNode && tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 14,
          top: tooltip.y - 10,
          pointerEvents: 'none',
          zIndex: 1000,
          background: 'rgba(10,10,15,0.95)',
          border: `1px solid ${tooltipNode.color}66`,
          borderRadius: 10,
          padding: '10px 14px',
          maxWidth: 240,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${tooltipNode.color}22`,
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{tooltipNode.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{tooltipNode.label}</span>
            <span style={{
              marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              padding: '2px 6px', borderRadius: 4,
              background: tooltipNode.color, color: '#000',
            }}>{tooltipNode.status.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            {tooltipNode.kind === 'root' && 'CIG Documentation Hub — click sections to explore'}
            {tooltipNode.kind === 'section' && `Click to expand child pages · Double-click to open`}
            {tooltipNode.kind === 'page' && `Double-click to open this page`}
          </div>
          {tooltipNode.kind !== 'root' && (
            <div style={{ marginTop: 8, fontSize: 10, color: tooltipNode.color, fontWeight: 600 }}>
              {nodesRef.current.some(c => c.parentId === tooltipNode.id && !c.visible)
                ? '⊕ Click to expand children'
                : nodesRef.current.some(c => c.parentId === tooltipNode.id && c.visible)
                  ? '⊖ Click to collapse'
                  : '↗ Double-click to navigate'}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 24, left: 24,
        display: 'flex', flexDirection: 'column', gap: 6,
        fontSize: 11, color: 'rgba(255,255,255,0.5)',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 1.5, background: 'rgba(34,211,238,0.4)', display: 'inline-block' }} />
          <span>tree edge</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 1, background: 'rgba(148,163,184,0.3)', display: 'inline-block', borderTop: '1px dashed rgba(148,163,184,0.4)' }} />
          <span>cross-reference</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span>has children</span>
        </div>
      </div>

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 24, right: 24,
        fontSize: 11, color: 'rgba(255,255,255,0.35)',
        textAlign: 'right', lineHeight: 1.8,
        pointerEvents: 'none',
      }}>
        <div>Drag nodes · Pan canvas · Scroll to zoom</div>
        <div>Click section to expand · Double-click to open</div>
      </div>
    </div>
  );
}
