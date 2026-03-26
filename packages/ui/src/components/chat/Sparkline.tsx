import React from "react";

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

function normalize(pts: number[]): number[] {
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  if (max === min) return pts.map(() => 50);
  return pts.map((v) => ((v - min) / (max - min)) * 100);
}

function buildPath(
  norm: number[],
  svgW: number,
  svgH: number,
  marginY = 0.1
): { d: string; areaD: string; coords: { x: number; y: number }[] } {
  const top = svgH * marginY;
  const bottom = svgH * (1 - marginY);
  const usable = bottom - top;
  const step = norm.length > 1 ? svgW / (norm.length - 1) : 0;

  const coords = norm.map((v, i) => ({
    x: i * step,
    y: bottom - (v / 100) * usable,
  }));

  const d = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = `${d} L${svgW},${svgH} L0,${svgH}Z`;

  return { d, areaD, coords };
}

// ─── Main sparkline ──────────────────────────────────────────────────────────

interface SparklineProps {
  points: number[];
  color?: string;
  /** Show area fill under the curve */
  showArea?: boolean;
  /** Mark the peak value with a dot */
  showPeakDot?: boolean;
  /** Show abbreviated day labels (L M X J V S D) below the chart */
  showDayLabels?: boolean;
  width?: number;
  height?: number;
}

export function Sparkline({
  points,
  color = "#6C3DE8",
  showArea = true,
  showPeakDot = true,
  showDayLabels = false,
  width = 230,
  height = 52,
}: SparklineProps) {
  if (points.length < 2) return null;

  const norm = normalize(points);
  const { d, areaD, coords } = buildPath(norm, width, height);
  const peakIdx = norm.indexOf(Math.max(...norm));
  const gradId = `spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {showArea && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {showArea && <path d={areaD} fill={`url(#${gradId})`} />}
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
        {showPeakDot && (
          <circle cx={coords[peakIdx].x} cy={coords[peakIdx].y} r="3" fill={color} />
        )}
      </svg>
      {showDayLabels && (
        <div className="flex justify-between mt-0.5" style={{ fontSize: 8, color: "#aaa" }}>
          {DAYS.slice(0, points.length).map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mini sparkline (inline, no area) ────────────────────────────────────────

interface MiniSparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function MiniSparkline({
  points,
  color = "#6C3DE8",
  width = 90,
  height = 16,
}: MiniSparklineProps) {
  if (points.length < 2) return null;

  const norm = normalize(points);
  const { d } = buildPath(norm, width, height, 0.05);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
