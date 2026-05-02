"use client";

import type { GpuSessionStatus } from "../../types/gpu";

const ALL_STATUSES: GpuSessionStatus[] = [
  "running",
  "connected",
  "creating",
  "disconnected",
  "error",
  "terminated",
];

interface StatusFilterProps {
  value: GpuSessionStatus | "";
  onChange: (status: GpuSessionStatus | "") => void;
}

/** Capitalize the first letter of a string for display. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Dropdown filter for filtering GPU sessions by status.
 * Shows "All Statuses" as the default option plus each GpuSessionStatus value.
 *
 * Requirements: 2.7
 */
export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <select
      aria-label="Filter sessions by status"
      value={value}
      onChange={(e) => onChange(e.target.value as GpuSessionStatus | "")}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
    >
      <option value="">All Statuses</option>
      {ALL_STATUSES.map((status) => (
        <option key={status} value={status}>
          {capitalize(status)}
        </option>
      ))}
    </select>
  );
}
