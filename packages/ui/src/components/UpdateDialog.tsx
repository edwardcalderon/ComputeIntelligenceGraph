"use client";

import { ModalCard } from "./ModalCard";

export interface UpdateDialogProps {
  open: boolean;
  title: string;
  description: string;
  currentLabel: string;
  latestLabel: string;
  currentVersion: string;
  latestVersion: string;
  reloadLabel: string;
  laterLabel: string;
  onReload: () => void;
  onDismiss: () => void;
}

export function UpdateDialog({
  open,
  title,
  description,
  currentLabel,
  latestLabel,
  currentVersion,
  latestVersion,
  reloadLabel,
  laterLabel,
  onReload,
  onDismiss,
}: UpdateDialogProps) {
  return (
    <ModalCard
      open={open}
      title={title}
      description={description}
      tone="info"
      onDismiss={onDismiss}
      icon={
        <svg
          viewBox="0 0 24 24"
          className="size-6 text-cyan-500 dark:text-cyan-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      }
      children={
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm text-zinc-700 shadow-inner dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-300">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-500">
              {currentLabel}
            </span>
            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {currentVersion || "unknown"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-500">
              {latestLabel}
            </span>
            <span className="truncate font-medium text-cyan-700 dark:text-cyan-300">
              {latestVersion || "unknown"}
            </span>
          </div>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {laterLabel}
          </button>
          <button
            type="button"
            onClick={onReload}
            className="rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition-transform hover:scale-[1.01] hover:from-cyan-500 hover:to-blue-500"
          >
            {reloadLabel}
          </button>
        </>
      }
    />
  );
}
