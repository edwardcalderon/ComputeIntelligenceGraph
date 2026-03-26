"use client";

import React from "react";

export type ModalCardTone = "default" | "info" | "warning" | "danger";

export interface ModalCardProps {
  open: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: ModalCardTone;
  dismissLabel?: string;
  onDismiss: () => void;
}

const TONE_STYLES: Record<
  ModalCardTone,
  {
    panel: string;
    backdrop: string;
    icon: string;
    iconText: string;
    title: string;
    description: string;
  }
> = {
  default: {
    panel:
      "border-slate-200/80 bg-white/95 shadow-[0_28px_70px_rgba(15,23,42,0.16)] dark:border-zinc-700/70 dark:bg-zinc-950/95 dark:shadow-black/55",
    backdrop: "bg-black/55 backdrop-blur-md",
    icon: "bg-slate-500/10 ring-slate-500/15",
    iconText: "text-slate-600 dark:text-slate-200",
    title: "text-slate-900 dark:text-zinc-50",
    description: "text-slate-600 dark:text-zinc-400",
  },
  info: {
    panel:
      "border-cyan-500/20 bg-white/95 shadow-[0_28px_70px_rgba(8,145,178,0.16)] dark:border-cyan-400/20 dark:bg-zinc-950/95 dark:shadow-black/55",
    backdrop: "bg-black/55 backdrop-blur-md",
    icon: "bg-cyan-500/10 ring-cyan-500/20",
    iconText: "text-cyan-600 dark:text-cyan-300",
    title: "text-slate-900 dark:text-zinc-50",
    description: "text-slate-600 dark:text-zinc-400",
  },
  warning: {
    panel:
      "border-amber-500/20 bg-white/95 shadow-[0_28px_70px_rgba(217,119,6,0.16)] dark:border-amber-400/20 dark:bg-zinc-950/95 dark:shadow-black/55",
    backdrop: "bg-black/55 backdrop-blur-md",
    icon: "bg-amber-500/10 ring-amber-500/20",
    iconText: "text-amber-600 dark:text-amber-300",
    title: "text-slate-900 dark:text-zinc-50",
    description: "text-slate-600 dark:text-zinc-400",
  },
  danger: {
    panel:
      "border-rose-500/20 bg-white/95 shadow-[0_28px_70px_rgba(225,29,72,0.18)] dark:border-rose-400/20 dark:bg-zinc-950/95 dark:shadow-black/55",
    backdrop: "bg-black/60 backdrop-blur-md",
    icon: "bg-rose-500/10 ring-rose-500/20",
    iconText: "text-rose-600 dark:text-rose-300",
    title: "text-slate-900 dark:text-zinc-50",
    description: "text-slate-600 dark:text-zinc-400",
  },
};

export function ModalCard({
  open,
  title,
  description,
  icon,
  children,
  footer,
  tone = "default",
  dismissLabel = "Close dialog",
  onDismiss,
}: ModalCardProps) {
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const headingId = React.useId();
  const styles = TONE_STYLES[tone];

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={(event) => {
        if (event.target === backdropRef.current) {
          onDismiss();
        }
      }}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${styles.backdrop}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`relative w-full max-w-md overflow-hidden rounded-3xl border ${styles.panel}`}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-white/18 via-transparent to-violet-500/8 dark:from-white/8"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start gap-4">
            {icon ? (
              <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles.icon}`}>
                <div className={styles.iconText}>{icon}</div>
              </div>
            ) : null}

            <div className="min-w-0 flex-1 pr-8">
              <h2 id={headingId} className={`text-lg font-semibold tracking-tight ${styles.title}`}>
                {title}
              </h2>
              {description ? (
                <p className={`mt-1 text-sm leading-6 ${styles.description}`}>{description}</p>
              ) : null}
            </div>
          </div>

          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
