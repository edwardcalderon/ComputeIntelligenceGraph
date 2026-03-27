"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { browserApiFetch, getBrowserAccessToken } from "../../../../lib/browserApi";
import { DASHBOARD_API_URL } from "../../../../lib/cigClient";
import type { OnboardingStatus } from "@cig/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusResponse {
  intentId: string;
  status: OnboardingStatus;
  cloudProvider: string;
  updatedAt: string;
  nodeId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  draft: "Intent created",
  manifest_ready: "Manifest ready",
  cli_started: "CLI started",
  node_enrolled: "Node enrolled",
  credential_validated: "Credentials validated",
  discovery_started: "Discovery started",
  online: "Node online",
  enrollment_failed: "Enrollment failed",
  credential_error: "Credential error",
  discovery_failed: "Discovery failed",
};

const STATUS_DESCRIPTIONS: Partial<Record<OnboardingStatus, string>> = {
  draft: "Onboarding intent has been created",
  manifest_ready: "Setup manifest generated and ready for CLI",
  cli_started: "CLI has fetched the manifest and started installation",
  node_enrolled: "CIG Node has enrolled with the control plane",
  credential_validated: "Cloud credentials have been verified",
  discovery_started: "Initial infrastructure discovery scan is running",
  online: "CIG Node is online and actively discovering resources",
};

const STATUS_ORDER: OnboardingStatus[] = [
  "draft",
  "manifest_ready",
  "cli_started",
  "node_enrolled",
  "credential_validated",
  "discovery_started",
  "online",
];

const ERROR_STATUSES: OnboardingStatus[] = [
  "enrollment_failed",
  "credential_error",
  "discovery_failed",
];

function isErrorStatus(s: OnboardingStatus): boolean {
  return ERROR_STATUSES.includes(s);
}

function isTerminalStatus(s: OnboardingStatus): boolean {
  return s === "online" || isErrorStatus(s);
}

// Maps an error status to the "last good" step index it failed at
const ERROR_STEP_MAP: Partial<Record<OnboardingStatus, number>> = {
  enrollment_failed: STATUS_ORDER.indexOf("node_enrolled"),
  credential_error: STATUS_ORDER.indexOf("credential_validated"),
  discovery_failed: STATUS_ORDER.indexOf("discovery_started"),
};

// ─── Recovery action config ───────────────────────────────────────────────────

interface RecoveryAction {
  label: string;
  href?: string;
  isExternal?: boolean;
}

const RECOVERY_ACTIONS: Record<string, RecoveryAction> = {
  enrollment_failed: {
    label: "Regenerate Manifest",
    href: "/onboarding/aws",
  },
  credential_error: {
    label: "Fix IAM/SA Setup",
    href: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create.html",
    isExternal: true,
  },
  discovery_failed: {
    label: "Retry Discovery",
    href: undefined, // handled inline
  },
};

// ─── Step icon ────────────────────────────────────────────────────────────────

