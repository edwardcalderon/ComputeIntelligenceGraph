export type Severity = "critical" | "attention" | "partial" | "ok";
export type TrendDirection = "up" | "down" | "flat";
export type CardHeaderVariant = "purple" | "red" | "green" | "blue";
export type KpiVariant = "neutral" | "positive" | "warning";
export type GaugeValueColor = "green" | "amber" | "navy" | "red";
export type TimelineEventType = "start" | "process" | "error" | "pending";

export interface AlertItemData {
  severity: Severity;
  title: string;
  subtitle: string;
  value: string | number;
}

export interface KpiData {
  value: string;
  label: string;
  variant?: KpiVariant;
}

export interface BarChartRow {
  label: string;
  /** 0–100 */
  percent: number;
  displayValue: string;
  color?: string;
}

export interface ChannelTrend {
  name: string;
  /** 7 normalized values (0 = low, 100 = high) */
  points: number[];
  direction: TrendDirection;
  delta: string;
  color?: string;
}

export interface TimelineEvent {
  time: string;
  source: string;
  title: string;
  description: string;
  type: TimelineEventType;
}

export interface GaugeDetailRow {
  label: string;
  value: string;
  valueColor?: GaugeValueColor;
}
