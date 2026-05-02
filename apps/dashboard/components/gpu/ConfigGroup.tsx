"use client";

import type { GpuConfigEntry } from "../../types/gpu";

interface ConfigGroupProps {
  title: string;
  entries: GpuConfigEntry[];
}

/**
 * Renders a grouped key-value list of configuration entries.
 *
 * Each entry displays its key on the left and value on the right.
 * Redacted values are shown as `***` with a muted/italic style.
 * Non-redacted values are shown in monospace font.
 */
export function ConfigGroup({ title, entries }: ConfigGroupProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Group header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      </div>

      {/* Key-value entries */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className="flex items-center justify-between gap-4 px-4 py-2.5"
          >
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {entry.key}
            </span>
            {entry.redacted ? (
              <span className="text-sm italic text-gray-400 dark:text-gray-500">
                ***
              </span>
            ) : (
              <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                {entry.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
