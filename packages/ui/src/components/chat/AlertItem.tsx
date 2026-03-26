import React from "react";
import type { Severity } from "./types";

const SEVERITY_CONFIG: Record<
  Severity,
  { bg: string; iconBg: string; iconColor: string; valueColor: string; icon: string }
> = {
  critical:  { bg: "#FCEBEB", iconBg: "#F7C1C1", iconColor: "#791F1F", valueColor: "#791F1F", icon: "▲▲" },
  attention: { bg: "#FAEEDA", iconBg: "#FAC775", iconColor: "#854F0B", valueColor: "#854F0B", icon: "▲" },
  partial:   { bg: "#FAEEDA", iconBg: "#FAC775", iconColor: "#854F0B", valueColor: "#854F0B", icon: "◑" },
  ok:        { bg: "#EAF3DE", iconBg: "#C0DD97", iconColor: "#27500A", valueColor: "#27500A", icon: "✓" },
};

export interface AlertItemProps {
  severity: Severity;
  title: string;
  subtitle: string;
  value: string | number;
}

export function AlertItem({ severity, title, subtitle, value }: AlertItemProps) {
  const c = SEVERITY_CONFIG[severity];
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1.5 last:mb-0"
      style={{ background: c.bg }}
    >
      <div
        className="flex size-[30px] flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold"
        style={{ background: c.iconBg, color: c.iconColor }}
      >
        {c.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold" style={{ color: "#1a1a2e" }}>
          {title}
        </p>
        <p className="text-[10.5px] mt-0.5" style={{ color: "#666" }}>
          {subtitle}
        </p>
      </div>
      <span
        className="flex-shrink-0 text-[15px] font-bold text-right"
        style={{ color: c.valueColor }}
      >
        {value}
      </span>
    </div>
  );
}
