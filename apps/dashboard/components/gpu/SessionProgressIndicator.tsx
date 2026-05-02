"use client";

import type { GpuSetupPhase } from "../../types/gpu";

interface SessionProgressIndicatorProps {
  currentPhase: GpuSetupPhase;
}

/** Ordered list of setup phases for session creation. */
const SETUP_PHASES: GpuSetupPhase[] = [
  "uploading_notebook",
  "connecting_runtime",
  "installing_ollama",
  "pulling_models",
  "starting_worker",
];

/** Human-readable labels for each setup phase. */
const PHASE_LABELS: Record<GpuSetupPhase, string> = {
  uploading_notebook: "Uploading Notebook",
  connecting_runtime: "Connecting Runtime",
  installing_ollama: "Installing Ollama",
  pulling_models: "Pulling Models",
  starting_worker: "Starting Worker",
};

type PhaseState = "complete" | "current" | "pending";

function getPhaseState(
  phase: GpuSetupPhase,
  currentPhase: GpuSetupPhase
): PhaseState {
  const currentIndex = SETUP_PHASES.indexOf(currentPhase);
  const phaseIndex = SETUP_PHASES.indexOf(phase);

  if (phaseIndex < currentIndex) return "complete";
  if (phaseIndex === currentIndex) return "current";
  return "pending";
}

/** Checkmark icon for completed phases. */
function CheckIcon() {
  return (
    <svg
      className="size-4 text-green-600 dark:text-green-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Animated spinner for the current phase. */
function SpinnerIcon() {
  return (
    <svg
      className="size-4 animate-spin text-yellow-600 dark:text-yellow-400"
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

/** Empty circle for pending phases. */
function PendingIcon() {
  return (
    <span
      className="block size-4 rounded-full border-2 border-gray-300 dark:border-gray-600"
      aria-hidden="true"
    />
  );
}

/**
 * Displays setup phase progress for sessions in `creating` status.
 * Shows all 5 phases with visual indicators: checkmarks for completed,
 * a spinner for the current phase, and empty circles for pending phases.
 */
export function SessionProgressIndicator({
  currentPhase,
}: SessionProgressIndicatorProps) {
  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-label="Session setup progress"
    >
      {SETUP_PHASES.map((phase) => {
        const state = getPhaseState(phase, currentPhase);
        const label = PHASE_LABELS[phase];

        return (
          <div key={phase} className="flex items-center gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center">
              {state === "complete" && <CheckIcon />}
              {state === "current" && <SpinnerIcon />}
              {state === "pending" && <PendingIcon />}
            </div>
            <span
              className={`text-sm ${
                state === "complete"
                  ? "text-green-700 dark:text-green-400"
                  : state === "current"
                    ? "font-medium text-yellow-700 dark:text-yellow-400"
                    : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
