"use client";

import Link from "next/link";
import {
  PlusCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Wrench,
  RotateCw,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GpuActivityEvent } from "../../types/gpu";
import { getActivityEventConfig } from "../../lib/gpuUtils";

interface TimelineEventProps {
  event: GpuActivityEvent;
}

/** Maps iconCategory strings from getActivityEventConfig to actual lucide-react components. */
const ICON_MAP: Record<string, LucideIcon> = {
  "plus-circle": PlusCircle,
  "x-circle": XCircle,
  refresh: RefreshCw,
  "alert-triangle": AlertTriangle,
  wrench: Wrench,
  rotate: RotateCw,
  settings: Settings,
};

/**
 * Renders a single activity timeline event with icon, timestamp,
 * optional session link, and description.
 */
export function TimelineEvent({ event }: TimelineEventProps) {
  const config = getActivityEventConfig(event.eventType);
  const IconComponent = ICON_MAP[config.iconCategory];
  const formattedTimestamp = new Date(event.timestamp).toLocaleString();

  return (
    <div className="flex items-start gap-3 py-3 px-3 border-b border-gray-200 dark:border-gray-700">
      {/* Icon */}
      <span className={`shrink-0 mt-0.5 ${config.color}`} aria-hidden="true">
        {IconComponent ? (
          <IconComponent className="size-5" data-testid="event-icon" />
        ) : null}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        {/* Top row: timestamp + event type */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
            {formattedTimestamp}
          </span>
          <span className={`font-semibold ${config.color}`}>
            {event.eventType.replace(/_/g, " ")}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-800 dark:text-gray-200">
          {event.description}
        </p>

        {/* Session ID link */}
        {event.sessionId && (
          <Link
            href={`/gpu/sessions/${event.sessionId}`}
            className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono"
          >
            {event.sessionId}
          </Link>
        )}
      </div>
    </div>
  );
}
