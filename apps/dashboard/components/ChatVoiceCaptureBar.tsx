"use client";

import type { ReactNode } from "react";
import { AudioLines, LoaderCircle, Mic, PencilLine, Send, Square, X } from "lucide-react";
import type { ChatTranscriptContextItem } from "../lib/api";

type VoiceStatus = "preparing" | "recording" | "transcribing";

export function ChatVoiceCaptureBar({
  status,
  mode,
  durationMs,
  error,
  onModeChange,
  onStop,
  onCancel,
  onRetry,
  onDismissError,
}: {
  status: VoiceStatus | null;
  mode: ChatTranscriptContextItem["mode"];
  durationMs: number;
  error: string | null;
  onModeChange: (mode: ChatTranscriptContextItem["mode"]) => void;
  onStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDismissError: () => void;
}) {
  const isBusy = status !== null;
  const seconds = Math.max(0, Math.round(durationMs / 1000));

  if (!isBusy && !error) {
    return null;
  }

  const title =
    status === "preparing"
      ? "Connecting microphone"
      : status === "recording"
        ? "Listening now"
        : status === "transcribing"
          ? "Transcribing voice"
          : "Voice assistant";

  const description =
    status === "preparing"
      ? "Preparing the recorder inside the chat composer."
      : status === "recording"
        ? mode === "review"
          ? "Stop to place the transcript into the composer."
          : "Stop to transcribe and send immediately."
        : status === "transcribing"
          ? "Turning your recording into text with OpenAI."
          : mode === "review"
            ? "The transcript will be written into the composer."
            : "The transcript will be sent directly after transcription.";

  const modeOptions: Array<{
    value: ChatTranscriptContextItem["mode"];
    label: string;
    icon: ReactNode;
  }> = [
    {
      value: "review",
      label: "Write to chat",
      icon: <PencilLine className="h-3.5 w-3.5" />,
    },
    {
      value: "auto-send",
      label: "Send instantly",
      icon: <Send className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-cyan-200/80 bg-cyan-50/85 p-3 dark:border-cyan-400/20 dark:bg-cyan-500/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/85 text-cyan-600 shadow-sm dark:bg-zinc-900 dark:text-cyan-300">
                {status === "transcribing" || status === "preparing" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : status === "recording" ? (
                  <AudioLines className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{title}</p>
                <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">{description}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={status === "transcribing"}
                  onClick={() => onModeChange(option.value)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    mode === option.value
                      ? "border-cyan-300/70 bg-cyan-500/12 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/12 dark:text-cyan-300"
                      : "border-slate-200/80 bg-white/80 text-slate-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400",
                  ].join(" ")}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
              {status === "recording" ? `${seconds}s` : "Voice"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {status === "recording" ? (
                <>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition-colors hover:bg-slate-50 dark:border-zinc-700/70 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    aria-label="Cancel voice capture"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onStop}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-white transition-colors hover:bg-cyan-500"
                    aria-label={mode === "review" ? "Stop and write" : "Stop and send"}
                  >
                    <Square className="h-4 w-4" />
                  </button>
                </>
              ) : status === "preparing" ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition-colors hover:bg-slate-50 dark:border-zinc-700/70 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  aria-label="Cancel voice capture"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200/80 bg-red-50/80 p-3 dark:border-red-500/20 dark:bg-red-500/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Voice transcription failed</p>
              <p className="mt-1 text-xs leading-5 text-red-600 dark:text-red-200/80">{error}</p>
            </div>
            <button
              type="button"
              onClick={onDismissError}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-300 dark:hover:text-red-100"
              aria-label="Dismiss voice error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500"
            >
              <Mic className="h-3.5 w-3.5" />
              Retry
            </button>
            <button
              type="button"
              onClick={onDismissError}
              className="inline-flex items-center rounded-full border border-red-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-400/20 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
