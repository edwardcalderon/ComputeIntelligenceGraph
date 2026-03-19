// ─── Design tokens ────────────────────────────────────────────────────────────

export const ACCENT_COLORS = {
  cyan:   { hex: '#06b6d4', rgb: '6,182,212'    },
  blue:   { hex: '#3b82f6', rgb: '59,130,246'   },
  violet: { hex: '#8b5cf6', rgb: '139,92,246'   },
  purple: { hex: '#a855f7', rgb: '168,85,247'   },
  green:  { hex: '#10b981', rgb: '16,185,129'   },
  amber:  { hex: '#f59e0b', rgb: '245,158,11'   },
  red:    { hex: '#ef4444', rgb: '239,68,68'    },
} as const;

export type AccentColor = keyof typeof ACCENT_COLORS;

export const BG = {
  deep:     '#050b14',
  card:     '#070d1a',
  elevated: '#0e1a30',
  overlay:  'rgba(8, 15, 30, 0.85)',
} as const;

export const BORDER = {
  subtle:  'rgba(255, 255, 255, 0.05)',
  default: 'rgba(255, 255, 255, 0.08)',
  accent:  'rgba(255, 255, 255, 0.14)',
} as const;

/** Returns a glow box-shadow string for a given hex color. */
export function glowShadow(hex: string, intensity = 0.35, radius = 24): string {
  const alpha = Math.round(intensity * 255).toString(16).padStart(2, '0');
  return `0 0 ${radius}px ${hex}${alpha}`;
}

/** Returns a tint background using hex + opacity fraction. */
export function tint(hex: string, opacity = 0.1): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${alpha}`;
}

/** Base glass card inline style — apply via `style={{ ...GLASS_BASE }}`. */
export const GLASS_BASE: React.CSSProperties = {
  backdropFilter: 'blur(12px) saturate(1.3)',
  WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
  background: BG.overlay,
  border: `1px solid ${BORDER.default}`,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
};
