import React from "react";
import type { KpiVariant } from "./types";

const KPI_COLORS: Record<KpiVariant, { bg: string; valueColor: string }> = {
  neutral:  { bg: "#EEEDFE", valueColor: "#3C3489" },
  positive: { bg: "#EAF3DE", valueColor: "#27500A" },
  warning:  { bg: "#FAEEDA", valueColor: "#854F0B" },
};

interface KpiBoxProps {
  value: string;
  label: string;
  variant?: KpiVariant;
  className?: string;
}

export function KpiBox({ value, label, variant = "neutral", className }: KpiBoxProps) {
  const c = KPI_COLORS[variant];
  return (
    <div
      className={`flex-1 rounded-lg px-1.5 py-1.5 text-center${className ? ` ${className}` : ""}`}
      style={{ background: c.bg }}
    >
      <p className="text-sm font-bold leading-tight" style={{ color: c.valueColor }}>
        {value}
      </p>
      <p className="mt-0.5 text-[8px]" style={{ color: "#888" }}>
        {label}
      </p>
    </div>
  );
}
