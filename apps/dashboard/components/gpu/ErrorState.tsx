"use client";

import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/**
 * Inline error message with a "Retry" button.
 * Uses a red color scheme for the error indicator.
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 px-6 py-12 dark:border-red-900 dark:bg-red-950/30"
      role="alert"
    >
      <AlertCircle
        className="size-10 text-red-500 dark:text-red-400"
        aria-hidden="true"
      />
      <p className="text-center text-sm text-red-700 dark:text-red-300">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600 dark:focus:ring-offset-gray-900"
      >
        Retry
      </button>
    </div>
  );
}
