"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TimelineEvent } from "../../../../components/gpu/TimelineEvent";
import { EventTypeFilter } from "../../../../components/gpu/EventTypeFilter";
import { ErrorState } from "../../../../components/gpu/ErrorState";
import { EmptyState } from "../../../../components/gpu/EmptyState";
import { SkeletonLoader } from "../../../../components/gpu/SkeletonLoader";
import { getGpuActivity } from "../../../../lib/gpuApi";
import {
  gpuKeys,
  sortReverseChronological,
} from "../../../../lib/gpuUtils";
import type { GpuActivityEventType } from "../../../../types/gpu";

const PAGE_SIZE = 30;

/**
 * GPU Activity Timeline page at `/gpu/activity`.
 *
 * Displays a vertical timeline of orchestrator events in reverse
 * chronological order. Supports filtering by event type via
 * `EventTypeFilter` and server-side pagination (30 per page).
 * Polls every 30 seconds on the first page.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 12.1, 12.2, 12.3
 */
export default function GpuActivityPage() {
  const [selectedTypes, setSelectedTypes] = useState<Set<GpuActivityEventType>>(
    new Set(),
  );
  const [offset, setOffset] = useState(0);

  // Build query params from selected event types and pagination
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    if (selectedTypes.size > 0) {
      params.set("eventType", Array.from(selectedTypes).join(","));
    }

    return params.toString();
  }, [selectedTypes, offset]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...gpuKeys.activity, queryParams],
    queryFn: () => getGpuActivity(queryParams),
    // Poll every 30s only on the first page
    refetchInterval: offset === 0 ? 30_000 : false,
  });

  // Sort events in reverse chronological order
  const displayedEvents = useMemo(() => {
    if (!data?.items) return [];
    return sortReverseChronological(data.items);
  }, [data?.items]);

  // Reset to first page when filter changes
  const handleFilterChange = (types: Set<GpuActivityEventType>) => {
    setOffset(0);
    setSelectedTypes(types);
  };

  const isFirstPage = offset === 0;
  const hasNextPage = data ? offset + PAGE_SIZE < data.total : false;

  // Loading state (Req 12.1)
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Activity Timeline
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Loading activity events…
          </p>
        </div>
        <SkeletonLoader variant="list" rows={8} />
      </div>
    );
  }

  // Error state (Req 12.2)
  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Activity Timeline
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Chronological feed of GPU orchestrator events.
          </p>
        </div>
        <ErrorState
          message="Failed to load activity events. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Activity Timeline
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Chronological feed of GPU orchestrator events.
          {data && ` Showing ${displayedEvents.length} of ${data.total} events.`}
        </p>
      </div>

      {/* Event type filter (Req 7.7) */}
      <EventTypeFilter
        selectedTypes={selectedTypes}
        onChange={handleFilterChange}
      />

      {/* Timeline events (Req 7.1, 7.2, 7.3, 7.5, 7.6) */}
      {displayedEvents.length === 0 ? (
        <EmptyState
          message="No activity events match the current filters."
          description="Try adjusting the filters above or check back later for new events."
        />
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {displayedEvents.map((event) => (
            <TimelineEvent key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination controls (Req 7.4) */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Page {Math.floor(offset / PAGE_SIZE) + 1} of{" "}
            {Math.ceil(data.total / PAGE_SIZE)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              disabled={isFirstPage}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              disabled={!hasNextPage}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