function StepIcon({
  state,
}: {
  state: "done" | "active" | "error" | "pending";
}) {
  if (state === "done") {
    return (
      <svg
        className="size-4 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex size-4 border-2 border-cyan-500/60 border-t-transparent rounded-full animate-spin" />
    );
  }
  if (state === "error") {
    return (
      <svg
        className="size-4 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    );
  }
  return <div className="size-4 rounded-full border border-cig-border" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingProgressPage() {
  const params = useParams();
  const intentId = params?.intentId as string | undefined;

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [cloudProvider, setCloudProvider] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sseFailedRef = useRef(false);

  // ── Apply status update ─────────────────────────────────────────────────────

  const applyStatus = useCallback((data: StatusResponse) => {
    setStatus(data.status);
    setCloudProvider(data.cloudProvider ?? null);
    if (data.nodeId) setNodeId(data.nodeId);
  }, []);

  // ── Fetch initial status ────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    if (!intentId) return;
    try {
      const res = await browserApiFetch(`/api/v1/onboarding/intents/${intentId}/status`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(err.error ?? `Failed to load status (${res.status})`);
        return;
      }
      const data = (await res.json()) as StatusResponse;
      applyStatus(data);
    } catch {
      setLoadError("Unable to reach the API. Check your connection and try again.");
    }
  }, [intentId, applyStatus]);

  // ── SSE connection ──────────────────────────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (!intentId || sseRef.current) return;

    const token = getBrowserAccessToken();
    const sseUrl = new URL(
      `/api/v1/onboarding/intents/${intentId}/sse`,
      DASHBOARD_API_URL
    );
    if (token) sseUrl.searchParams.set("token", token);

    const es = new EventSource(sseUrl.toString());
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as StatusResponse;
        applyStatus(data);
        if (isTerminalStatus(data.status)) {
          es.close();
          sseRef.current = null;
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      sseRef.current = null;
      sseFailedRef.current = true;
      // Fall back to polling
      startPolling();
    };
  }, [intentId, applyStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling fallback ────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (!intentId || pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await browserApiFetch(`/api/v1/onboarding/intents/${intentId}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        applyStatus(data);
        if (isTerminalStatus(data.status) && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // ignore transient errors
      }
    }, 5_000);
  }, [intentId, applyStatus]);

  // ── Mount: fetch initial state, then connect SSE (or poll) ─────────────────

  useEffect(() => {
    if (!intentId) return;

    void fetchStatus();
    connectSSE();

    return () => {
      sseRef.current?.close();
      sseRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [intentId, fetchStatus, connectSSE]);

  // ── Stop polling/SSE once terminal ─────────────────────────────────────────

  useEffect(() => {
    if (status && isTerminalStatus(status)) {
      sseRef.current?.close();
      sseRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [status]);

  // ── Retry discovery ─────────────────────────────────────────────────────────

  async function handleRetryDiscovery() {
    if (!intentId) return;
    setRetrying(true);
    try {
      await browserApiFetch(`/api/v1/onboarding/intents/${intentId}/retry`, {
        method: "POST",
      });
      await fetchStatus();
      // Reconnect SSE / polling
      sseFailedRef.current = false;
      connectSSE();
    } catch {
      // ignore — user can try again
    } finally {
      setRetrying(false);
    }
  }

  // ── Derive step states ──────────────────────────────────────────────────────

  function getStepState(
    stepStatus: OnboardingStatus
  ): "done" | "active" | "error" | "pending" {
    if (!status) return "pending";

    const currentIdx = STATUS_ORDER.indexOf(status);
    const thisIdx = STATUS_ORDER.indexOf(stepStatus);

    if (isErrorStatus(status)) {
      const failedAt = ERROR_STEP_MAP[status] ?? -1;
      if (thisIdx < failedAt) return "done";
      if (thisIdx === failedAt) return "error";
      return "pending";
    }

    if (currentIdx > thisIdx) return "done";
    if (currentIdx === thisIdx) return "active";
    return "pending";
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!intentId) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-6 py-5 text-sm text-red-700 dark:text-red-400">
          Missing intent ID in URL.
        </div>
      </div>
    );
  }

  if (loadError && !status) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="w-full max-w-lg space-y-4">
          <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-6 py-5 space-y-3">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Failed to load onboarding status
            </p>
            <p className="text-sm text-red-600 dark:text-red-400/80">{loadError}</p>
            <button
              type="button"
              onClick={() => { setLoadError(null); void fetchStatus(); }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const errorStatus = status && isErrorStatus(status) ? status : null;
  const recoveryAction = errorStatus ? RECOVERY_ACTIONS[errorStatus] : null;
  const isOnline = status === "online";

  return (
    <div className="flex items-start justify-center pt-8">
      <div className="w-full max-w-2xl space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="text-center">
          <div
            className={`inline-flex items-center justify-center size-14 rounded-2xl mb-4 border ${
              isOnline
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                : errorStatus
                ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                : "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20"
            }`}
          >
            {isOnline ? (
              <svg className="size-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : errorStatus ? (
              <svg className="size-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            ) : (
              <svg className="size-7 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 6 0m-6 0H3m16.5 0a3 3 0 0 0 3-3m-3 3a3 3 0 1 1-6 0m6 0h1.5m-7.5 0v3.75m0-3.75a3 3 0 0 1-3-3m3 3a3 3 0 0 0 3-3m-6 0V6.75m6 7.5V6.75m0 0a3 3 0 0 0-3-3m3 3a3 3 0 0 1-3-3m0 0a3 3 0 0 1-3 3m3-3h1.5M9 6.75a3 3 0 0 0-3 3m3-3H7.5" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-cig-primary">
            {isOnline
              ? "Node Online"
              : errorStatus
              ? STATUS_LABELS[errorStatus]
              : "Onboarding Progress"}
          </h1>
          <p className="mt-1 text-sm text-cig-muted font-mono">
            Intent: {intentId}
          </p>
          {cloudProvider && (
            <p className="mt-0.5 text-xs text-cig-muted uppercase tracking-wider">
              {cloudProvider === "aws" ? "Amazon Web Services" : cloudProvider === "gcp" ? "Google Cloud Platform" : cloudProvider}
            </p>
          )}
        </div>

        {/* ── Success banner ──────────────────────────────────────────────── */}
        {isOnline && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <svg className="size-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Your CIG Node is online and discovering resources!
                </p>
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400/80">
                  Infrastructure discovery is now running. Your graph will populate shortly.
                </p>
              </div>
            </div>
            {nodeId ? (
              <Link
                href={`/nodes/${nodeId}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
              >
                View Node
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
              >
                Go to Dashboard
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            )}
          </div>
        )}

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {errorStatus && recoveryAction && (
          <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] p-5 space-y-3">
            <div className="flex items-start gap-3">
              <svg className="size-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {STATUS_LABELS[errorStatus]}
                </p>
                <p className="mt-0.5 text-sm text-red-600 dark:text-red-400/80">
                  {errorStatus === "enrollment_failed" &&
                    "The CIG Node failed to enroll. The manifest may have expired or the enrollment token was already used."}
                  {errorStatus === "credential_error" &&
                    "Cloud credentials could not be validated. Check your IAM role trust policy or service account permissions."}
                  {errorStatus === "discovery_failed" &&
                    "The initial discovery scan failed. This may be a transient error or a permissions issue."}
                </p>
              </div>
            </div>
            {recoveryAction.href ? (
              <Link
                href={recoveryAction.href}
                target={recoveryAction.isExternal ? "_blank" : undefined}
                rel={recoveryAction.isExternal ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
              >
                {recoveryAction.label}
                {recoveryAction.isExternal && (
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                )}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void handleRetryDiscovery()}
                disabled={retrying}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {retrying ? (
                  <>
                    <span className="inline-flex size-3.5 border-2 border-red-400/40 border-t-transparent rounded-full animate-spin" />
                    Retrying…
                  </>
                ) : (
                  recoveryAction.label
                )}
              </button>
            )}
          </div>
        )}

        {/* ── Timeline stepper ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-cig bg-cig-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-4">
            Onboarding Progress
          </p>

          <div className="space-y-0">
            {STATUS_ORDER.map((s, idx) => {
              const stepState = getStepState(s);
              const isLast = idx === STATUS_ORDER.length - 1;

              return (
                <div key={s} className="flex gap-4">
                  {/* Left: icon + connector line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center size-8 rounded-full border shrink-0 transition-colors ${
                        stepState === "done"
                          ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30"
                          : stepState === "active"
                          ? "bg-cyan-50 dark:bg-cyan-500/15 border-cyan-200 dark:border-cyan-500/30"
                          : stepState === "error"
                          ? "bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/30"
                          : "bg-cig-elevated border-cig"
                      }`}
                    >
                      <StepIcon state={stepState} />
                    </div>
                    {!isLast && (
                      <div
                        className={`w-px flex-1 my-1 ${
                          stepState === "done"
                            ? "bg-emerald-200 dark:bg-emerald-500/30"
                            : "bg-cig-border"
                        }`}
                        style={{ minHeight: "1.5rem" }}
                      />
                    )}
                  </div>

                  {/* Right: label + description */}
                  <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
                    <p
                      className={`text-sm font-medium leading-8 ${
                        stepState === "done"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : stepState === "active"
                          ? "text-cyan-700 dark:text-cyan-400"
                          : stepState === "error"
                          ? "text-red-700 dark:text-red-400"
                          : "text-cig-muted"
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </p>
                    {STATUS_DESCRIPTIONS[s] && (stepState === "active" || stepState === "done") && (
                      <p className="text-[12px] text-cig-muted -mt-1 mb-1">
                        {STATUS_DESCRIPTIONS[s]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live indicator */}
          {status && !isTerminalStatus(status) && (
            <div className="mt-4 pt-4 border-t border-cig-border">
              <p className="text-[11px] text-cig-muted flex items-center gap-1.5">
                <span className="inline-flex size-2 rounded-full bg-cyan-500 animate-pulse" />
                {sseFailedRef.current
                  ? "Polling for updates every 5 seconds…"
                  : "Listening for real-time updates…"}
              </p>
            </div>
          )}
        </div>

        {/* ── Back links ──────────────────────────────────────────────────── */}
        {!isOnline && (
          <div className="flex items-center gap-4 text-sm text-cig-muted">
            <Link href="/onboarding/aws" className="hover:text-cig-secondary transition-colors">
              ← AWS Onboarding
            </Link>
            <span>·</span>
            <Link href="/onboarding/gcp" className="hover:text-cig-secondary transition-colors">
              GCP Onboarding →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
