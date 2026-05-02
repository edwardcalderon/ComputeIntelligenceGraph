"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "../../../components/StatCard";
import { SessionsTable } from "../../../components/gpu/SessionsTable";
import { StatusFilter } from "../../../components/gpu/StatusFilter";
import { NewSessionDialog } from "../../../components/gpu/NewSessionDialog";
import { ErrorState } from "../../../components/gpu/ErrorState";
import { EmptyState } from "../../../components/gpu/EmptyState";
import { SkeletonLoader } from "../../../components/gpu/SkeletonLoader";
import { getGpuSessions } from "../../../lib/gpuApi";
import { gpuKeys } from "../../../lib/gpuUtils";
import type { GpuSessionStatus, GpuSession } from "../../../types/gpu";

/** Format seconds into a compact uptime string for the stat card. */
function formatAverageUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * GPU Sessions Overview page at `/gpu`.
 *
 * Displays aggregate metrics via StatCards, a filterable sessions table,
 * and a "New Session" button that opens a creation dialog.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8,
 *               10.1, 10.2, 10.3, 10.4, 10.5,
 *               11.1, 12.1, 12.2, 12.3, 12.4
 */
export default function GpuSessionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<GpuSessionStatus | "">("");
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);

  // Fetch sessions with optional status filter, polling every 30s
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...gpuKeys.sessions, statusFilter],
    queryFn: () =>
      getGpuSessions(statusFilter ? `status=${statusFilter}` : undefined),
    refetchInterval: 30_000,
  });

  const handleRowClick = (sessionId: string) => {
    router.push(`/gpu/sessions/${sessionId}`);
  };

  const handleNewSessionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: gpuKeys.sessions });
    queryClient.invalidateQueries({ queryKey: gpuKeys.health });
    queryClient.invalidateQueries({ queryKey: gpuKeys.activity });
  };

  // Compute aggregate metrics from session data
  const sessions: GpuSession[] = data?.items ?? [];
  const activeSessions = sessions.filter(
    (s) => s.status !== "terminated" && s.status !== "error"
  );
  const totalActive = activeSessions.length;
  const totalUnhealthy = sessions.filter(
    (s) => s.healthStatus === "unhealthy"
  ).length;
  const averageUptime =
    activeSessions.length > 0
      ? activeSessions.reduce((sum, s) => sum + s.uptimeSeconds, 0) /
        activeSessions.length
      : 0;
  const totalModels = new Set(sessions.flatMap((s) => s.models)).size;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            GPU Sessions
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Loading sessions…
          </p>
        </div>
        {/* Stat card skeletons */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCard key={i} label="" value="" loading />
          ))}
        </div>
        <SkeletonLoader variant="table" rows={5} />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            GPU Sessions
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor and manage GPU compute sessions.
          </p>
        </div>
        <ErrorState
          message="Failed to load GPU sessions. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Empty state (no sessions at all, not just filtered)
  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              GPU Sessions
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitor and manage GPU compute sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsNewSessionOpen(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            New Session
          </button>
        </div>
        <EmptyState
          message="No GPU sessions found."
          description="Start a new session to get started."
        />
        <NewSessionDialog
          open={isNewSessionOpen}
          onClose={() => setIsNewSessionOpen(false)}
          onSuccess={handleNewSessionSuccess}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            GPU Sessions
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {data.total} session{data.total !== 1 ? "s" : ""} found.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewSessionOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          New Session
        </button>
      </div>

      {/* Aggregate stat cards — responsive grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Sessions"
          value={totalActive}
          color="#16a34a"
        />
        <StatCard
          label="Unhealthy"
          value={totalUnhealthy}
          color={totalUnhealthy > 0 ? "#dc2626" : "#6b7280"}
        />
        <StatCard
          label="Avg Uptime"
          value={formatAverageUptime(averageUptime)}
          color="#2563eb"
        />
        <StatCard
          label="Total Models"
          value={totalModels}
          color="#f59e0b"
        />
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        {statusFilter && (
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Sessions table */}
      <SessionsTable sessions={sessions} onRowClick={handleRowClick} />

      {/* New Session Dialog */}
      <NewSessionDialog
        open={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onSuccess={handleNewSessionSuccess}
      />
    </div>
  );
}
