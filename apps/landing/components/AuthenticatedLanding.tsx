"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, getSupabaseClient } from "@cig/auth";
import { SpaceBackground } from "./SpaceBackground";
import { ElectricWavesBackground } from "./ElectricWavesBackground";
import { AuthButton } from "./AuthButton";
import { ThemeToggle } from "./ThemeToggle";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3002";

/* ─── Session-aware navigation ───────────────────────────────────────── */

async function goToDashboard(path = "/") {
  const supabase = getSupabaseClient();
  if (!supabase) {
    window.location.href = `${DASHBOARD_URL}${path}`;
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = `${DASHBOARD_URL}${path}`;
    return;
  }

  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token ?? "",
    token_type: "bearer",
    expires_in: String(session.expires_in ?? 3600),
  }).toString();

  window.location.href = `${DASHBOARD_URL}/auth/callback?redirect=${encodeURIComponent(path)}#${hash}`;
}

/* ─── Icons ───────────────────────────────────────────────────────────── */

const GraphIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const ResourcesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);
const CostIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const SecurityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const ConsoleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const DiscoveryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const DashboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

/* ─── Preview elements ────────────────────────────────────────────────── */

function BarViz({ color }: { color: string }) {
  const heights = [45, 72, 55, 90, 60, 82, 40, 75];
  return (
    <div className="flex gap-1 items-end h-9">
      {heights.map((h, i) => (
        <div key={i} style={{ height: `${h}%`, backgroundColor: color, animationDelay: `${i * 0.18}s` }}
          className="flex-1 rounded-sm animate-pulse opacity-70" />
      ))}
    </div>
  );
}

function NodeGraph({ color }: { color: string }) {
  return (
    <svg width="100%" height="38" viewBox="0 0 120 38">
      <line x1="20" y1="19" x2="60" y2="9"  stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <line x1="20" y1="19" x2="60" y2="29" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <line x1="60" y1="9"  x2="100" y2="19" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <line x1="60" y1="29" x2="100" y2="19" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <circle cx="20" cy="19" r="5" fill={color} fillOpacity="0.9" />
      <circle cx="60" cy="9"  r="4" fill={color} fillOpacity="0.6" />
      <circle cx="60" cy="29" r="4" fill={color} fillOpacity="0.6" />
      <circle cx="100" cy="19" r="5" fill={color} fillOpacity="0.9" />
    </svg>
  );
}

