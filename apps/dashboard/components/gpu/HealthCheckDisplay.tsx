"use client";

import type { GpuHealthCheck } from "../../types/gpu";
import { HealthIndicator } from "./HealthIndicator";

interface HealthCheckDisplayProps {
  healthCheck: GpuHealthCheck | null;
}

/**
 * Displays both health check dimensions (session status + worker heartbeat)
 * for a single GPU session. Shows "No health data" when healthCheck is null.
 *
 * Requirements: 3.2, 3.3 (health dimensions display)
 */
export function HealthCheckDisplay({ healthCheck }: HealthCheckDisplayProps) {
  if (!healthCheck) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Health Check
        </h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No health data available.
        </p>
      </div>
    );
  }

  const { session, workerHeartbeat } = healthCheck.checks;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Health Check
        </h3>
        <HealthIndicator
          status={healthCheck.overall ? "healthy" : "unhealthy"}
          label="Overall"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Session Status Dimension */}
        <div className="rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Session Status
            </span>
            <HealthIndicator
              status={session.healthy ? "healthy" : "unhealthy"}
              label="Session status"
            />
          </div>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-xs text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="text-xs font-medium text-gray-900 dark:text-gray-100">
                {session.status}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-gray-500 dark:text-gray-400">Latency</dt>
              <dd className="text-xs font-mono text-gray-900 dark:text-gray-100">
                {session.latencyMs}ms
              </dd>
            </div>
          </dl>
        </div>

        {/* Worker Heartbeat Dimension */}
        <div className="rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Worker Heartbeat
            </span>
            <HealthIndicator
              status={workerHeartbeat.healthy ? "healthy" : "unhealthy"}
              label="Worker heartbeat"
            />
          </div>
          <dl className="space-y-1">
            {workerHeartbeat.lastHeartbeatAt && (
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Last Heartbeat
                </dt>
                <dd className="text-xs font-mono text-gray-900 dark:text-gray-100">
                  {new Date(workerHeartbeat.lastHeartbeatAt).toLocaleString()}
                </dd>
              </div>
            )}
            {workerHeartbeat.ageSeconds != null && (
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500 dark:text-gray-400">Age</dt>
                <dd className="text-xs font-mono text-gray-900 dark:text-gray-100">
                  {workerHeartbeat.ageSeconds}s
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-xs text-gray-500 dark:text-gray-400">Latency</dt>
              <dd className="text-xs font-mono text-gray-900 dark:text-gray-100">
                {workerHeartbeat.latencyMs}ms
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Timestamp */}
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Last checked: {new Date(healthCheck.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
