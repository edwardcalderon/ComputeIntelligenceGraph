"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGpuSession, deleteGpuSession, restartGpuWorker } from "../../../../../lib/gpuApi";
import { gpuKeys } from "../../../../../lib/gpuUtils";
import { StatusBadge } from "../../../../../components/gpu/StatusBadge";
import { HealthCheckDisplay } from "../../../../../components/gpu/HealthCheckDisplay";
import { SessionLogSection } from "../../../../../components/gpu/SessionLogSection";
import { SessionActionButtons } from "../../../../../components/gpu/SessionActionButtons";
import { SessionProgressIndicator } from "../../../../../components/gpu/SessionProgressIndicator";
import { ConfirmDialog } from "../../../../../components/gpu/ConfirmDialog";
import { ErrorState } from "../../../../../components/gpu/ErrorState";
import { SkeletonLoader } from "../../../../../components/gpu/SkeletonLoader";

/**
 * Session Detail page at `/gpu/sessions/[sessionId]`.
 *
 * Displays full session metadata, health check dimensions, action buttons,
 * progress indicator (when creating), and recent logs.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9,
 *               10.3, 10.4, 10.5, 10.6, 12.1, 12.2, 12.5
 */
export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);

  // Fetch session detail, polling every 15s
  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: gpuKeys.session(sessionId),
    queryFn: () => getGpuSession(sessionId),
    refetchInterval: 15_000,
    enabled: !!sessionId,
  });

  // Stop session mutation
  const stopMutation = useMutation({
    mutationFn: () => deleteGpuSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gpuKeys.sessions });
      queryClient.invalidateQueries({ queryKey: gpuKeys.health });
      queryClient.invalidateQueries({ queryKey: gpuKeys.activity });
      setIsStopDialogOpen(false);
      router.push("/gpu");
    },
  });

  // Restart worker mutation
  const restartMutation = useMutation({
    mutationFn: () => restartGpuWorker(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gpuKeys.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: gpuKeys.health });
      queryClient.invalidateQueries({ queryKey: gpuKeys.activity });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          href="/gpu"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          ← Back to Sessions
        </Link>
        <SkeletonLoader variant="cards" rows={3} />
      </div>
    );
  }

  // 404 / not found state
  const is404 =
    isError &&
    error instanceof Error &&
    (error.message.includes("404") || error.message.includes("not found"));

  if (is404) {
    return (
      <div className="space-y-6">
        <Link
          href="/gpu"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          ← Back to Sessions
        </Link>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Session not found.
          </p>
          <Link
            href="/gpu"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Return to Sessions Overview
          </Link>
        </div>
      </div>
    );
  }

  // Generic error state
  if (isError) {
    return (
      <div className="space-y-6">
        <Link
          href="/gpu"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          ← Back to Sessions
        </Link>
        <ErrorState
          message="Failed to load session details. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/gpu"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        ← Back to Sessions
      </Link>

      {/* Header with session ID, status, and action buttons */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Session Detail
              </h1>
              <StatusBadge status={session.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-gray-400">
              {session.sessionId}
            </p>
          </div>

          <SessionActionButtons
            onStop={() => setIsStopDialogOpen(true)}
            onRestart={() => restartMutation.mutate()}
            isStopLoading={stopMutation.isPending}
            isRestartLoading={restartMutation.isPending}
          />
        </div>
      </div>

      {/* Session progress indicator when creating */}
      {session.status === "creating" && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <h3 className="mb-3 text-sm font-semibold text-yellow-800 dark:text-yellow-300">
            Session Setup in Progress
          </h3>
          <SessionProgressIndicator currentPhase="uploading_notebook" />
        </div>
      )}

      {/* Session metadata */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Session Metadata
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Session ID
            </dt>
            <dd className="mt-0.5 break-all font-mono text-sm text-gray-900 dark:text-gray-100">
              {session.sessionId}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Status
            </dt>
            <dd className="mt-0.5">
              <StatusBadge status={session.status} />
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Provider
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
              {session.provider}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Models
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
              {session.models.length > 0
                ? session.models.join(", ")
                : "—"}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Created At
            </dt>
            <dd className="mt-0.5 text-sm font-mono text-gray-900 dark:text-gray-100">
              {new Date(session.createdAt).toLocaleString()}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Last Verified
            </dt>
            <dd className="mt-0.5 text-sm font-mono text-gray-900 dark:text-gray-100">
              {new Date(session.lastVerifiedAt).toLocaleString()}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              TTL Expiry
            </dt>
            <dd className="mt-0.5 text-sm font-mono text-gray-900 dark:text-gray-100">
              {new Date(session.ttlExpiry).toLocaleString()}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Uptime
            </dt>
            <dd className="mt-0.5 text-sm font-mono text-gray-900 dark:text-gray-100">
              {formatUptime(session.uptimeSeconds)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Health check display */}
      <HealthCheckDisplay healthCheck={session.healthCheck} />

      {/* Recovery state (if present) */}
      {session.recoveryState && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">
            Recovery State
          </h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-xs font-medium text-red-600 dark:text-red-400">
                Action
              </dt>
              <dd className="mt-0.5 text-sm text-red-800 dark:text-red-200">
                {session.recoveryState.actionType.replace(/_/g, " ")}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs font-medium text-red-600 dark:text-red-400">
                Consecutive Failures
              </dt>
              <dd className="mt-0.5 text-sm font-mono text-red-800 dark:text-red-200">
                {session.recoveryState.consecutiveFailures}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs font-medium text-red-600 dark:text-red-400">
                Next Retry
              </dt>
              <dd className="mt-0.5 text-sm font-mono text-red-800 dark:text-red-200">
                {new Date(session.recoveryState.nextRetryAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Recent logs section */}
      <SessionLogSection
        logs={session.recentLogs}
        sessionId={session.sessionId}
      />

      {/* Stop session confirmation dialog */}
      <ConfirmDialog
        open={isStopDialogOpen}
        title="Stop Session"
        message={`Are you sure you want to stop session ${session.sessionId}? This action will destroy the session and cannot be undone.`}
        confirmLabel="Stop Session"
        cancelLabel="Cancel"
        onConfirm={() => stopMutation.mutate()}
        onCancel={() => setIsStopDialogOpen(false)}
        isLoading={stopMutation.isPending}
      />
    </div>
  );
}

/** Format seconds into a human-readable uptime string. */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
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
