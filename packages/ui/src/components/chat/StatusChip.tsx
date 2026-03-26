import React from "react";

type StatusChipVariant = "critical" | "attention" | "ok";

const CHIP_STYLES: Record<StatusChipVariant, { bg: string; text: string; dot: string }> = {
  critical:  { bg: "#2e0d0d", text: "#F09595", dot: "#E24B4A" },
  attention: { bg: "#2e1e0a", text: "#FAC775", dot: "#EF9F27" },
  ok:        { bg: "#0d2e1f", text: "#5DCAA5", dot: "#1D9E75" },
};

interface StatusChipProps {
  variant: StatusChipVariant;
  label: string;
  className?: string;
}

export function StatusChip({ variant, label, className }: StatusChipProps) {
  const s = CHIP_STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[10px] font-semibold${className ? ` ${className}` : ""}`}
      style={{ background: s.bg, color: s.text }}
    >
      <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {label}
    </span>
  );
}
