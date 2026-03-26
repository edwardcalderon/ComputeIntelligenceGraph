import React from "react";
import { ChatCard } from "./ChatCard";
import { CardHeader } from "./CardHeader";
import { StarFeedback } from "./StarFeedback";
import type { GaugeDetailRow, GaugeValueColor } from "./types";

const VALUE_COLORS: Record<GaugeValueColor, string> = {
  green: "#27500A",
  amber: "#854F0B",
  red:   "#791F1F",
  navy:  "#1a1a2e",
};

function gaugeColor(pct: number): string {
  if (pct >= 80) return "#1D9E75";
  if (pct >= 50) return "#EF9F27";
  return "#E24B4A";
}

function gaugeTrack(pct: number): string {
  if (pct >= 80) return "#EAF3DE";
  if (pct >= 50) return "#FAEEDA";
  return "#FCEBEB";
}

interface GaugeCardProps {
  title?: string;
  period?: string;
  /** 0–100 */
  percent: number;
  sublabel?: string;
  detail?: GaugeDetailRow[];
  showFeedback?: boolean;
  onRate?: (rating: number) => void;
}

/**
 * Semicircle gauge card for goal/target completion.
 * Color auto-adapts: green ≥80%, amber 50–79%, red <50%.
 */
export function GaugeCard({
  title = "ERP · Meta mensual",
  period,
  percent,
  sublabel = "de la meta",
  detail = [],
  showFeedback = true,
  onRate,
}: GaugeCardProps) {
  // Arc total ≈ 245px for r=78 semicircle
  const arcTotal = 245;
  const fill = (Math.min(100, Math.max(0, percent)) / 100) * arcTotal;
  const color = gaugeColor(percent);
  const track = gaugeTrack(percent);

  return (
    <ChatCard>
      <CardHeader title={title} rightLabel={period} />
      <div className="px-3 py-2.5">
        {/* Gauge SVG */}
        <div className="flex justify-center mb-1">
          <svg width="180" height="108" viewBox="0 0 180 108">
            {/* Track arc */}
            <path
              d="M22,96 A78,78 0 0,1 158,96"
              fill="none"
              stroke={track}
              strokeWidth="15"
              strokeLinecap="round"
            />
            {/* Progress arc */}
            <path
              d="M22,96 A78,78 0 0,1 158,96"
              fill="none"
              stroke={color}
              strokeWidth="15"
              strokeLinecap="round"
              strokeDasharray={`${fill.toFixed(1)} ${arcTotal}`}
              strokeDashoffset="0"
            />
            {/* Quarter tick marks */}
            <line x1="22"  y1="96" x2="28"  y2="84" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
            <line x1="90"  y1="18" x2="90"  y2="30" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
            <line x1="158" y1="96" x2="152" y2="84" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
            {/* Center label */}
            <text
              x="90" y="82"
              textAnchor="middle"
              fontSize="24"
              fontWeight="700"
              fill="#1a1a2e"
              fontFamily="DM Sans, sans-serif"
            >
              {percent}%
            </text>
            <text
              x="90" y="97"
              textAnchor="middle"
              fontSize="10"
              fill="#888"
              fontFamily="DM Sans, sans-serif"
            >
              {sublabel}
            </text>
          </svg>
        </div>

        {/* Detail rows */}
        {detail.length > 0 && (
          <div className="flex flex-col gap-1">
            {detail.map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[10px]"
              >
                <span style={{ color: "#555" }}>{row.label}</span>
                <span
                  className="font-semibold"
                  style={{
                    color: VALUE_COLORS[row.valueColor ?? "navy"],
                  }}
                >
                  {row.value}
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
