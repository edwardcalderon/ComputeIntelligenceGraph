"use client";

import React, { useState } from "react";
import { ACCENT_COLORS, tint, type AccentColor } from "../theme/tokens";
import { useTypewriter } from "../hooks/useTypewriter";
import { ScanLine } from "./ScanLine";
import { TagBadge } from "./TagBadge";

interface HoloCardProps {
  title: string;
  description: string;
  tag: string;
  /** Icon element displayed at 1× in header, 2× on front face */
  icon: React.ReactNode;
  /** Optional preview/visualization shown in the revealed face */
  preview?: React.ReactNode;
  /** Named accent from the CIG palette */
  accent?: AccentColor;
  /** Override with any hex color (takes precedence over accent) */
  color?: string;
  /** Fixed card height in px (default 220) */
  height?: number;
  /** Whether this card is externally selected */
  selected?: boolean;
  /** Called on click when not dragging */
  onSelect?: () => void;
  /** CTA label (default: "Open {title} →") */
  ctaLabel?: string;
}

/**
 * Two-face holographic card — the carousel card from the authenticated landing.
 *
 * Front (idle): large glowing icon + title + tag + scan line + dot-grid
 * Revealed (hover/selected): staggered entrance with typewriter description + preview + CTA
 */
export function HoloCard({
  title,
  description,
  tag,
  icon,
  preview,
  accent,
  color,
  height = 220,
  selected = false,
  onSelect,
  ctaLabel,
}: HoloCardProps) {
  const [hovered, setHovered] = useState(false);
  const revealed = hovered || selected;
  const { typed, done } = useTypewriter(description, revealed);

  const c = color ?? (accent ? ACCENT_COLORS[accent].hex : "#06b6d4");
  const cta = ctaLabel ?? `Open ${title} →`;

  return (
    <article
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex-shrink-0 rounded-2xl cursor-pointer select-none overflow-hidden"
      style={{
        height,
        width: 256,
        border: `1px solid ${c}${revealed ? "55" : "25"}`,
        background: `linear-gradient(145deg, ${tint(c, revealed ? 0.14 : 0.06)} 0%, #070d1a 70%)`,
        boxShadow: revealed
          ? `0 0 0 1px ${tint(c, 0.2)}, 0 0 40px ${tint(c, 0.22)}, 0 20px 50px rgba(0,0,0,0.7)`
          : "0 4px 24px rgba(0,0,0,0.5)",
        transform: revealed ? "scale(1.04)" : "scale(1)",
        transition:
          "transform 0.35s cubic-bezier(.34,1.56,.64,1), box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease",
      }}
    >
      {/* Scan line */}
      <ScanLine color={c} speed={revealed ? "fast" : "slow"} />

      {/* Corner glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${tint(c, revealed ? 0.3 : 0.14)} 0%, transparent 70%)`,
          transition: "background 0.4s ease",
        }}
      />

      {/* ── FRONT FACE ────────────────────────────────────── */}
      <div
        aria-hidden={revealed}
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
        style={{
          opacity: revealed ? 0 : 1,
          transform: revealed ? "scale(0.82) translateY(-10px)" : "scale(1) translateY(0)",
          transition: "opacity 0.28s ease, transform 0.32s ease",
          pointerEvents: revealed ? "none" : "auto",
        }}
      >
        {/* Large icon with glow ring */}
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: 72,
            height: 72,
            backgroundColor: tint(c, 0.1),
            color: c,
            boxShadow: `0 0 0 1px ${tint(c, 0.25)}, 0 0 32px ${tint(c, 0.22)}, inset 0 0 20px ${tint(c, 0.08)}`,
            animation: "cig-glow-pulse 2.5s ease-in-out infinite",
          }}
        >
          <div style={{ transform: "scale(2)", transformOrigin: "center" }}>{icon}</div>
        </div>

        <div className="text-center">
          <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
          <div className="mt-1.5 flex justify-center">
            <TagBadge label={tag} color={c} />
          </div>
        </div>

        {/* Dot-grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, ${c} 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
            opacity: 0.04,
          }}
        />
      </div>

      {/* ── REVEALED FACE ─────────────────────────────────── */}
      <div
        className="absolute inset-0 flex flex-col p-5 gap-2"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.32s ease 0.05s, transform 0.32s ease 0.05s",
          pointerEvents: revealed ? "auto" : "none",
          overflowY: revealed ? "auto" : "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: `${tint(c, 0.4)} transparent`,
        }}
      >
        {/* Header row */}
        <div
          className="flex items-center justify-between"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(-8px)",
            transition: "opacity 0.28s ease 0.08s, transform 0.28s ease 0.08s",
          }}
        >
          <div
            className="flex items-center justify-center size-8 rounded-xl"
            style={{ backgroundColor: tint(c, 0.12), color: c }}
          >
            {icon}
          </div>
          <TagBadge label={tag} color={c} size="sm" />
        </div>

        {/* Title */}
        <h3
          className="text-sm font-bold text-zinc-100 leading-snug"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.28s ease 0.14s, transform 0.28s ease 0.14s",
          }}
        >
          {title}
        </h3>

        {/* Typewriter description */}
        <p className="text-[11px] text-zinc-400 leading-relaxed" style={{ minHeight: 40 }}>
          {typed}
          {revealed && !done && (
            <span
              className="inline-block w-px ml-px animate-pulse"
              style={{ height: 11, backgroundColor: c, verticalAlign: "middle" }}
            />
          )}
        </p>

        {/* Preview + CTA anchored at bottom */}
        <div className="mt-auto flex flex-col gap-2">
          {preview && (
            <div
              className="pt-2 border-t"
              style={{
                borderColor: tint(c, 0.15),
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 0.36s ease 0.22s, transform 0.36s ease 0.22s",
              }}
            >
              {preview}
            </div>
          )}

          <div
            className="text-[11px] font-semibold text-center py-1.5 rounded-xl"
            style={{
              backgroundColor: tint(c, 0.12),
              color: c,
              boxShadow: `0 0 12px ${tint(c, 0.14)}`,
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.32s ease 0.3s, transform 0.32s ease 0.3s",
            }}
          >
            {cta}
          </div>
        </div>
      </div>

      {/* Bottom bloom */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${tint(c, revealed ? 0.12 : 0)}, transparent)`,
          transition: "background 0.5s ease",
        }}
      />
    </article>
  );
}
