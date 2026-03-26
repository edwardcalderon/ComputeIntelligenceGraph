'use client';
import React, { useEffect, useRef, useCallback, useState } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────── */
type NodeKind   = 'root' | 'section' | 'page';
type NodeStatus = 'stable' | 'active' | 'beta';

interface NodeDesc {
  description: string;
  category: string;
  energy: number;
  crossRefs: string[];
}

interface GraphNode {
  id: string; label: string; kind: NodeKind; status: NodeStatus;
  icon: string; href: string; parentId: string | null; color: string;
  x: number; y: number; vx: number; vy: number; radius: number; visible: boolean;
  pinned: boolean;
}

interface GraphEdge { source: string; target: string; type: 'tree' | 'cross'; }

/* ─── Node metadata ──────────────────────────────────────────────────── */
const NODE_META: Record<string, NodeDesc> = {
  'root':            { description: 'CIG Documentation Hub — explore the full knowledge graph of Compute Intelligence Graph.', category: 'Hub', energy: 100, crossRefs: [] },
  'getting-started': { description: 'Install CIG and run your first intelligence graph in minutes. Covers prerequisites, CLI setup, and quick-start examples.', category: 'Onboarding', energy: 95, crossRefs: ['architecture','developer-guide'] },
  'architecture':    { description: 'Deep dive into the CIG system design — nodes, edges, inference engine, and the distributed graph runtime.', category: 'Core', energy: 90, crossRefs: ['api-reference','user-guide'] },
  'api-reference':   { description: 'Complete REST and GraphQL API documentation with request/response schemas, auth flows, and code examples.', category: 'Reference', energy: 88, crossRefs: ['developer-guide'] },
  'user-guide':      { description: 'Step-by-step tutorials for building intelligence graphs, managing datasets, and visualising results.', category: 'Guide', energy: 85, crossRefs: ['faq'] },
  'developer-guide': { description: 'Contribution guidelines, local dev setup, coding standards, testing procedures, and release workflow.', category: 'Dev', energy: 80, crossRefs: ['changelog'] },
  'troubleshooting': { description: 'Common errors, debugging tips, and support channels to get you unblocked fast.', category: 'Support', energy: 75, crossRefs: ['faq'] },
  'changelog':       { description: 'Full release history with breaking changes, new features, and bug fixes across all CIG versions.', category: 'Meta', energy: 70, crossRefs: [] },
  'faq':             { description: 'Answers to the most frequently asked questions about CIG concepts, pricing, and integrations.', category: 'Support', energy: 72, crossRefs: [] },
  'gs-installation': { description: 'Step-by-step installation guide for all platforms — Docker, bare-metal, and cloud.', category: 'Onboarding', energy: 92, crossRefs: ['gs-quickstart'] },
  'gs-quickstart':   { description: 'Run your first CIG graph in under 5 minutes with the quick-start template.', category: 'Onboarding', energy: 90, crossRefs: [] },
  'arch-system':     { description: 'High-level system design: data flow, service boundaries, and deployment topology.', category: 'Core', energy: 88, crossRefs: ['arch-components'] },
  'arch-components': { description: 'Detailed breakdown of every CIG component and how they interact.', category: 'Core', energy: 85, crossRefs: [] },
  'api-endpoints':   { description: 'Full endpoint reference with parameters, responses, and live examples.', category: 'Reference', energy: 86, crossRefs: [] },
  'ug-features':     { description: 'Feature walkthrough — graph builder, query language, and visualisation tools.', category: 'Guide', energy: 82, crossRefs: [] },
  'dg-contributing': { description: 'How to contribute code, docs, and issues to the CIG project.', category: 'Dev', energy: 78, crossRefs: [] },
  'ts-common':       { description: 'Solutions to the most common CIG errors and configuration pitfalls.', category: 'Support', energy: 74, crossRefs: [] },
};

const BASE = '/documentation/docs/en';

