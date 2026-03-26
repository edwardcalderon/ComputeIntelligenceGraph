import React from "react";

interface SummaryBadgesProps {
  critical: number;
  attention: number;
  ok: number;
  labels?: {
    critical?: string;
    attention?: string;
    ok?: string;
  };
}

export function SummaryBadges({
  critical,
  attention,
  ok,
  labels = {},
}: SummaryBadgesProps) {
  const items = [
    {
      value: critical,
      label: labels.critical ?? "Crítico",
      bg: "#FCEBEB",
      valueColor: "#791F1F",
    },
    {
      value: attention,
      label: labels.attention ?? "Atención",
      bg: "#FAEEDA",
      valueColor: "#854F0B",
    },
    {
      value: ok,
      label: labels.ok ?? "Normal",
      bg: "#EAF3DE",
      valueColor: "#27500A",
    },
  ];

  return (
    <div className="flex gap-1.5 mt-2">
      {items.map(({ value, label, bg, valueColor }) => (
        <div
          key={label}
          className="flex-1 rounded-lg px-2 py-1.5 text-center"
          style={{ background: bg }}
        >
          <p
            className="text-base font-bold leading-none"
            style={{ color: valueColor }}
          >
            {value}
          </p>
          <p className="mt-0.5 text-[9.5px]" style={{ color: "#888" }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
