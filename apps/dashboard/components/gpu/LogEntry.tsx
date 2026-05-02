"use client";

import { useState } from "react";
import type { GpuLogEntry } from "../../types/gpu";
import { getLogLevelColor } from "../../lib/gpuUtils";

interface LogEntryProps {
  entry: GpuLogEntry;
}

/** Background color classes for log level badges. */
const LOG_LEVEL_BG: Record<GpuLogEntry["level"], string> = {
  debug: "bg-gray-100 dark:bg-gray-800",
  info: "bg-blue-100 dark:bg-blue-900",
  warn: "bg-yellow-100 dark:bg-yellow-900",
  error: "bg-red-100 dark:bg-red-900",
};

/**
 * Renders a single structured log entry with collapsed/expanded state.
 *
 * Collapsed view shows: timestamp, level badge, component, session ID, message.
 * Expanded view additionally shows: JSON details and error with optional stack trace.
 */
export function LogEntry({ entry }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const levelColor = getLogLevelColor(entry.level);
  const levelBg = LOG_LEVEL_BG[entry.level];
  const formattedTimestamp = new Date(entry.timestamp).toLocaleString();
  const hasExpandableContent =
    (entry.details && Object.keys(entry.details).length > 0) || entry.error;

  return (
    <div
      className={`border-b border-gray-200 dark:border-gray-700 ${
        expanded ? "bg-gray-50 dark:bg-gray-800/50" : ""
      }`}
    >
      {/* Collapsed row – always visible */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`Log entry: ${entry.level} - ${entry.message}`}
      >
        {/* Timestamp */}
        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
          {formattedTimestamp}
        </span>

        {/* Level badge */}
        <span
          className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${levelBg} ${levelColor}`}
        >
          {entry.level}
        </span>

        {/* Component */}
        <span className="shrink-0 text-xs font-medium text-gray-700 dark:text-gray-300">
          {entry.component}
        </span>

        {/* Session ID */}
        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 font-mono">
          {entry.sessionId ?? "—"}
        </span>

        {/* Message */}
        <span className="min-w-0 flex-1 truncate text-xs text-gray-800 dark:text-gray-200">
          {entry.message}
        </span>

        {/* Expand indicator */}
        {hasExpandableContent && (
          <span
            className={`shrink-0 text-gray-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            ▶
          </span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && hasExpandableContent && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          {/* JSON details */}
          {entry.details && Object.keys(entry.details).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Details
              </p>
              <pre className="rounded bg-gray-100 dark:bg-gray-900 p-2 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto font-mono">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          )}

          {/* Error section */}
          {entry.error && (
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
                Error
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                {entry.error.message}
              </p>
              {entry.error.stack && (
                <pre className="mt-1 rounded bg-red-50 dark:bg-red-900/30 p-2 text-xs text-red-800 dark:text-red-200 overflow-x-auto font-mono whitespace-pre-wrap">
                  {entry.error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