const RAW_NODES: Omit<GraphNode,'x'|'y'|'vx'|'vy'|'radius'|'visible'|'pinned'>[] = [
  { id:'root',            label:'CIG',            kind:'root',    status:'stable', icon:'◈', href:'/documentation',                        parentId:null,             color:'#22d3ee' },
  { id:'getting-started', label:'Getting Started', kind:'section', status:'stable', icon:'🚀', href:`${BASE}/getting-started/`,              parentId:'root',           color:'#34d399' },
  { id:'architecture',    label:'Architecture',    kind:'section', status:'stable', icon:'🏗️', href:`${BASE}/architecture/`,                 parentId:'root',           color:'#60a5fa' },
  { id:'api-reference',   label:'API Reference',   kind:'section', status:'stable', icon:'⚡', href:`${BASE}/api-reference/`,                parentId:'root',           color:'#f59e0b' },
  { id:'user-guide',      label:'User Guide',      kind:'section', status:'stable', icon:'📖', href:`${BASE}/user-guide/`,                   parentId:'root',           color:'#a78bfa' },
  { id:'developer-guide', label:'Developer Guide', kind:'section', status:'active', icon:'🛠️', href:`${BASE}/developer-guide/`,              parentId:'root',           color:'#fb923c' },
  { id:'troubleshooting', label:'Troubleshooting', kind:'section', status:'stable', icon:'🔧', href:`${BASE}/troubleshooting/`,              parentId:'root',           color:'#f87171' },
  { id:'changelog',       label:'Changelog',       kind:'section', status:'active', icon:'📋', href:`${BASE}/changelog/`,                   parentId:'root',           color:'#94a3b8' },
  { id:'faq',             label:'FAQ',             kind:'section', status:'stable', icon:'💡', href:`${BASE}/faq/`,                          parentId:'root',           color:'#fbbf24' },
  { id:'gs-installation', label:'Installation',    kind:'page',    status:'stable', icon:'📦', href:`${BASE}/getting-started/installation`, parentId:'getting-started', color:'#34d399' },
  { id:'gs-quickstart',   label:'Quick Start',     kind:'page',    status:'stable', icon:'▶️', href:`${BASE}/getting-started/quick-start`,  parentId:'getting-started', color:'#34d399' },
  { id:'arch-system',     label:'System Design',   kind:'page',    status:'stable', icon:'🗺️', href:`${BASE}/architecture/system-design`,   parentId:'architecture',   color:'#60a5fa' },
  { id:'arch-components', label:'Components',      kind:'page',    status:'stable', icon:'🧩', href:`${BASE}/architecture/components`,      parentId:'architecture',   color:'#60a5fa' },
  { id:'api-endpoints',   label:'Endpoints',       kind:'page',    status:'stable', icon:'🔌', href:`${BASE}/api-reference/endpoints`,      parentId:'api-reference',  color:'#f59e0b' },
  { id:'ug-features',     label:'Features',        kind:'page',    status:'stable', icon:'✨', href:`${BASE}/user-guide/features`,          parentId:'user-guide',     color:'#a78bfa' },
  { id:'dg-contributing', label:'Contributing',    kind:'page',    status:'active', icon:'🤝', href:`${BASE}/developer-guide/contributing`, parentId:'developer-guide', color:'#fb923c' },
  { id:'ts-common',       label:'Common Issues',   kind:'page',    status:'stable', icon:'🐛', href:`${BASE}/troubleshooting/common-issues`,parentId:'troubleshooting', color:'#f87171' },
];

const CROSS_EDGES: GraphEdge[] = [
  { source:'getting-started', target:'architecture',    type:'cross' },
  { source:'getting-started', target:'developer-guide', type:'cross' },
  { source:'architecture',    target:'api-reference',   type:'cross' },
  { source:'architecture',    target:'user-guide',      type:'cross' },
  { source:'api-reference',   target:'developer-guide', type:'cross' },
  { source:'user-guide',      target:'faq',             type:'cross' },
  { source:'troubleshooting', target:'faq',             type:'cross' },
  { source:'developer-guide', target:'changelog',       type:'cross' },
  { source:'gs-installation', target:'gs-quickstart',   type:'cross' },
  { source:'arch-system',     target:'arch-components', type:'cross' },
];

const STATUS_COLOR: Record<NodeStatus, string> = { stable:'#25c2a0', active:'#7c3aed', beta:'#f59e0b' };

