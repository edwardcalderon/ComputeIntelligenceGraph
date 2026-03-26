"use client";

import type { ReactNode } from "react";
import { ModalCard, type ModalCardTone } from "./ModalCard";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  children?: ReactNode;
  icon?: ReactNode;
  tone?: ModalCardTone;
  confirmTone?: "primary" | "danger";
  dismissLabel?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onDismiss,
  children,
  icon,
  tone = "warning",
  confirmTone = "danger",
  dismissLabel,
}: ConfirmDialogProps) {
  const confirmButtonClass =
    confirmTone === "danger"
      ? "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-950/20 transition-transform hover:scale-[1.01] hover:from-rose-500 hover:to-red-500"
      : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-950/20 transition-transform hover:scale-[1.01] hover:from-cyan-500 hover:to-blue-500";

  return (
    <ModalCard
      open={open}
      title={title}
      description={description}
      tone={tone}
      dismissLabel={dismissLabel ?? cancelLabel}
      onDismiss={onDismiss}
      icon={
        icon ?? (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L14.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        )
      }
      children={children}
      footer={
        <>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
