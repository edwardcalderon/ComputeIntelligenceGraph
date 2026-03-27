"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, LoaderCircle, Mic, PencilLine, Send, Square } from "lucide-react";
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
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const durationTimerRef = useRef<number | null>(null);
  const hasAutoStartedRef = useRef(false);
  const isDialogOpenRef = useRef(false);
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    isDialogOpenRef.current = open;

    if (!open) {
      hasAutoStartedRef.current = false;
      return;
    }

    setMode("review");
    setError(null);
    setDurationMs(0);
    setIsPreparing(false);

    return () => {
      if (durationTimerRef.current !== null) {
        window.clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [open]);

  function describeVoiceError(nextError: unknown) {
    const message = nextError instanceof Error ? nextError.message : String(nextError);

    if (/chat\/transcriptions|voice transcription.*not available|not found|404/i.test(message)) {
      return "Voice transcription is not available on this API instance yet. Deploy the latest API runtime to enable it.";
    }

    if (/NotAllowedError|permission|denied/i.test(message)) {
      return "Microphone access is blocked. Allow microphone permissions and try again.";
    }

    if (/NotFoundError|device.*not found|audio input/i.test(message)) {
      return "No microphone is available on this device right now.";
    }

    return message || "Voice transcription failed.";
  }

  async function stopMediaTracks() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function discardRecording() {
    if (durationTimerRef.current !== null) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setIsPreparing(false);
    setDurationMs(0);
    await stopMediaTracks();
  }

  async function startRecording() {
    if (isPreparing || isRecording || isSubmitting) {
      return;
    }

    setError(null);
    setIsPreparing(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Media devices are not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isDialogOpenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

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
      setError(describeVoiceError(nextError));
      setIsRecording(false);
      await stopMediaTracks();
    } finally {
      setIsPreparing(false);
    }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
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
      setError(describeVoiceError(nextError));
    } finally {
      setIsSubmitting(false);
      mediaRecorderRef.current = null;
    }
  }

  function closeDialog() {
    void (async () => {
      await discardRecording();
      onClose();
    })();
  }

  startRecordingRef.current = startRecording;

  useEffect(() => {
    if (!open || hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;
    void startRecordingRef.current();
  }, [open]);

  const modeOptions: Array<{
    value: VoiceMode;
    label: string;
    description: string;
    icon: JSX.Element;
  }> = [
    {
      value: "review",
      label: "Write to chat",
      description: "Transcribe and place the text in the composer.",
      icon: <PencilLine className="h-3.5 w-3.5" />,
    },
    {
      value: "auto-send",
      label: "Send instantly",
      description: "Transcribe and send as soon as you stop recording.",
      icon: <Send className="h-3.5 w-3.5" />,
    },
  ];

  const primaryActionLabel = isRecording
    ? mode === "review"
      ? "Stop and write"
      : "Stop and send"
    : isPreparing
      ? "Preparing microphone"
      : "Retry microphone";

  return (
    <ModalCard
      open={open}
      tone="info"
      title="Voice assistant"
      description="Capture a short note without leaving the chat. The default mode writes the transcript into the composer instead of sending it."
      icon={<AudioLines className="h-5 w-5" />}
      dismissLabel="Close voice dialog"
      onDismiss={closeDialog}
      footer={
        <>
          <button
            type="button"
            onClick={closeDialog}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700/70 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
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
            disabled={isSubmitting || isPreparing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreparing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {primaryActionLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-cyan-200/70 bg-cyan-50/80 px-4 py-3 dark:border-cyan-400/20 dark:bg-cyan-500/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                Smart tool
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-zinc-100">
                {isPreparing
                  ? "Connecting to the microphone..."
                  : isRecording
                    ? "Listening now"
                    : "Voice capture is ready"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                {mode === "review"
                  ? "The transcript will be written into the composer for review."
                  : "The transcript will be sent directly once you stop recording."}
              </p>
            </div>
            <span
              className={[
                "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                isPreparing
                  ? "bg-cyan-500/12 text-cyan-600 ring-4 ring-cyan-500/10 dark:text-cyan-300"
                  : isRecording
                    ? "bg-red-500/12 text-red-500 ring-4 ring-red-500/12"
                    : "bg-violet-500/10 text-violet-600 dark:bg-violet-400/12 dark:text-violet-300",
              ].join(" ")}
            >
              {isPreparing ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={[
                "rounded-2xl border px-3 py-3 text-left transition-colors",
                mode === option.value
                  ? "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300"
                  : "border-slate-200/80 bg-white text-slate-500 dark:border-zinc-700/70 dark:bg-zinc-950 dark:text-zinc-400",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-inherit shadow-sm dark:bg-zinc-900">
                  {option.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 px-4 py-4 dark:border-zinc-700/70 dark:bg-zinc-950/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Session
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                {isPreparing
                  ? "Requesting microphone"
                  : isRecording
                    ? "Recording in progress"
                    : "Ready to capture voice"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                {Math.round(durationMs / 1000)}s captured
              </p>
            </div>
            <span
              className={[
                "inline-flex h-11 w-11 items-center justify-center rounded-full",
                isPreparing
                  ? "bg-cyan-500/12 text-cyan-600 ring-4 ring-cyan-500/10 dark:text-cyan-300"
                  : isRecording
                  ? "bg-red-500/12 text-red-500 ring-4 ring-red-500/12"
                  : "bg-violet-500/10 text-violet-600 dark:bg-violet-400/12 dark:text-violet-300",
              ].join(" ")}
            >
              {isPreparing ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
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
