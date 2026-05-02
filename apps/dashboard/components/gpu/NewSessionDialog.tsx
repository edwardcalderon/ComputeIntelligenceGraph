"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createGpuSession } from "../../lib/gpuApi";
import type { GpuSessionCreateRequest } from "../../types/gpu";

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Dialog form for creating a new GPU session.
 *
 * Fields: provider type dropdown (colab/local), model names (comma-separated),
 * and optional config overrides (JSON key-value pairs).
 *
 * Submits via `POST /api/v1/gpu/sessions` using the `createGpuSession` API function.
 * Shows a loading spinner while the request is in flight.
 *
 * Requirements: 10.1 (new session dialog), 10.2 (submit + loading indicator)
 */
export function NewSessionDialog({
  open,
  onClose,
  onSuccess,
}: NewSessionDialogProps) {
  const [provider, setProvider] = useState<"colab" | "local">("colab");
  const [modelNames, setModelNames] = useState("");
  const [configOverrides, setConfigOverrides] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Focus the first input when the dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setProvider("colab");
      setModelNames("");
      setConfigOverrides("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // Handle Escape key and focus trapping
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isSubmitting, onClose]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate model names
    const trimmedModels = modelNames
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    if (trimmedModels.length === 0) {
      setError("Please enter at least one model name.");
      return;
    }

    // Parse optional config overrides
    let parsedOverrides: Record<string, string> | undefined;
    if (configOverrides.trim()) {
      try {
        const parsed = JSON.parse(configOverrides.trim());
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setError("Config overrides must be a JSON object (e.g., {\"key\": \"value\"}).");
          return;
        }
        parsedOverrides = parsed as Record<string, string>;
      } catch {
        setError("Invalid JSON in config overrides. Please enter valid JSON.");
        return;
      }
    }

    const payload: GpuSessionCreateRequest = {
      provider,
      modelNames: trimmedModels,
      ...(parsedOverrides ? { configOverrides: parsedOverrides } : {}),
    };

    setIsSubmitting(true);

    try {
      await createGpuSession(payload);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create session. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden={!open}
    >
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-session-dialog-title"
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-lg rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-xl"
      >
        {/* Title */}
        <h2
          id="new-session-dialog-title"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          New GPU Session
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure and start a new GPU compute session.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Provider type */}
          <div>
            <label
              htmlFor="new-session-provider"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Provider
            </label>
            <select
              ref={firstInputRef}
              id="new-session-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as "colab" | "local")}
              disabled={isSubmitting}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="colab">Colab</option>
              <option value="local">Local</option>
            </select>
          </div>

          {/* Model names */}
          <div>
            <label
              htmlFor="new-session-models"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Model Names
            </label>
            <input
              id="new-session-models"
              type="text"
              value={modelNames}
              onChange={(e) => setModelNames(e.target.value)}
              disabled={isSubmitting}
              placeholder="llama3, mistral"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Comma-separated list of model names to load.
            </p>
          </div>

          {/* Config overrides */}
          <div>
            <label
              htmlFor="new-session-config"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Config Overrides{" "}
              <span className="font-normal text-gray-400 dark:text-gray-500">
                (optional)
              </span>
            </label>
            <textarea
              id="new-session-config"
              value={configOverrides}
              onChange={(e) => setConfigOverrides(e.target.value)}
              disabled={isSubmitting}
              placeholder='{"key": "value"}'
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              JSON object with key-value pairs to override default config.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-400"
            >
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && (
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
              )}
              {isSubmitting ? "Creating…" : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