function ShieldViz({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="32" viewBox="0 0 24 24" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <div className="flex flex-col gap-1 flex-1">
        {([ ["Critical", 0.9], ["High", 0.55], ["Medium", 0.3] ] as [string, number][]).map(([label, w]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="h-1 rounded-full" style={{ width: `${w * 100}%`, backgroundColor: color, opacity: 0.85 }} />
            <span className="text-[9px] opacity-40" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostViz({ color }: { color: string }) {
  return (
    <div className="font-mono" style={{ color }}>
      <span className="text-base font-bold opacity-60">$</span>
      <span className="text-2xl font-bold">2,847</span>
      <span className="text-xs opacity-50 ml-1">/mo</span>
    </div>
  );
}

function ConsoleLine({ color }: { color: string }) {
  return (
    <div className="font-mono text-xs space-y-1" style={{ color }}>
      <div className="opacity-50">{">"} Which resources cost the most?</div>
      <div className="flex items-center gap-1 opacity-90">
        <span className="opacity-40">◆</span>
        <span>Analyzing 142 resources</span>
        <span className="inline-block w-1.5 h-3 bg-current ml-0.5 animate-pulse" />
      </div>
    </div>
  );
}

function RadarViz({ color }: { color: string }) {
  return (
    <svg width="100%" height="38" viewBox="0 0 100 38">
      <ellipse cx="50" cy="19" rx="45" ry="14" stroke={color} strokeWidth="0.5" strokeOpacity="0.25" fill="none" />
      <ellipse cx="50" cy="19" rx="30" ry="9"  stroke={color} strokeWidth="0.5" strokeOpacity="0.25" fill="none" />
      <ellipse cx="50" cy="19" rx="15" ry="4"  stroke={color} strokeWidth="0.5" strokeOpacity="0.25" fill="none" />
      <circle cx="62" cy="15" r="2.5" fill={color} fillOpacity="0.9">
        <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="35" cy="24" r="1.8" fill={color} fillOpacity="0.7">
        <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="72" cy="22" r="1.5" fill={color} fillOpacity="0.6">
        <animate attributeName="opacity" values="0.6;0.15;0.6" dur="1.9s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ─── Feature definitions ─────────────────────────────────────────────── */

interface Feature {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  tag: string;
  preview: React.ReactNode;
}

const FEATURES: Feature[] = [
  { id: "graph",     title: "Infrastructure Graph", description: "Visualize dependencies across your entire infrastructure as an interactive node graph", path: "/graph",     icon: <GraphIcon />,     color: "#06b6d4", tag: "Visualization", preview: <NodeGraph color="#06b6d4" /> },
  { id: "resources", title: "Resources",             description: "Browse, search, and filter all discovered cloud and on-premise resources",               path: "/resources", icon: <ResourcesIcon />, color: "#3b82f6", tag: "Management",    preview: <BarViz color="#3b82f6" /> },
  { id: "costs",     title: "Cost Analysis",         description: "Track spending trends and identify savings opportunities across providers",               path: "/costs",     icon: <CostIcon />,      color: "#a855f7", tag: "FinOps",       preview: <CostViz color="#a855f7" /> },
  { id: "security",  title: "Security",              description: "Detect misconfigurations and compliance violations with automated scoring",               path: "/security",  icon: <SecurityIcon />,  color: "#10b981", tag: "Compliance",   preview: <ShieldViz color="#10b981" /> },
  { id: "console",   title: "AI Console",            description: "Query your infrastructure in natural language — ask anything about your resources",       path: "/",          icon: <ConsoleIcon />,   color: "#f59e0b", tag: "AI",           preview: <ConsoleLine color="#f59e0b" /> },
  { id: "discovery", title: "Discovery",             description: "Auto-discover cloud, on-premise, and container infrastructure in minutes",               path: "/resources", icon: <DiscoveryIcon />, color: "#ef4444", tag: "Automation",   preview: <RadarViz color="#ef4444" /> },
];

/* ─── Holographic card ────────────────────────────────────────────────── */

interface HoloCardProps {
  feature: Feature;
  selected: boolean;
  onSelect: () => void;
}

/** Typewriter hook — types `text` character by character when `active` is true. */
function useTypewriter(text: string, active: boolean, delay = 260, speed = 14) {
  const [typed, setTyped] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!active) { setTyped(""); return; }

    let i = 0;
    const tick = () => {
      i++;
      setTyped(text.slice(0, i));
      if (i < text.length) timer.current = setTimeout(tick, speed);
    };
    timer.current = setTimeout(tick, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [active, text, delay, speed]);

  return { typed, done: typed.length === text.length };
}

function HoloCard({ feature, selected, onSelect }: HoloCardProps) {
  const [hovered, setHovered] = useState(false);
  const revealed = hovered || selected;
  const { typed, done } = useTypewriter(feature.description, revealed);

  const c = feature.color;

  return (
    <article
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex-shrink-0 w-64 rounded-2xl cursor-pointer select-none overflow-hidden"
      style={{
        height: 220,
        border: `1px solid ${c}${revealed ? "55" : "25"}`,
        background: `linear-gradient(145deg, ${c}${revealed ? "22" : "10"} 0%, #070d1a 70%)`,
        boxShadow: revealed
          ? `0 0 0 1px ${c}30, 0 0 40px ${c}35, 0 20px 50px rgba(0,0,0,0.7)`
          : `0 4px 24px rgba(0,0,0,0.5)`,
        transform: revealed ? "scale(1.04)" : "scale(1)",
        transition: "transform 0.35s cubic-bezier(.34,1.56,.64,1), box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease",
      }}
    >
      {/* Animated scan line — always present, speeds up on hover */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${c}90, transparent)`,
          animation: `cig-scan ${revealed ? "1.2s" : "3s"} ease-in-out infinite`,
          top: 0,
        }}
      />

      {/* Corner accent glow */}
      <div
        className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${c}${revealed ? "40" : "18"} 0%, transparent 70%)`,
          transition: "background 0.4s ease",
        }}
      />

      {/* ── FRONT FACE – icon + title only ─────────────────── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
        style={{
          opacity: revealed ? 0 : 1,
          transform: revealed ? "scale(0.8) translateY(-12px)" : "scale(1) translateY(0)",
          transition: "opacity 0.3s ease, transform 0.35s ease",
          pointerEvents: revealed ? "none" : "auto",
        }}
      >
        {/* Large glowing icon */}
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: 72, height: 72,
            backgroundColor: `${c}14`,
            color: c,
            boxShadow: `0 0 0 1px ${c}30, 0 0 32px ${c}35, inset 0 0 20px ${c}10`,
            animation: "cig-glow-pulse 2.5s ease-in-out infinite",
          }}
        >
          {/* Scale the icon SVG up */}
          <div style={{ transform: "scale(2)", transformOrigin: "center" }}>
            {feature.icon}
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block tracking-wide"
            style={{ backgroundColor: `${c}18`, color: c }}
          >
            {feature.tag}
          </span>
        </div>

        {/* Subtle dot grid decoration */}
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, ${c} 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      {/* ── REVEALED FACE – full info ──────────────────────── */}
      <div
        className="absolute inset-0 flex flex-col p-5 gap-2"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.35s ease 0.05s, transform 0.35s ease 0.05s",
          pointerEvents: revealed ? "auto" : "none",
          overflowY: revealed ? "auto" : "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: `${feature.color}40 transparent`,
        }}
      >
        {/* Header row: icon + tag — slides in from top */}
        <div
          className="flex items-center justify-between"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(-8px)",
            transition: "opacity 0.3s ease 0.08s, transform 0.3s ease 0.08s",
          }}
        >
          <div className="flex items-center justify-center size-8 rounded-xl"
            style={{ backgroundColor: `${c}18`, color: c }}>
            {feature.icon}
          </div>
          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide"
            style={{ backgroundColor: `${c}20`, color: c }}>
            {feature.tag}
          </span>
        </div>

        {/* Title — fades up */}
        <h3
          className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.3s ease 0.15s, transform 0.3s ease 0.15s",
          }}
        >
          {feature.title}
        </h3>

        {/* Description — typed out */}
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed" style={{ minHeight: 40 }}>
          {typed}
          {revealed && !done && (
            <span
              className="inline-block w-px ml-px animate-pulse"
              style={{ height: 11, backgroundColor: c, verticalAlign: "middle" }}
            />
          )}
        </p>

        {/* Preview + CTA anchored together at the bottom */}
        <div className="mt-auto flex flex-col gap-2">
          {/* Preview viz */}
          <div
            className="pt-2 border-t"
            style={{
              borderColor: `${c}20`,
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 0.4s ease 0.22s, transform 0.4s ease 0.22s",
            }}
          >
            {feature.preview}
          </div>

          {/* CTA */}
          <div
            className="text-[11px] font-semibold text-center py-1.5 rounded-xl"
            style={{
              backgroundColor: `${c}18`,
              color: c,
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.35s ease 0.32s, transform 0.35s ease 0.32s",
              boxShadow: `0 0 12px ${c}20`,
            }}
          >
            Open {feature.title} →
          </div>
        </div>
      </div>

      {/* Bottom glow bloom on reveal */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${c}${revealed ? "20" : "00"}, transparent)`,
          transition: "background 0.5s ease",
        }}
      />
    </article>
  );
}

/* ─── Draggable infinite scrolling row ───────────────────────────────── */

function ScrollingRow({
  features,
  direction,
  duration,
}: {
  features: Feature[];
  direction: "left" | "right";
  duration: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // null = CSS animation running; number = manual override while dragging
  const [manualOffset, setManualOffset] = useState<number | null>(null);
  const [hovered, setHovered]           = useState(false);
  const [selectedId, setSelectedId]     = useState<string | null>(null);

  const dragging   = useRef(false);
  const startX     = useRef(0);
  const startOff   = useRef(0);
  const totalDelta = useRef(0);

  const doubled = [...features, ...features];

  /** Read the current CSS-animated translateX from the live computed style. */
  const readTranslateX = () => {
    if (!trackRef.current) return 0;
    const mat = new DOMMatrix(window.getComputedStyle(trackRef.current).transform);
    return mat.m41;
  };

  /**
   * After a drag ends, set a negative animation-delay so the CSS animation
   * resumes seamlessly from wherever the drag left off.
   */
  const resumeFrom = (finalX: number) => {
    if (!trackRef.current) return;
    const halfWidth   = trackRef.current.scrollWidth / 2;
    const durationSec = parseFloat(duration);

    // Wrap into one [0, halfWidth) cycle
    const norm =
      direction === "left"
        ? ((-finalX % halfWidth) + halfWidth) % halfWidth       // 0 → halfWidth maps to start → end
        : ((finalX  % halfWidth) + halfWidth) % halfWidth;

    const progress       = norm / halfWidth;
    const negativeDelay  = -(progress * durationSec);
    trackRef.current.style.animationDelay = `${negativeDelay}s`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current   = true;
    totalDelta.current = 0;
    startX.current     = e.clientX;
    startOff.current   = readTranslateX();
    setManualOffset(startOff.current);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta        = e.clientX - startX.current;
    totalDelta.current = delta;
    setManualOffset(startOff.current + delta);
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;

    if (Math.abs(totalDelta.current) < 5) {
      // Tap — reset to animated state; onClick on the card handles navigation
      setManualOffset(null);
      return;
    }

    // Resume CSS animation from the drag-end position
    resumeFrom(startOff.current + totalDelta.current);
    setManualOffset(null);
  };

  /** Card click handler — only fires for genuine taps (not drags). */
  const handleCardClick = (feature: Feature) => {
    if (Math.abs(totalDelta.current) >= 5) return; // was a drag

    if (selectedId === feature.id) {
      // Second tap on the same card → navigate
      goToDashboard(feature.path);
      setSelectedId(null);
    } else {
      // First tap → select & pause this row
      setSelectedId(feature.id);
    }
  };

  const isPaused = hovered || selectedId !== null;

  const trackStyle: React.CSSProperties =
    manualOffset !== null
      ? { transform: `translateX(${manualOffset}px)`, willChange: "transform" }
      : {
          animation: `cig-scroll-${direction} ${duration} linear infinite`,
          animationPlayState: isPaused ? "paused" : "running",
        };

  return (
    <div
      className="overflow-x-clip w-full py-3 cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div ref={trackRef} className="flex gap-4 w-max px-4" style={trackStyle}>
        {doubled.map((f, i) => (
          <HoloCard
            key={`${f.id}-${i}`}
            feature={f}
            selected={selectedId === f.id}
            onSelect={() => handleCardClick(f)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Module status badges ────────────────────────────────────────────── */

const STATUS_BADGES = [
  { label: "Graph",     color: "#06b6d4" },
  { label: "Resources", color: "#3b82f6" },
  { label: "Costs",     color: "#a855f7" },
  { label: "Security",  color: "#10b981" },
  { label: "AI",        color: "#f59e0b" },
];

/* ─── Main exported component ─────────────────────────────────────────── */

export function AuthenticatedLanding() {
  useAuth(); // keeps session alive; user data used in AuthButton
  const handleEnterDashboard = useCallback(() => goToDashboard("/"), []);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden text-zinc-900 dark:text-white flex flex-col bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-transparent dark:via-transparent dark:to-transparent">
      {/* ── Keyframes ──────────────────────────────────────── */}
      <style>{`
        @keyframes cig-scroll-left  { from { transform: translateX(0); }    to { transform: translateX(-50%); } }
        @keyframes cig-scroll-right { from { transform: translateX(-50%); } to { transform: translateX(0); }    }
        @keyframes cig-float        { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes cig-glow-pulse   { 0%,100% { opacity: 0.35; } 50% { opacity: 0.75; } }
        @keyframes cig-scan         { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      `}</style>

      {/* Auth button + theme toggle */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <AuthButton />
      </div>

      {/* WebGL electric waves — fullscreen behind everything */}
      <ElectricWavesBackground />

      {/* Small CIG particles layered above the shader, below content */}
      <SpaceBackground particleCount={80} particleColor="rgba(6,182,212,0.7)" />

      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center pt-24 pb-10 px-6 text-center">
        {/* Headline */}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
            Your Infrastructure
          </span>
          <br />
          <span className="text-zinc-900 dark:text-zinc-100">Command Center</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-base max-w-md mb-8 leading-relaxed">
          Select a module below to jump directly into your infrastructure intelligence dashboard.
        </p>

        {/* Status pills */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
          {STATUS_BADGES.map(({ label, color }, idx) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{ borderColor: `${color}35`, backgroundColor: `${color}0e`, color }}>
              <div className="size-1.5 rounded-full"
                style={{ backgroundColor: color, animation: "cig-glow-pulse 2s ease-in-out infinite", animationDelay: `${idx * 0.3}s` }} />
              {label}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={handleEnterDashboard}
          className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-semibold text-sm text-white transition-all duration-300 hover:scale-105"
          style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)", boxShadow: "0 0 24px rgba(6,182,212,0.3), 0 4px 20px rgba(0,0,0,0.4)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(6,182,212,0.5), 0 8px 32px rgba(0,0,0,0.5)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px rgba(6,182,212,0.3), 0 4px 20px rgba(0,0,0,0.4)"; }}
        >
          <DashboardIcon /> Enter Dashboard
        </button>
      </div>

      {/* ── Feature carousels ────────────────────────────────── */}
      <div className="relative pb-12 flex flex-col gap-5 mt-4">
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#050b14] to-transparent z-10" />

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mb-1 select-none">
          Drag to explore · tap once to preview · tap again to open
        </p>

        <ScrollingRow features={FEATURES}                        direction="left"  duration="42s" />
        <ScrollingRow features={[...FEATURES].reverse()} direction="right" duration="36s" />

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#050b14] to-transparent z-10" />
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="relative z-10 mt-auto w-full text-center text-xs text-zinc-500 dark:text-zinc-600 pt-6 pb-4 border-t border-zinc-200 dark:border-zinc-800/40">
        <p>© {new Date().getFullYear()} CIG — Compute Intelligence Graph. Open-source under MIT License.</p>
        <p className="mt-1 text-zinc-700"
          title={process.env.NEXT_PUBLIC_RELEASE_TAG || `v${process.env.NEXT_PUBLIC_APP_VERSION}`}>
          v{process.env.NEXT_PUBLIC_APP_VERSION}
          {process.env.NEXT_PUBLIC_APP_BUILD ? ` · build ${process.env.NEXT_PUBLIC_APP_BUILD}` : ""}
        </p>
      </footer>
    </div>
  );
}
