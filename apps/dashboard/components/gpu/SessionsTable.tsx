"use client";

import type { GpuSession } from "../../types/gpu";
import { StatusBadge } from "./StatusBadge";
import { HealthIndicator } from "./HealthIndicator";

interface SessionsTableProps {
  sessions: GpuSession[];
  onRowClick: (sessionId: string) => void;
}

/** Format seconds into a human-readable uptime string (e.g., "2h 15m"). */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/** Format an ISO 8601 timestamp for display. */
function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Sortable session table with status badges and health indicators.
 * Columns: Session ID, Status, Provider, Models, Started At, Uptime, Health.
 *
 * Requirements: 2.2, 2.5, 2.6
 */
export function SessionsTable({ sessions, onRowClick }: SessionsTableProps) {
  const columns = [
    "Session ID",
    "Status",
    "Provider",
    "Models",
    "Started At",
    "Uptime",
    "Health",
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sessions.map((session) => (
            <tr
              key={session.sessionId}
              onClick={() => onRowClick(session.sessionId)}
              className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
              role="link"
              tabIndex={0}
              aria-label={`View session ${session.sessionId}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(session.sessionId);
                }
              }}
            >
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                  {session.sessionId.length > 12
                    ? `${session.sessionId.slice(0, 12)}…`
                    : session.sessionId}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={session.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 capitalize">
                {session.provider}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {session.models.slice(0, 3).map((model) => (
                    <span
                      key={model}
                      className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {model}
                    </span>
                  ))}
                  {session.models.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{session.models.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                {formatTimestamp(session.createdAt)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                {formatUptime(session.uptimeSeconds)}
              </td>
              <td className="px-4 py-3">
                <HealthIndicator
                  status={session.healthStatus}
                  label="Session health"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
