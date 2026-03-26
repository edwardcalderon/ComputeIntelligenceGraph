import React from "react";
import type { CardHeaderVariant } from "./types";

const HEADER_STYLES: Record<CardHeaderVariant, { bg: string; dot: string; text: string; rightColor: string }> = {
  purple: { bg: "#EEEDFE", dot: "#6C3DE8", text: "#3C3489", rightColor: "#9F77F5" },
  red:    { bg: "#FCEBEB", dot: "#E24B4A", text: "#791F1F", rightColor: "#E24B4A" },
  green:  { bg: "#EAF3DE", dot: "#1D9E75", text: "#27500A", rightColor: "#1D9E75" },
  blue:   { bg: "#E6F1FB", dot: "#378ADD", text: "#0C447C", rightColor: "#378ADD" },
};

interface CardHeaderProps {
  variant?: CardHeaderVariant;
  title: string;
  rightLabel?: string;
}

export function CardHeader({ variant = "purple", title, rightLabel }: CardHeaderProps) {
  const s = HEADER_STYLES[variant];
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5"
      style={{ background: s.bg }}
    >
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
        <span
          className="text-[10px] font-bold uppercase tracking-wide"
          style={{ color: s.text }}
        >
          {title}
        </span>
      </div>
      {rightLabel && (
        <span className="text-[10px]" style={{ color: s.rightColor }}>
          {rightLabel}
        </span>
      )}
    </div>
  );
}
