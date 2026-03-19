"use client";

import React from "react";
import { tint } from "../theme/tokens";

interface TagBadgeProps {
  label: string;
  color: string;
  size?: "sm" | "md";
}

/**
 * Colored pill badge — used for feature tags, status labels, etc.
 */
export function TagBadge({ label, color, size = "md" }: TagBadgeProps) {
  return (
    <span
      className={`inline-block font-semibold rounded-full tracking-wide ${
        size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-0.5"
      }`}
      style={{
        backgroundColor: tint(color, 0.12),
        color,
        border: `1px solid ${tint(color, 0.22)}`,
      }}
    >
      {label}
    </span>
  );
}
