"use client";

import React from "react";
import { ACCENT_COLORS, BORDER, BG, GLASS_BASE, glowShadow, tint, type AccentColor } from "../theme/tokens";
import { ScanLine } from "./ScanLine";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Named accent color from the CIG palette */
  accent?: AccentColor;
  /** Override with any hex color */
  color?: string;
  /** Glow intensity 0–1 (default 0.3) */
  glow?: number;
  /** Show animated scan line */
  scanLine?: boolean;
  /** Show corner glow blob */
  cornerGlow?: boolean;
  /** Show subtle dot-grid overlay */
  dotGrid?: boolean;
  /** Active/selected state — intensifies border + glow */
  active?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Base glass morphism card — the visual foundation for all CIG cards.
 *
 * Extend this for feature cards, dashboard panels, wizard steps, etc.
 */
export function GlassCard({
  children,
  className = "",
  style,
  accent,
  color,
  glow = 0.3,
  scanLine = false,
  cornerGlow = true,
  dotGrid = false,
  active = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GlassCardProps) {
  const c = color ?? (accent ? ACCENT_COLORS[accent].hex : null);
  const borderColor = active
    ? c ? `${c}55` : BORDER.accent
    : c ? `${c}22` : BORDER.default;

  const shadow = [
    "0 8px 32px rgba(0,0,0,0.5)",
    "inset 0 1px 0 rgba(255,255,255,0.05)",
    c && active ? glowShadow(c, glow, 32) : null,
    c && active ? `0 0 ${glow * 80}px ${c}20` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{
        ...GLASS_BASE,
        background: c
          ? `linear-gradient(145deg, ${tint(c, active ? 0.14 : 0.06)} 0%, ${BG.card} 70%)`
          : BG.overlay,
        border: `1px solid ${borderColor}`,
        boxShadow: shadow,
        transition: "border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease",
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Scan line */}
      {scanLine && c && <ScanLine color={c} speed={active ? "fast" : "slow"} />}

      {/* Corner glow */}
      {cornerGlow && c && (
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at top right, ${tint(c, active ? 0.3 : 0.14)} 0%, transparent 70%)`,
            transition: "background 0.4s ease",
          }}
        />
      )}

      {/* Dot-grid overlay */}
      {dotGrid && c && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, ${c} 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
            opacity: 0.04,
          }}
        />
      )}

      {/* Bottom bloom */}
      {c && (
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${tint(c, active ? 0.12 : 0)}, transparent)`,
            transition: "background 0.4s ease",
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
