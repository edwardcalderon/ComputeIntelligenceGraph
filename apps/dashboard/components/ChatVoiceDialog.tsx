"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Waves } from "lucide-react";
import { ModalCard } from "@cig/ui";

type VoiceMode = "review" | "auto-send";

export function ChatVoiceDialog({
  open,
  onClose,
  onTranscribe,
}: {
  open: boolean;
  onClose: () => void;
  onTranscribe: (payload: {
    blob: Blob;
    filename: string;
    durationMs: number;
    mode: VoiceMode;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<VoiceMode>("review");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const durationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode("review");
    setError(null);
    setDurationMs(0);

    return () => {
      if (durationTimerRef.current !== null) {
        window.clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [open]);

  async function stopMediaTracks() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setIsRecording(true);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.start();
      durationTimerRef.current = window.setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 200);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Voice recording could not start.");
    }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    setIsRecording(false);
    if (durationTimerRef.current !== null) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    const finishedDurationMs = Math.max(0, Date.now() - startedAtRef.current);
    setDurationMs(finishedDurationMs);

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          resolve();
        },
        { once: true },
      );
      recorder.stop();
    });

    await stopMediaTracks();

    const mimeType = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("wav") ? "wav" : "webm";

    setIsSubmitting(true);
    try {
      await onTranscribe({
        blob,
        filename: `voice-${Date.now()}.${extension}`,
        durationMs: finishedDurationMs,
        mode,
      });
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Voice transcription failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeDialog() {
    if (isRecording) {
      void stopRecording();
      return;
    }

    void stopMediaTracks();
    onClose();
  }

  return (
    <ModalCard
      open={open}
      tone="info"
      title="Voice input"
      description="Record a short voice note, transcribe it with OpenAI, and either review it or send it directly into the chat."
      icon={<Mic className="h-5 w-5" />}
      dismissLabel="Close voice dialog"
      onDismiss={closeDialog}
      footer={
        <>
          <button
            type="button"
            onClick={closeDialog}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700/70 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {isRecording ? "Stop and transcribe" : "Close"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isRecording) {
                void stopRecording();
                return;
              }

              void startRecording();
            }}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Waves className="h-4 w-4" />}
            {isRecording ? "Finish recording" : "Start recording"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {([
            ["review", "Review before send"],
            ["auto-send", "Auto-send transcript"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={[
                "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                mode === value
                  ? "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300"
                  : "border-slate-200/80 bg-white text-slate-500 dark:border-zinc-700/70 dark:bg-zinc-950 dark:text-zinc-400",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 px-4 py-4 dark:border-zinc-700/70 dark:bg-zinc-950/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Recorder
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                {isRecording ? "Recording in progress" : "Ready to capture voice"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                {Math.round(durationMs / 1000)}s captured
              </p>
            </div>
            <span
              className={[
                "inline-flex h-11 w-11 items-center justify-center rounded-full",
                isRecording
                  ? "bg-red-500/12 text-red-500 ring-4 ring-red-500/12"
                  : "bg-violet-500/10 text-violet-600 dark:bg-violet-400/12 dark:text-violet-300",
              ].join(" ")}
            >
              <Mic className="h-5 w-5" />
            </span>
          </div>
        </div>

        {error ? (
          <p className="rounded-2xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </ModalCard>
  );
}
