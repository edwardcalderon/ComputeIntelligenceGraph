"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { StatCard } from "../../../../components/StatCard";
import { SessionHealthCard } from "../../../../components/gpu/SessionHealthCard";
import { ErrorState } from "../../../../components/gpu/ErrorState";
import { SkeletonLoader } from "../../../../components/gpu/SkeletonLoader";
import { getGpuHealth } from "../../../../lib/gpuApi";
import { gpuKeys } from "../../../../lib/gpuUtils";

/** Format seconds into a human-readable age string. */
function formatHeartbeatAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * GPU Health Dashboard page at `/gpu/health`.
 *
 * Displays aggregate health metrics via StatCards and a per-session
 * health card grid. Polls the health endpoint every 15 seconds.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 12.1, 12.2
 */
export default function GpuHealthPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: gpuKeys.health,
    queryFn: () => getGpuHealth(),
    refetchInterval: 15_000,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Health Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Loading health data…
          </p>
        </div>
        {/* Stat card skeletons */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCard key={i} label="" value="" loading />
          ))}
        </div>
        <SkeletonLoader variant="cards" rows={3} />
      </div>
    );
  }

  // Error state — warning banner for unreachable health endpoint
  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Health Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time health overview of all GPU sessions.
          </p>
        </div>
        {/* Yellow warning banner for unreachable health endpoint (Req 4.7) */}
        <div
          className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-600 dark:bg-yellow-900/20"
          role="alert"
        >
          <AlertTriangle
            className="size-5 shrink-0 text-yellow-600 dark:text-yellow-400"
            aria-hidden="true"
          />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Health data is currently unavailable. The health endpoint may be
            unreachable.
          </p>
        </div>
        <ErrorState
          message="Failed to load health data. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const summary = data!;
  const totalSessions =
    summary.totalHealthy + summary.totalUnhealthy + summary.totalNoData;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Health Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Real-time health overview of {totalSessions} GPU session
          {totalSessions !== 1 ? "s" : ""}.
        </p>
      </div>

      {/* Summary stat cards — responsive grid (Req 4.1) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Healthy"
          value={summary.totalHealthy}
          color="#16a34a"
        />
        <StatCard
          label="Unhealthy"
          value={summary.totalUnhealthy}
          color={summary.totalUnhealthy > 0 ? "#dc2626" : "#6b7280"}
        />
        <StatCard
          label="No Data"
          value={summary.totalNoData}
          color="#6b7280"
        />
        <StatCard
          label="Oldest Heartbeat"
          value={
            summary.oldestHeartbeatAgeSeconds != null
              ? formatHeartbeatAge(summary.oldestHeartbeatAgeSeconds)
              : "—"
          }
          color="#f59e0b"
        />
      </div>

      {/* Per-session health cards — responsive grid (Req 4.2) */}
      {summary.sessions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No active sessions to display health data for.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {summary.sessions.map((session) => (
            <SessionHealthCard key={session.sessionId} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
