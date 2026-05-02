"use client";

interface SkeletonLoaderProps {
  rows?: number;
  variant?: "table" | "cards" | "list";
}

/** A single animated skeleton block. */
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
    />
  );
}

/** Skeleton row matching a table layout with multiple columns. */
function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-4 w-16" />
      <SkeletonBlock className="h-4 w-14" />
      <SkeletonBlock className="h-4 w-32 flex-1" />
      <SkeletonBlock className="h-4 w-20" />
      <SkeletonBlock className="h-4 w-16" />
      <SkeletonBlock className="h-4 w-12" />
    </div>
  );
}

/** Skeleton card matching a card grid layout. */
function CardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-4 w-16" />
      </div>
      <div className="mt-3 space-y-2">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-3/4" />
      </div>
      <div className="mt-4 flex gap-2">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
    </div>
  );
}

/** Skeleton row matching a simple list layout. */
function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
      <SkeletonBlock className="size-2 rounded-full" />
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="h-4 flex-1" />
    </div>
  );
}

/**
 * Skeleton loading placeholders matching expected content shapes.
 * Supports table, cards, and list variants with configurable row count.
 */
export function SkeletonLoader({
  rows = 5,
  variant = "table",
}: SkeletonLoaderProps) {
  const items = Array.from({ length: rows }, (_, i) => i);

  if (variant === "cards") {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="status"
        aria-label="Loading content"
      >
        {items.map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div
        className="rounded-lg border border-gray-200 dark:border-gray-700"
        role="status"
        aria-label="Loading content"
      >
        {items.map((i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Default: table variant
  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700"
      role="status"
      aria-label="Loading content"
    >
      {/* Table header skeleton */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-3 w-14" />
        <SkeletonBlock className="h-3 w-32 flex-1" />
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
      {/* Table body skeleton rows */}
      {items.map((i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  );
}
