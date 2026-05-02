"use client";

import { useCallback } from "react";
import type { GpuActivityEventType } from "../../types/gpu";
import { getActivityEventConfig } from "../../lib/gpuUtils";

/** All activity event types. */
const EVENT_TYPES: GpuActivityEventType[] = [
  "session_created",
  "session_terminated",
  "session_rotated",
  "health_check_failed",
  "recovery_triggered",
  "worker_restarted",
  "config_changed",
];

/** Convert an event type slug to a human-readable label (e.g. "session_created" → "Session Created"). */
function formatEventTypeLabel(eventType: GpuActivityEventType): string {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface EventTypeFilterProps {
  /** Currently selected event types. */
  selectedTypes: Set<GpuActivityEventType>;
  /** Called when the selection changes. */
  onChange: (types: Set<GpuActivityEventType>) => void;
}

/**
 * Multi-select filter for GPU activity event types.
 *
 * Renders a checkbox for each `GpuActivityEventType` value with color-coded
 * labels derived from `getActivityEventConfig`.
 */
export function EventTypeFilter({
  selectedTypes,
  onChange,
}: EventTypeFilterProps) {
  const handleToggle = useCallback(
    (eventType: GpuActivityEventType, checked: boolean) => {
      const next = new Set(selectedTypes);
      if (checked) {
        next.add(eventType);
      } else {
        next.delete(eventType);
      }
      onChange(next);
    },
    [selectedTypes, onChange],
  );

  return (
    <fieldset className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <legend className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
        Event Type
      </legend>
      <div className="flex flex-wrap gap-3">
        {EVENT_TYPES.map((eventType) => {
          const config = getActivityEventConfig(eventType);
          const checked = selectedTypes.has(eventType);
          const label = formatEventTypeLabel(eventType);

          return (
            <label
              key={eventType}
              className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium ${config.color}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => handleToggle(eventType, e.target.checked)}
                className="size-3.5 rounded border-gray-300 dark:border-gray-600"
                aria-label={`Filter by ${label}`}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
