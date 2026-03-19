"use client";

import React from "react";

interface ScanLineProps {
  /** Accent hex color for the gradient */
  color: string;
  /** Animation duration — slow (3s) or fast (1.2s) */
  speed?: "slow" | "fast";
}

/**
 * A horizontal line that sweeps from top to bottom with a glow gradient.
 * Parent must have `position: relative` and `overflow: hidden`.
 */
export function ScanLine({ color, speed = "slow" }: ScanLineProps) {
  return (
    <div
      aria-hidden="true"
      className="absolute left-0 right-0 h-px pointer-events-none"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${color}cc 40%, ${color} 50%, ${color}cc 60%, transparent 100%)`,
        animation: `cig-scan ${speed === "fast" ? "1.2s" : "3s"} ease-in-out infinite`,
        top: 0,
        zIndex: 2,
      }}
    />
  );
}
