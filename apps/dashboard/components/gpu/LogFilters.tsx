"use client";

import { useCallback } from "react";
import type { GpuLogLevel } from "../../types/gpu";
import type { LogFilterCriteria } from "../../lib/gpuUtils";

/** All log levels in severity order. */
const LOG_LEVELS: GpuLogLevel[] = ["debug", "info", "warn", "error"];

/** Tailwind classes for each log level checkbox label. */
const LEVEL_LABEL_COLORS: Record<GpuLogLevel, string> = {
  debug: "text-gray-600 dark:text-gray-400",
  info: "text-blue-600 dark:text-blue-400",
  warn: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
};

interface LogFiltersProps {
  /** Current filter state. */
  filters: LogFilterCriteria;
  /** Called whenever any filter value changes. */
  onChange: (filters: LogFilterCriteria) => void;
  /** Optional list of component names for the dropdown. */
  availableComponents?: string[];
  /** Optional list of session IDs for reference (not used as dropdown, kept as text input per design). */
  availableSessionIds?: string[];
}

/**
 * Filter controls for the GPU Logs Viewer.
 *
 * Renders: log level multi-select checkboxes, component name dropdown,
 * session ID text input, and text search input.
 */
export function LogFilters({
  filters,
  onChange,
  availableComponents = [],
  availableSessionIds: _availableSessionIds = [],
}: LogFiltersProps) {
  const handleLevelToggle = useCallback(
    (level: GpuLogLevel, checked: boolean) => {
      const next = new Set(filters.levels);
      if (checked) {
        next.add(level);
      } else {
        next.delete(level);
      }
      onChange({ ...filters, levels: next });
    },
    [filters, onChange],
  );

  const handleComponentChange = useCallback(
    (value: string) => {
      onChange({ ...filters, component: value || undefined });
    },
    [filters, onChange],
  );

  const handleSessionIdChange = useCallback(
    (value: string) => {
      onChange({ ...filters, sessionId: value || undefined });
    },
    [filters, onChange],
  );

  const handleSearchTextChange = useCallback(
    (value: string) => {
      onChange({ ...filters, searchText: value || undefined });
    },
    [filters, onChange],
  );

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Log level multi-select */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
          Log Level
        </legend>
        <div className="flex flex-wrap gap-3">
          {LOG_LEVELS.map((level) => {
            const checked = filters.levels?.has(level) ?? false;
            return (
              <label
                key={level}
                className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium ${LEVEL_LABEL_COLORS[level]}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => handleLevelToggle(level, e.target.checked)}
                  className="size-3.5 rounded border-gray-300 dark:border-gray-600"
                  aria-label={`Filter by ${level} level`}
                />
                <span className="capitalize">{level}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Component name dropdown */}
      <div className="flex flex-col">
        <label
          htmlFor="log-filter-component"
          className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Component
        </label>
        <select
          id="log-filter-component"
          value={filters.component ?? ""}
          onChange={(e) => handleComponentChange(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">All components</option>
          {availableComponents.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Session ID text input */}
      <div className="flex flex-col">
        <label
          htmlFor="log-filter-session"
          className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Session ID
        </label>
        <input
          id="log-filter-session"
          type="text"
          value={filters.sessionId ?? ""}
          onChange={(e) => handleSessionIdChange(e.target.value)}
          placeholder="Filter by session ID"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
        />
      </div>

      {/* Text search input */}
      <div className="flex flex-col">
        <label
          htmlFor="log-filter-search"
          className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Search
        </label>
        <input
          id="log-filter-search"
          type="text"
          value={filters.searchText ?? ""}
          onChange={(e) => handleSearchTextChange(e.target.value)}
          placeholder="Search log messages"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
        />
      </div>
    </div>
  );
}
