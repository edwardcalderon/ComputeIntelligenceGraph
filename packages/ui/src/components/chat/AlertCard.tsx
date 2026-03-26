"use client";

import React, { useState } from "react";
import { ChatCard } from "./ChatCard";
import { CardHeader } from "./CardHeader";
import { StatusBar } from "./StatusBar";
import { AlertItem } from "./AlertItem";
import { SummaryBadges } from "./SummaryBadges";
import { StarFeedback } from "./StarFeedback";
import type { AlertItemData } from "./types";

interface AlertCardProps {
  title?: string;
  timestamp?: string;
  items: AlertItemData[];
  showSummary?: boolean;
  showFeedback?: boolean;
  onRate?: (rating: number) => void;
}

const LEGEND = [
  { icon: "▲▲", label: "Critical",  iconBg: "#F7C1C1", iconColor: "#791F1F", rowBg: "#FCEBEB", desc: "Requires immediate action" },
  { icon: "▲",  label: "Attention", iconBg: "#FAC775", iconColor: "#854F0B", rowBg: "#FAEEDA", desc: "Monitor closely, may escalate" },
  { icon: "◑",  label: "Partial",   iconBg: "#FAC775", iconColor: "#854F0B", rowBg: "#FAEEDA", desc: "Partially met or degraded" },
  { icon: "✓",  label: "OK",        iconBg: "#C0DD97", iconColor: "#27500A", rowBg: "#EAF3DE", desc: "Operating within normal range" },
];

/**
 * Multi-module alert panel card — always the first card of the day.
 * Includes a severity gradient status bar, alert item rows, summary badges,
 * optional legend, and optional star-rating footer.
 */
export function AlertCard({
  title = "Panel de alertas",
  timestamp = "Ahora",
  items,
  showSummary = true,
  showFeedback = true,
  onRate,
}: AlertCardProps) {
  const [legendOpen, setLegendOpen] = useState(false);

  const critical = items.filter((i) => i.severity === "critical").length;
  const attention = items.filter(
    (i) => i.severity === "attention" || i.severity === "partial"
  ).length;
  const ok = items.filter((i) => i.severity === "ok").length;

  return (
    <ChatCard>
      <StatusBar />
      <CardHeader title={title} rightLabel={timestamp} />
      <div className="px-3 py-2.5">
        {items.map((item, idx) => (
          <AlertItem key={idx} {...item} />
        ))}
        {showSummary && (
          <SummaryBadges critical={critical} attention={attention} ok={ok} />
        )}

        {/* Legend toggle */}
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-black/5"
          style={{ color: "#6C3DE8" }}
        >
          <span
            className="flex size-4 flex-shrink-0 items-center justify-center rounded-full border text-[9px] font-bold"
            style={{ borderColor: "#6C3DE8", color: "#6C3DE8" }}
          >
            {legendOpen ? "−" : "?"}
          </span>
          <span className="text-[10px] font-semibold tracking-wide">
            {legendOpen ? "Hide legend" : "Show severity legend"}
          </span>
        </button>

        {legendOpen && (
          <div
            className="mt-1.5 overflow-hidden rounded-xl border"
            style={{ borderColor: "#e8e4f8", background: "#faf9ff" }}
          >
            <div
              className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "#6C3DE8", borderBottom: "1px solid #e8e4f8" }}
            >
              Severity guide
            </div>
            {LEGEND.map((row) => (
              <div
                key={row.label}
                className="flex items-center gap-2.5 px-3 py-2"
                style={{ borderBottom: "1px solid #f0eefb" }}
              >
                <div
                  className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ background: row.iconBg, color: row.iconColor }}
                >
                  {row.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: "#1a1a2e" }}
                  >
                    {row.label}
                  </p>
                  <p className="text-[9.5px]" style={{ color: "#888" }}>
                    {row.desc}
                  </p>
                </div>
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-sm"
                  style={{ background: row.rowBg, border: `1.5px solid ${row.iconBg}` }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {showFeedback && <StarFeedback onRate={onRate} />}
    </ChatCard>
  );
}
