import React from "react";
import { ChatCard } from "./ChatCard";
import { CardHeader } from "./CardHeader";
import { StarFeedback } from "./StarFeedback";
import type { BarChartRow } from "./types";

interface BarChartCardProps {
  title?: string;
  period?: string;
  bigNumber: string;
  bigLabel?: string;
  /** e.g. "12%" — rendered with a ▲/▼ delta badge */
  delta?: string;
  deltaDirection?: "up" | "down";
  rows: BarChartRow[];
  showFeedback?: boolean;
  onRate?: (rating: number) => void;
}

/**
 * Horizontal bar chart card: big KPI number + trend delta + labelled proportion bars.
 * Typically used for channel/segment breakdowns (e.g. sales by channel).
 */
export function BarChartCard({
  title = "ERP · Ventas",
  period,
  bigNumber,
  bigLabel,
  delta,
  deltaDirection = "up",
  rows,
  showFeedback = true,
  onRate,
}: BarChartCardProps) {
  return (
    <ChatCard>
      <CardHeader title={title} rightLabel={period} />
      <div className="px-3 py-2.5">
        {/* Big number */}
        <p
          className="text-2xl font-bold leading-none"
          style={{ color: "#1a1a2e", letterSpacing: "-0.5px" }}
        >
          {bigNumber}
        </p>

        {/* Label + delta badge */}
        <div className="flex items-center gap-1.5 mt-1 mb-2.5">
          {bigLabel && (
            <span className="text-[11px]" style={{ color: "#888" }}>
              {bigLabel}
            </span>
          )}
          {delta && (
            <span
              className="rounded-lg px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={
                deltaDirection === "up"
                  ? { background: "#EAF3DE", color: "#27500A" }
                  : { background: "#FCEBEB", color: "#791F1F" }
              }
            >
              {deltaDirection === "up" ? "▲" : "▼"} {delta}
            </span>
          )}
        </div>

        {/* Bar rows */}
        <div className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="flex-shrink-0 truncate text-[11px]"
                style={{ color: "#444", width: 74 }}
              >
                {row.label}
              </span>
              <div
                className="flex-1 h-3 overflow-hidden rounded-md"
                style={{ background: "#EEEDFE" }}
              >
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${Math.min(100, Math.max(0, row.percent))}%`,
                    background: row.color ?? "#6C3DE8",
                  }}
                />
              </div>
              <span
                className="flex-shrink-0 w-10 text-right text-[11px] font-semibold"
                style={{ color: "#1a1a2e" }}
              >
                {row.displayValue}
              </span>
            </div>
          ))}
        </div>
      </div>
      {showFeedback && <StarFeedback onRate={onRate} />}
    </ChatCard>
  );
}
