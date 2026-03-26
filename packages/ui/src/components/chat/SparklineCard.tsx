import React from "react";
import { ChatCard } from "./ChatCard";
import { CardHeader } from "./CardHeader";
import { KpiBox } from "./KpiBox";
import { Sparkline, MiniSparkline } from "./Sparkline";
import { StarFeedback } from "./StarFeedback";
import type { KpiData, ChannelTrend, TrendDirection } from "./types";

const CHANNEL_COLORS: Record<TrendDirection, string> = {
  up:   "#27500A",
  down: "#791F1F",
  flat: "#888",
};

interface SparklineCardProps {
  title?: string;
  period?: string;
  kpis?: KpiData[];
  /** Main sparkline data points (will be normalized) */
  mainPoints: number[];
  showDayLabels?: boolean;
  channels?: ChannelTrend[];
  showFeedback?: boolean;
  onRate?: (rating: number) => void;
}

/**
 * Trend card: optional KPI row + main sparkline + optional per-channel mini-sparklines.
 * Typically used for 7-day sales summaries.
 */
export function SparklineCard({
  title = "ERP · Ventas · Tendencia",
  period,
  kpis,
  mainPoints,
  showDayLabels = true,
  channels,
  showFeedback = true,
  onRate,
}: SparklineCardProps) {
  return (
    <ChatCard>
      <CardHeader title={title} rightLabel={period} />
      <div className="px-3 py-2.5">
        {/* KPI row */}
        {kpis && kpis.length > 0 && (
          <div className="flex gap-1.5 mb-2">
            {kpis.map((kpi, i) => (
              <KpiBox
                key={i}
                value={kpi.value}
                label={kpi.label}
                variant={kpi.variant}
              />
            ))}
          </div>
        )}

        {/* Main sparkline */}
        <Sparkline
          points={mainPoints}
          showArea
          showPeakDot
          showDayLabels={showDayLabels}
          height={52}
        />

        {/* Channel mini-sparklines */}
        {channels && channels.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {channels.map((ch, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span
                  className="flex-shrink-0 text-[9px]"
                  style={{ color: "#555", width: 52 }}
                >
                  {ch.name}
                </span>
                <MiniSparkline
                  points={ch.points}
                  color={ch.color ?? "#6C3DE8"}
                  width={90}
                  height={16}
                />
                <span
                  className="ml-auto text-[9px] font-semibold flex-shrink-0"
                  style={{
                    color: CHANNEL_COLORS[ch.direction],
                  }}
                >
                  {ch.direction === "up" ? "↑" : ch.direction === "down" ? "↓" : "→"}{" "}
                  {ch.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showFeedback && <StarFeedback onRate={onRate} />}
    </ChatCard>
  );
}
