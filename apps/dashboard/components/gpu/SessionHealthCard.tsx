"use client";

import type { GpuSessionHealth } from "../../types/gpu";
import { HealthIndicator } from "./HealthIndicator";

interface SessionHealthCardProps {
  session: GpuSessionHealth;
}

/**
 * Renders a card for a single session's health status.
 *
 * Displays the session ID, overall health via HealthIndicator,
 * individual dimension results (session + worker heartbeat),
 * last check timestamp, and recovery state when present.
 *
 * Applies a red border pulse animation when the session is unhealthy.
 */
export function SessionHealthCard({ session }: SessionHealthCardProps) {
  const isUnhealthy = session.healthStatus === "unhealthy";

  const formattedTimestamp = session.lastCheckTimestamp
    ? new Date(session.lastCheckTimestamp).toLocaleString()
    : "—";

  const sessionCheck = session.healthCheck?.checks.session ?? null;
  const heartbeatCheck = session.healthCheck?.checks.workerHeartbeat ?? null;

  return (
    <div
      className={`rounded-lg border bg-white dark:bg-gray-800 p-4 space-y-3 ${
        isUnhealthy
          ? "animate-pulse border-red-500"
          : "border-gray-200 dark:border-gray-700"
      }`}
      data-testid="session-health-card"
    >
      {/* Header: session ID + overall health */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 truncate">
          {session.sessionId}
        </span>
        <HealthIndicator status={session.healthStatus} label="Overall health" />
      </div>

      {/* Dimension results */}
      <div className="space-y-2">
        {/* Session dimension */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">Session</span>
          {sessionCheck ? (
            <span className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  sessionCheck.healthy ? "bg-green-500" : "bg-red-500"
                }`}
                aria-hidden="true"
              />
              <span
                className={
                  sessionCheck.healthy
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                }
              >
                {sessionCheck.healthy ? "Healthy" : "Unhealthy"}
              </span>
              <span className="text-gray-500 dark:text-gray-400 font-mono">
                {sessionCheck.latencyMs}ms
              </span>
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>

        {/* Worker heartbeat dimension */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            Worker Heartbeat
          </span>
          {heartbeatCheck ? (
            <span className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  heartbeatCheck.healthy ? "bg-green-500" : "bg-red-500"
                }`}
                aria-hidden="true"
              />
              <span
                className={
                  heartbeatCheck.healthy
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                }
              >
                {heartbeatCheck.healthy ? "Healthy" : "Unhealthy"}
              </span>
              <span className="text-gray-500 dark:text-gray-400 font-mono">
                {heartbeatCheck.latencyMs}ms
              </span>
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>
      </div>

      {/* Last check timestamp */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">Last Check</span>
        <span className="text-gray-500 dark:text-gray-400 font-mono">
          {formattedTimestamp}
        </span>
      </div>

      {/* Recovery state (shown only when present) */}
      {session.recoveryState && (
        <div className="rounded-md border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-3 space-y-1">
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">
            Recovery Active
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-yellow-700 dark:text-yellow-400">Action</span>
            <span className="font-mono text-yellow-900 dark:text-yellow-200">
              {session.recoveryState.actionType.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-yellow-700 dark:text-yellow-400">
              Consecutive Failures
            </span>
            <span className="font-mono text-yellow-900 dark:text-yellow-200">
              {session.recoveryState.consecutiveFailures}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-yellow-700 dark:text-yellow-400">
              Next Retry
            </span>
            <span className="font-mono text-yellow-900 dark:text-yellow-200">
              {new Date(session.recoveryState.nextRetryAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
