"use client";

import { getHealthStatusConfig } from "../../lib/gpuUtils";

interface HealthIndicatorProps {
  status: "healthy" | "unhealthy" | "no_data";
  label?: string; // e.g., "Session health" or "Worker heartbeat"
}

export function HealthIndicator({ status, label }: HealthIndicatorProps) {
  const config = getHealthStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${config.textColor}`}
      role="status"
      aria-label={label ? `${label}: ${config.text}` : config.text}
    >
      <span
        className={`size-2 rounded-full ${config.dotColor}`}
        aria-hidden="true"
      />
      <span className="text-xs font-medium">{config.text}</span>
    </span>
  );
}
