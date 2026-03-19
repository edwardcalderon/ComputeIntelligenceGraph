"use client";

import React from "react";

interface GlowButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  /** Hex colors for the gradient — defaults to CIG cyan→blue→violet */
  gradient?: [string, string, ...string[]];
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const SIZE = {
  sm: "px-5 py-2 text-xs",
  md: "px-8 py-3.5 text-sm",
  lg: "px-10 py-4 text-base",
} as const;

const DEFAULT_GRADIENT: [string, string, string] = ["#06b6d4", "#3b82f6", "#8b5cf6"];

/**
 * Gradient glow button — the primary CTA style across all CIG apps.
 */
export function GlowButton({
  children,
  onClick,
  gradient = DEFAULT_GRADIENT,
  size = "md",
  className = "",
  disabled = false,
  type = "button",
}: GlowButtonProps) {
  const bg = `linear-gradient(135deg, ${gradient.join(", ")})`;
  const glowColor = gradient[0];
  const shadowBase = `0 0 24px ${glowColor}50, 0 4px 20px rgba(0,0,0,0.4)`;
  const shadowHover = `0 0 40px ${glowColor}70, 0 8px 32px rgba(0,0,0,0.5)`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full font-semibold text-white transition-all duration-300 select-none ${SIZE[size]} ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-95"
      } ${className}`}
      style={{ background: bg, boxShadow: shadowBase }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.boxShadow = shadowHover;
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.boxShadow = shadowBase;
      }}
    >
      {children}
    </button>
  );
}
