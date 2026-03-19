"use client";

import React from "react";
import type { AccentColor } from "./tokens";

// ─── Sub-theme definitions ─────────────────────────────────────────────────

export type CIGThemeName = "landing" | "dashboard" | "wizard";

export interface CIGTheme {
  name: CIGThemeName;
  /** Default accent for this app */
  accent: AccentColor;
  /** CSS custom-property overrides */
  vars: Record<string, string>;
}

export const LANDING_THEME: CIGTheme = {
  name: "landing",
  accent: "cyan",
  vars: {
    "--cig-bg-deep":        "#050b14",
    "--cig-bg-card":        "rgba(7, 13, 26, 0.88)",
    "--cig-bg-elevated":    "rgba(14, 26, 48, 0.95)",
    "--cig-border":         "rgba(255,255,255,0.05)",
    "--cig-border-accent":  "rgba(6,182,212,0.25)",
    "--cig-accent":         "#06b6d4",
    "--cig-accent-rgb":     "6,182,212",
    "--cig-blur":           "12px",
  },
};

export const DASHBOARD_THEME: CIGTheme = {
  name: "dashboard",
  accent: "blue",
  vars: {
    "--cig-bg-deep":        "#0a0f1e",
    "--cig-bg-card":        "rgba(12, 18, 35, 0.90)",
    "--cig-bg-elevated":    "rgba(16, 26, 50, 0.96)",
    "--cig-border":         "rgba(255,255,255,0.07)",
    "--cig-border-accent":  "rgba(59,130,246,0.28)",
    "--cig-accent":         "#3b82f6",
    "--cig-accent-rgb":     "59,130,246",
    "--cig-blur":           "14px",
  },
};

export const WIZARD_THEME: CIGTheme = {
  name: "wizard",
  accent: "violet",
  vars: {
    "--cig-bg-deep":        "#08041a",
    "--cig-bg-card":        "rgba(14, 8, 36, 0.90)",
    "--cig-bg-elevated":    "rgba(22, 12, 55, 0.96)",
    "--cig-border":         "rgba(255,255,255,0.06)",
    "--cig-border-accent":  "rgba(139,92,246,0.30)",
    "--cig-accent":         "#8b5cf6",
    "--cig-accent-rgb":     "139,92,246",
    "--cig-blur":           "16px",
  },
};

export const THEMES: Record<CIGThemeName, CIGTheme> = {
  landing:   LANDING_THEME,
  dashboard: DASHBOARD_THEME,
  wizard:    WIZARD_THEME,
};

// ─── ThemeProvider ────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  theme: CIGThemeName | CIGTheme;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps children in a div that applies the chosen CIG sub-theme via
 * CSS custom properties and a `data-cig-theme` attribute.
 *
 * Usage:
 *   <ThemeProvider theme="dashboard">...</ThemeProvider>
 */
export function ThemeProvider({ theme, children, className }: ThemeProviderProps) {
  const resolved: CIGTheme = typeof theme === "string" ? THEMES[theme] : theme;
  const cssVars = Object.entries(resolved.vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

  return (
    <div
      data-cig-theme={resolved.name}
      className={className}
      style={resolved.vars as React.CSSProperties}
    >
      {/* Inline style block so vars cascade to portals/fixed elements too */}
      <style>{`[data-cig-theme="${resolved.name}"]{${cssVars}}`}</style>
      {children}
    </div>
  );
}

// ─── useCIGTheme ──────────────────────────────────────────────────────────────

/**
 * Reads the resolved `--cig-*` CSS variables from the nearest themed ancestor.
 * Falls back to landing theme values on the server / when no theme is present.
 */
export function useCIGTheme() {
  if (typeof window === "undefined") return LANDING_THEME.vars;
  const el = document.querySelector("[data-cig-theme]") ?? document.documentElement;
  const style = getComputedStyle(el);
  return Object.fromEntries(
    Object.keys(LANDING_THEME.vars).map((key) => [key, style.getPropertyValue(key).trim()])
  );
}
