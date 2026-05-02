"use client";

import { Inbox } from "lucide-react";

interface EmptyStateProps {
  message: string;
  description?: string;
}

/**
 * Contextual empty state with an icon, message, and optional description.
 * Uses a gray/muted color scheme.
 */
export function EmptyState({ message, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-6 py-12 dark:border-gray-700 dark:bg-gray-800/50">
      <Inbox
        className="size-10 text-gray-400 dark:text-gray-500"
        aria-hidden="true"
      />
      <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-300">
        {message}
      </p>
      {description && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
}
