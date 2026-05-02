"use client";

import type { GpuSessionStatus } from "../../types/gpu";
import { getSessionStatusColor } from "../../lib/gpuUtils";

interface StatusBadgeProps {
  status: GpuSessionStatus;
}

/** Capitalize the first letter of a status string for display. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Renders a colored text label for a GPU session status value.
 * Both color and text are displayed so status is never conveyed by color alone.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = getSessionStatusColor(status);

  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${colorClass}`}
      role="status"
      aria-label={`Session status: ${capitalize(status)}`}
    >
      {capitalize(status)}
    </span>
  );
}
