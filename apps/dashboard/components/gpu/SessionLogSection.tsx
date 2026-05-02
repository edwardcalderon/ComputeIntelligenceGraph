"use client";

import type { GpuLogEntry } from "../../types/gpu";
import { LogEntry } from "./LogEntry";

interface SessionLogSectionProps {
  logs: GpuLogEntry[];
  sessionId: string;
}

/**
 * Displays recent log entries filtered to a specific session.
 * Used on the Session Detail page to show session-specific logs.
 *
 * Requirements: 3.9 (recent logs section on session detail)
 */
export function SessionLogSection({ logs, sessionId }: SessionLogSectionProps) {
  // Filter logs to the current session (API may already filter, but ensure client-side)
  const sessionLogs = logs.filter(
    (log) => log.sessionId === sessionId || log.sessionId === null,
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <h3 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Recent Logs
      </h3>

      {sessionLogs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          No recent logs for this session.
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {sessionLogs.map((log) => (
            <LogEntry key={log.id} entry={log} />
          ))}
        </div>
      )}
    </div>
  );
}