/* ─── Physics ────────────────────────────────────────────────────────── */
const REPULSION  = 7000;
const SPRING_LEN = { root:170, section:120, page:75 };
const SPRING_K   = { root:0.04, section:0.06, page:0.09 };
const DAMPING    = 0.80;
const CENTER_K   = 0.008;

function kindRadius(k: NodeKind) { return k==='root'?34:k==='section'?23:15; }

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const vis = new Set(nodes.filter(n=>n.visible).map(n=>n.id));
  const tree: GraphEdge[] = nodes
    .filter(n=>n.visible && n.parentId && vis.has(n.parentId))
    .map(n=>({ source:n.parentId!, target:n.id, type:'tree' as const }));
  return [...tree, ...CROSS_EDGES.filter(e=>vis.has(e.source)&&vis.has(e.target))];
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function DocGraph(): React.ReactElement {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const nodesRef   = useRef<GraphNode[]>([]);
  const rafRef     = useRef<number>(0);
  const dragRef    = useRef<{id:string;ox:number;oy:number}|null>(null);
  const panRef     = useRef<{sx:number;sy:number;ox:number;oy:number}|null>(null);
  const offsetRef  = useRef({x:0,y:0});
  const scaleRef   = useRef(1);
  const hoveredRef = useRef<string|null>(null);
  const pulseRef   = useRef(0); // frame counter for animations
  const [activeId, setActiveId]   = useState<string|null>(null);
  const [tooltip,  setTooltip]    = useState<{id:string;x:number;y:number}|null>(null);

  /* ── Init ── */
  const initNodes = useCallback(() => {
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    nodesRef.current = RAW_NODES.map(n => ({
      ...n,
      x: cx+(Math.random()-.5)*180, y: cy+(Math.random()-.5)*180,
      vx:0, vy:0, radius:kindRadius(n.kind),
      visible: n.kind!=='page', pinned:false,
    }));
  }, []);

  /* ── Physics tick ── */
  const tick = useCallback(() => {
    const nodes = nodesRef.current;
    const vis   = nodes.filter(n=>n.visible);
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    pulseRef.current++;

    for (let i=0;i<vis.length;i++) for (let j=i+1;j<vis.length;j++) {
      const a=vis[i],b=vis[j];
      const dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1;
      const f=REPULSION/(d*d), fx=(dx/d)*f, fy=(dy/d)*f;
      a.vx-=fx; a.vy-=fy; b.vx+=fx; b.vy+=fy;
    }

    for (const e of buildEdges(nodes)) {
      const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);
      if (!a||!b) continue;
      const dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1;
      const tl = e.type==='tree' ? SPRING_LEN[b.kind as keyof typeof SPRING_LEN] : SPRING_LEN.section*1.5;
      const k  = e.type==='tree' ? SPRING_K[b.kind as keyof typeof SPRING_K] : 0.015;
      const fx=(dx/d)*(d-tl)*k, fy=(dy/d)*(d-tl)*k;
      if (!a.pinned&&dragRef.current?.id!==a.id){a.vx+=fx;a.vy+=fy;}
      if (!b.pinned&&dragRef.current?.id!==b.id){b.vx-=fx;b.vy-=fy;}
    }

    for (const n of vis) {
      if (n.pinned||dragRef.current?.id===n.id) continue;
      n.vx+=(cx-n.x)*CENTER_K*0.25; n.vy+=(cy-n.y)*CENTER_K*0.25;
      n.vx*=DAMPING; n.vy*=DAMPING;
      n.x+=n.vx; n.y+=n.vy;
    }
  }, []);

  /* ── Draw ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W=canvas.width, H=canvas.height;
    const isDark = document.documentElement.getAttribute('data-theme')!=='light';
    const t = pulseRef.current;

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = isDark ? '#0a0a0f' : '#f0f4f8';
    ctx.fillRect(0,0,W,H);

    ctx.save();
    ctx.translate(offsetRef.current.x, offsetRef.current.y);
    ctx.scale(scaleRef.current, scaleRef.current);

    const nodes = nodesRef.current;
    const edges = buildEdges(nodes);

    /* edges */
    for (const e of edges) {
      const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);
      if (!a||!b) continue;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
      if (e.type==='tree') {
        ctx.strokeStyle = isDark ? 'rgba(34,211,238,0.22)' : 'rgba(6,182,212,0.28)';
        ctx.lineWidth=1.5; ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.18)';
        ctx.lineWidth=1; ctx.setLineDash([4,7]);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    /* nodes */
    for (const n of nodes) {
      if (!n.visible) continue;
      const isHov = hoveredRef.current===n.id;
      const isAct = activeId===n.id;
      const pulse = Math.sin(t*0.04)*0.5+0.5; // 0..1
      const r = n.radius + (isHov||isAct ? 5 : 0);

      /* outer glow / aura */
      const glowR = r*(n.kind==='root'?3.2:isAct?2.8:isHov?2.4:1.8);
      const grd = ctx.createRadialGradient(n.x,n.y,r*0.4,n.x,n.y,glowR);
      const alpha = n.kind==='root' ? 0.35+pulse*0.15 : isAct ? 0.28+pulse*0.12 : isHov ? 0.22 : 0.1;
      grd.addColorStop(0, n.color+Math.round(alpha*255).toString(16).padStart(2,'0'));
      grd.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(n.x,n.y,glowR,0,Math.PI*2);
      ctx.fillStyle=grd; ctx.fill();

      /* ping rings for root */
      if (n.kind==='root') {
        for (const [delay,op] of [[0,0.4],[0.5,0.25]] as [number,number][]) {
          const p = ((t*0.015+delay)%1);
          ctx.beginPath(); ctx.arc(n.x,n.y,r+p*r*1.8,0,Math.PI*2);
          ctx.strokeStyle = `rgba(34,211,238,${op*(1-p)})`;
          ctx.lineWidth=1; ctx.stroke();
        }
      }

      /* circle fill */
      ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
      if (n.kind==='root') {
        const g=ctx.createRadialGradient(n.x-r*.3,n.y-r*.3,0,n.x,n.y,r);
        g.addColorStop(0,'#67e8f9'); g.addColorStop(.5,'#22d3ee'); g.addColorStop(1,'#0891b2');
        ctx.fillStyle=g;
      } else {
        ctx.fillStyle = isDark ? n.color+'28' : n.color+'20';
      }
      ctx.fill();

      /* border */
      ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
      ctx.strokeStyle = isAct ? n.color : isHov ? n.color+'dd' : isDark ? n.color+'88' : n.color+'bb';
      ctx.lineWidth = n.kind==='root'?2.5:isAct||isHov?2:1.5;
      if (isAct) { ctx.shadowColor=n.color; ctx.shadowBlur=12; }
      ctx.stroke(); ctx.shadowBlur=0;

      /* icon / text */
      if (n.kind==='root') {
        ctx.font='bold 12px system-ui'; ctx.fillStyle='#fff';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('CIG',n.x,n.y);
      } else {
        ctx.font=`${n.kind==='section'?14:11}px system-ui`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(n.icon,n.x,n.y);
        ctx.font=`${n.kind==='section'?'600 9.5px':'500 8.5px'} system-ui`;
        ctx.fillStyle = isDark ? (isAct||isHov?'#fff':'rgba(255,255,255,0.65)') : (isAct||isHov?'#09090b':'rgba(9,9,11,0.6)');
        ctx.textBaseline='top';
        ctx.fillText(n.label.toUpperCase(),n.x,n.y+r+5);
      }

      /* amber dot = has hidden children */
      if (nodes.some(c=>c.parentId===n.id&&!c.visible)) {
        ctx.beginPath(); ctx.arc(n.x+r*.72,n.y-r*.72,4,0,Math.PI*2);
        ctx.fillStyle='#f59e0b'; ctx.fill();
      }

      /* pin indicator */
      if (n.pinned) {
        ctx.beginPath(); ctx.arc(n.x-r*.72,n.y-r*.72,4,0,Math.PI*2);
        ctx.fillStyle='#22d3ee'; ctx.fill();
      }
    }

    ctx.restore();
  }, [activeId]);

  /* ── Loop ── */
  const loop = useCallback(() => { tick(); draw(); rafRef.current=requestAnimationFrame(loop); }, [tick,draw]);

  /* ── Resize ── */
  const resize = useCallback(() => {
    const c=canvasRef.current; if (!c) return;
    c.width=window.innerWidth; c.height=window.innerHeight;
  }, []);

  /* ── Coord helpers ── */
  const toWorld = (ex:number,ey:number) => {
    const c=canvasRef.current!, r=c.getBoundingClientRect();
    return { cx:(ex-r.left-offsetRef.current.x)/scaleRef.current, cy:(ey-r.top-offsetRef.current.y)/scaleRef.current };
  };
  const hitNode = (ex:number,ey:number): GraphNode|null => {
    const {cx,cy}=toWorld(ex,ey);
    const vis=nodesRef.current.filter(n=>n.visible);
    for (let i=vis.length-1;i>=0;i--) {
      const n=vis[i], dx=cx-n.x, dy=cy-n.y;
      if (dx*dx+dy*dy<=(n.radius+8)**2) return n;
    }
    return null;
  };

  /* ── Toggle children ── */
  const toggleChildren = useCallback((nodeId:string) => {
    const nodes=nodesRef.current;
    const parent=nodes.find(n=>n.id===nodeId); if (!parent) return;
    const children=nodes.filter(n=>n.parentId===nodeId); if (!children.length) return;
    const anyVis=children.some(c=>c.visible);
    for (const c of children) {
      c.visible=!anyVis;
      if (!anyVis) { c.x=parent.x+(Math.random()-.5)*60; c.y=parent.y+(Math.random()-.5)*60; c.vx=(Math.random()-.5)*2; c.vy=(Math.random()-.5)*2; }
    }
  }, []);

  /* ── Expand / collapse all ── */
  const expandAll = useCallback(() => {
    const nodes=nodesRef.current;
    const cx=window.innerWidth/2, cy=window.innerHeight/2;
    for (const n of nodes) {
      n.visible=true;
      if (n.kind==='page'&&!n.visible) { n.x=cx+(Math.random()-.5)*300; n.y=cy+(Math.random()-.5)*300; n.vx=0; n.vy=0; }
    }
  }, []);

  const collapseAll = useCallback(() => {
    for (const n of nodesRef.current) { if (n.kind==='page') n.visible=false; }
    setActiveId(null);
  }, []);

  /* ── Anchor (re-center) ── */
  const anchor = useCallback(() => {
    offsetRef.current={x:0,y:0}; scaleRef.current=1;
    const cx=window.innerWidth/2, cy=window.innerHeight/2;
    const root=nodesRef.current.find(n=>n.id==='root');
    if (root) { root.x=cx; root.y=cy; root.vx=0; root.vy=0; }
  }, []);

  /* ── Pointer events ── */
  const onPointerDown = useCallback((e:React.PointerEvent<HTMLCanvasElement>) => {
    const hit=hitNode(e.clientX,e.clientY);
    if (hit) { dragRef.current={id:hit.id,ox:hit.x,oy:hit.y}; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); }
    else { panRef.current={sx:e.clientX,sy:e.clientY,ox:offsetRef.current.x,oy:offsetRef.current.y}; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerMove = useCallback((e:React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const {cx,cy}=toWorld(e.clientX,e.clientY);
      const n=nodesRef.current.find(n=>n.id===dragRef.current!.id);
      if (n){n.x=cx;n.y=cy;n.vx=0;n.vy=0;}
    } else if (panRef.current) {
      offsetRef.current={x:panRef.current.ox+(e.clientX-panRef.current.sx), y:panRef.current.oy+(e.clientY-panRef.current.sy)};
    } else {
      const hit=hitNode(e.clientX,e.clientY);
      const nh=hit?.id??null;
      if (nh!==hoveredRef.current) {
        hoveredRef.current=nh;
        (canvasRef.current as HTMLCanvasElement).style.cursor=nh?'pointer':'grab';
        setTooltip(nh&&hit?{id:nh,x:e.clientX,y:e.clientY}:null);
      } else if (nh&&hit) setTooltip({id:nh,x:e.clientX,y:e.clientY});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerUp = useCallback((e:React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const n=nodesRef.current.find(n=>n.id===dragRef.current!.id);
      if (n) {
        const dx=n.x-dragRef.current.ox, dy=n.y-dragRef.current.oy;
        if (Math.sqrt(dx*dx+dy*dy)<6) {
          toggleChildren(n.id);
          setActiveId(prev=>prev===n.id?null:n.id);
        }
      }
      dragRef.current=null;
    }
    panRef.current=null; void e;
  }, [toggleChildren]);

  const onClick = useCallback((e:React.MouseEvent<HTMLCanvasElement>) => {
    const hit=hitNode(e.clientX,e.clientY);
    if (hit&&e.detail===2&&hit.href) window.location.href=hit.href;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onWheel = useCallback((e:WheelEvent) => {
    e.preventDefault();
    const f=e.deltaY<0?1.1:0.9;
    const c=canvasRef.current!, r=c.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    offsetRef.current={x:mx-(mx-offsetRef.current.x)*f, y:my-(my-offsetRef.current.y)*f};
    scaleRef.current=Math.min(3,Math.max(0.25,scaleRef.current*f));
  }, []);

  /* ── Mount ── */
  useEffect(() => {
    resize(); initNodes();
    window.addEventListener('resize',resize);
    const c=canvasRef.current!;
    c.addEventListener('wheel',onWheel,{passive:false});
    rafRef.current=requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize',resize); c.removeEventListener('wheel',onWheel); };
  }, [resize,initNodes,loop,onWheel]);

  /* ── Active node data ── */
  const activeNode = activeId ? nodesRef.current.find(n=>n.id===activeId) : null;
  const activeMeta = activeId ? NODE_META[activeId] : null;
  const tooltipNode = tooltip ? nodesRef.current.find(n=>n.id===tooltip.id) : null;

  /* ── Toolbar button style ── */
  const btnStyle = (accent='#22d3ee'): React.CSSProperties => ({
    display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
    background:'rgba(10,10,20,0.85)', border:`1px solid ${accent}44`,
    borderRadius:8, color:accent, fontSize:11, fontWeight:700,
    letterSpacing:'0.08em', cursor:'pointer', backdropFilter:'blur(12px)',
    transition:'all 0.2s', whiteSpace:'nowrap' as const,
  });

  return (
    <div style={{position:'relative',width:'100%',height:'100vh',overflow:'hidden',fontFamily:'system-ui,sans-serif'}}>
      <canvas ref={canvasRef} style={{display:'block',touchAction:'none',cursor:'grab'}}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onClick={onClick} />

      {/* ── Toolbar ── */}
      <div style={{
        position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
        display:'flex', gap:8, zIndex:200, alignItems:'center',
      }}>
        {/* Anchor / re-center */}
        <button style={btnStyle('#22d3ee')} onClick={anchor} title="Re-center graph">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          Anchor
        </button>

        {/* Expand all */}
        <button style={btnStyle('#34d399')} onClick={expandAll} title="Expand all nodes">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          Expand All
        </button>

        {/* Collapse all */}
        <button style={btnStyle('#f87171')} onClick={collapseAll} title="Collapse child nodes">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
          Collapse
        </button>

        {/* Hint */}
        <span style={{fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.06em',paddingLeft:4}}>
          drag · pan · scroll to zoom · dbl-click to open
        </span>
      </div>

      {/* ── Active node card (orbital-style modal) ── */}
      {activeNode && activeMeta && (
        <div style={{
          position:'absolute', top:'50%', right:24, transform:'translateY(-50%)',
          width:272, zIndex:500,
          background:'rgba(10,10,20,0.96)', backdropFilter:'blur(20px)',
          border:`1px solid ${activeNode.color}44`,
          borderRadius:14, padding:18,
          boxShadow:`0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px ${activeNode.color}22`,
          animation:'cardSlideIn 0.22s ease',
        }}>
          {/* top connector line */}
          <div style={{position:'absolute',top:-1,left:'50%',transform:'translateX(-50%)',width:'60%',height:1,background:`linear-gradient(to right,transparent,${activeNode.color}66,transparent)`}}/>

          {/* header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>
              {activeMeta.category}
            </span>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',padding:'2px 7px',borderRadius:4,background:STATUS_COLOR[activeNode.status],color:'#000'}}>
                {activeNode.status.toUpperCase()}
              </span>
              <button onClick={()=>setActiveId(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>✕</button>
            </div>
          </div>

          {/* title */}
          <div style={{fontSize:15,fontWeight:700,color:'#fff',marginBottom:8}}>
            {activeNode.icon} {activeNode.label}
          </div>

          {/* description */}
          <p style={{fontSize:11,lineHeight:1.65,color:'rgba(255,255,255,0.68)',margin:'0 0 14px'}}>
            {activeMeta.description}
          </p>

          {/* energy bar */}
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'rgba(255,255,255,0.45)',marginBottom:4}}>
            <span>⚡ Completeness</span><span>{activeMeta.energy}%</span>
          </div>
          <div style={{width:'100%',height:3,background:'rgba(255,255,255,0.08)',borderRadius:2,overflow:'hidden',marginBottom:14}}>
            <div style={{height:'100%',width:`${activeMeta.energy}%`,background:`linear-gradient(90deg,#7c3aed,${activeNode.color})`,borderRadius:2,transition:'width 0.6s ease'}}/>
          </div>

          {/* cross-refs */}
          {activeMeta.crossRefs.length>0 && (
            <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:10,marginBottom:12}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:6}}>🔗 Connected</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {activeMeta.crossRefs.map(rid=>{
                  const rel=nodesRef.current.find(n=>n.id===rid);
                  return (
                    <button key={rid} onClick={()=>{toggleChildren(rid);setActiveId(rid);}}
                      style={{fontSize:10,padding:'3px 8px',border:`1px solid ${rel?.color??'#fff'}33`,borderRadius:4,background:'transparent',color:'rgba(255,255,255,0.65)',cursor:'pointer'}}>
                      {rel?.icon} {rel?.label} →
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTA */}
          <a href={activeNode.href} style={{display:'block',textAlign:'center',fontSize:11,fontWeight:700,color:activeNode.color,textDecoration:'none',padding:'7px',border:`1px solid ${activeNode.color}44`,borderRadius:7,transition:'background 0.2s'}}>
            Read docs →
          </a>
        </div>
      )}

      {/* ── Hover tooltip ── */}
      {tooltipNode && tooltip && !activeId && (
        <div style={{
          position:'fixed', left:tooltip.x+14, top:tooltip.y-10,
          pointerEvents:'none', zIndex:600,
          background:'rgba(10,10,20,0.92)', border:`1px solid ${tooltipNode.color}55`,
          borderRadius:9, padding:'8px 12px', maxWidth:200,
          boxShadow:`0 6px 24px rgba(0,0,0,0.5)`, backdropFilter:'blur(12px)',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
            <span style={{fontSize:16}}>{tooltipNode.icon}</span>
            <span style={{fontWeight:700,fontSize:12,color:'#fff'}}>{tooltipNode.label}</span>
          </div>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>
            {tooltipNode.kind==='root'?'Documentation hub':tooltipNode.kind==='section'?'Click to expand · dbl-click to open':'Dbl-click to open'}
          </div>
          {nodesRef.current.some(c=>c.parentId===tooltipNode.id&&!c.visible)&&(
            <div style={{marginTop:5,fontSize:10,color:tooltipNode.color,fontWeight:600}}>⊕ has child pages</div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{position:'absolute',bottom:20,left:20,display:'flex',flexDirection:'column',gap:5,fontSize:10,color:'rgba(255,255,255,0.4)',pointerEvents:'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:18,height:1.5,background:'rgba(34,211,238,0.4)',display:'inline-block'}}/><span>tree edge</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:18,height:0,borderTop:'1px dashed rgba(148,163,184,0.4)',display:'inline-block'}}/><span>cross-ref</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:'50%',background:'#f59e0b',display:'inline-block'}}/><span>has children</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:'50%',background:'#22d3ee',display:'inline-block'}}/><span>pinned</span></div>
      </div>

      <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(calc(-50% - 8px))}to{opacity:1;transform:translateY(-50%)}}`}</style>
    </div>
  );
}
