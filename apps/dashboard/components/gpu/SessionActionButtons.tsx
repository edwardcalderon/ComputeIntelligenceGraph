"use client";

interface SessionActionButtonsProps {
  onStop: () => void;
  onRestart: () => void;
  isStopLoading: boolean;
  isRestartLoading: boolean;
}

/**
 * Action buttons for session management: "Stop Session" and "Restart Worker".
 *
 * Shows a loading spinner on the active button and disables both buttons
 * while any request is in flight to prevent duplicate submissions.
 *
 * Requirements: 3.5 (action buttons), 10.5 (disable while in flight), 12.5 (loading spinner)
 */
export function SessionActionButtons({
  onStop,
  onRestart,
  isStopLoading,
  isRestartLoading,
}: SessionActionButtonsProps) {
  const isAnyLoading = isStopLoading || isRestartLoading;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onStop}
        disabled={isAnyLoading}
        aria-busy={isStopLoading}
        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isStopLoading && <LoadingSpinner />}
        Stop Session
      </button>

      <button
        type="button"
        onClick={onRestart}
        disabled={isAnyLoading}
        aria-busy={isRestartLoading}
        className="inline-flex items-center gap-2 rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isRestartLoading && <LoadingSpinner />}
        Restart Worker
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="size-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
