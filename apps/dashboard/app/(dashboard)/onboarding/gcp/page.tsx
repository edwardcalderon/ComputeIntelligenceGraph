"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { validateGcpProjectId, validateSaEmail } from "@cig/sdk";
import { browserApiFetch } from "../../../../lib/browserApi";
import type { OnboardingStatus } from "@cig/sdk";

// ─── Constants ────────────────────────────────────────────────────────────────

const CIG_SA_EMAIL =
  process.env.NEXT_PUBLIC_CIG_GCP_SA_EMAIL ?? "cig-control-plane@cig-platform.iam.gserviceaccount.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface IntentResponse {
  intentId: string;
  manifestUrl: string;
  cliCommand: string;
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-cig-secondary hover:text-cig-primary hover:bg-cig-hover transition-colors"
        >
          {copied ? (
            <>
              <svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-cig bg-cig-elevated p-4 text-[12px] leading-relaxed text-cig-secondary font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as Step;
        const active = step === current;
        const done = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-8 h-px ${done ? "bg-cyan-500/40" : "bg-cig-border"}`} />
            )}
            <div
              className={`size-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-colors ${
                active
                  ? "bg-cyan-50 dark:bg-cyan-500/15 border-cyan-200 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400"
                  : done
                  ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-cig-elevated border-cig text-cig-muted"
              }`}
            >
              {done ? (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                step
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GcpOnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [projectId, setProjectId] = useState("");
  const [saEmail, setSaEmail] = useState("");
  const [projectIdError, setProjectIdError] = useState<string | null>(null);
  const [saEmailError, setSaEmailError] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentResponse | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inputClasses =
    "w-full rounded-xl border border-cig bg-cig-base px-4 py-2.5 text-sm text-cig-primary placeholder-cig-muted focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors font-mono";

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateProjectId(value: string) {
    if (!value.trim()) {
      setProjectIdError("GCP Project ID is required");
      return false;
    }
    const result = validateGcpProjectId(value.trim());
    if (!result.valid) {
      setProjectIdError(result.error ?? "Invalid GCP Project ID");
      return false;
    }
    setProjectIdError(null);
    return true;
  }

  function validateEmail(value: string) {
    if (!value.trim()) {
      setSaEmailError("Service account email is required");
      return false;
    }
    const result = validateSaEmail(value.trim());
    if (!result.valid) {
      setSaEmailError(result.error ?? "Invalid service account email");
      return false;
    }
    setSaEmailError(null);
    return true;
  }

  const isStep2Valid =
    !!projectId &&
    !!saEmail &&
    !projectIdError &&
    !saEmailError &&
    validateGcpProjectId(projectId).valid &&
    validateSaEmail(saEmail).valid;

  // ── Create intent mutation ──────────────────────────────────────────────────

  const createIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await browserApiFetch("/api/v1/onboarding/intents", {
        method: "POST",
        body: JSON.stringify({
          cloudProvider: "gcp",
          credentialsRef: saEmail.trim(),
          installProfile: "core",
          targetMode: "local",
          gcpConfig: {
            projectId: projectId.trim(),
            serviceAccountEmail: saEmail.trim(),
            impersonationEnabled: true,
          },
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Request failed: ${res.status}`);
      }
      return res.json() as Promise<IntentResponse>;
    },
    onSuccess: (data) => {
      setIntent(data);
      setStatus("manifest_ready");
      setStep(3);
    },
  });

  // ── Status polling ──────────────────────────────────────────────────────────

  const pollStatus = useCallback(async (intentId: string) => {
    try {
      const res = await browserApiFetch(`/api/v1/onboarding/intents/${intentId}/status`);
      if (!res.ok) return;
      const data = (await res.json()) as StatusResponse;
      setStatus(data.status);
      if (data.nodeId) setNodeId(data.nodeId);
      if (isTerminalStatus(data.status) && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    if (step === 3 && intent) {
      pollRef.current = setInterval(() => {
        void pollStatus(intent.intentId);
      }, 10_000);
      void pollStatus(intent.intentId);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [step, intent, pollStatus]);

  // ── Step handlers ───────────────────────────────────────────────────────────

  function handleStep1Next() {
    setStep(2);
  }

  function handleStep2Next(e: React.FormEvent) {
    e.preventDefault();
    const pidOk = validateProjectId(projectId);
    const emailOk = validateEmail(saEmail);
    if (!pidOk || !emailOk) return;
    createIntentMutation.mutate();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex items-start justify-center pt-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 mb-4">
            <svg className="size-7 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-cig-primary">Connect GCP Project</h1>
          <p className="mt-1 text-sm text-cig-muted">
            Set up service account impersonation so CIG can discover your GCP infrastructure
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={3} />

        {/* Step labels */}
        <div className="flex justify-center gap-0">
          {(["SA Setup", "Project Config", "Install"] as const).map((label, i) => (
            <div key={label} className="flex-1 text-center">
              <span className={`text-[11px] font-medium ${i + 1 === step ? "text-cyan-600 dark:text-cyan-400" : "text-cig-muted"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Step 1: SA impersonation setup ───────────────────────────────── */}
        {step === 1 && (
          <div className="rounded-2xl border border-cig bg-cig-card p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-cig-primary mb-1">
                Grant CIG service account impersonation access
              </h2>
              <p className="text-sm text-cig-secondary">
                CIG uses service account impersonation — no JSON key files required.
                Grant the CIG control plane SA permission to impersonate your target SA.
              </p>
            </div>

            <CopyBlock
              label="Step 1 — Grant Token Creator role to CIG SA on your target SA"
              code={`gcloud iam service-accounts add-iam-policy-binding \\
  YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com \\
  --member="serviceAccount:${CIG_SA_EMAIL}" \\
  --role="roles/iam.serviceAccountTokenCreator"`}
            />

            <div className="rounded-xl border border-cig bg-cig-elevated px-4 py-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
                Minimum IAM roles for Tier 1 discovery
              </p>
              <ul className="space-y-1">
                {[
                  { role: "roles/viewer", desc: "Read-only access to all GCP resources" },
                  { role: "roles/iam.serviceAccountTokenCreator", desc: "Required on your target SA (granted above)" },
                ].map(({ role, desc }) => (
                  <li key={role} className="flex items-start gap-2">
                    <code className="text-[12px] font-mono text-cyan-700 dark:text-cyan-400 shrink-0">{role}</code>
                    <span className="text-[12px] text-cig-muted">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Fallback: narrowly-scoped SA with warning */}
            <details className="group rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06]">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-400 select-none">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                Alternative: narrowly-scoped service account (not recommended)
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-3">
                <div className="rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 px-3 py-2">
                  <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                    Warning: JSON key upload is not the preferred path
                  </p>
                  <p className="mt-0.5 text-[12px] text-amber-700 dark:text-amber-400">
                    Downloading and uploading JSON key files creates long-lived credentials that are harder to rotate and audit.
                    Use SA impersonation above whenever possible.
                  </p>
                </div>
                <p className="text-[12px] text-cig-secondary">
                  If impersonation is not available in your environment, you can create a narrowly-scoped SA with only the
                  permissions needed for Tier 1 discovery and provide its email below. CIG will use the SA directly.
                </p>
                <CopyBlock
                  label="Create a narrowly-scoped SA (fallback only)"
                  code={`# Create the SA
gcloud iam service-accounts create cig-discovery \\
  --display-name="CIG Discovery SA"

# Grant minimum roles
gcloud projects add-iam-policy-binding YOUR_PROJECT \\
  --member="serviceAccount:cig-discovery@YOUR_PROJECT.iam.gserviceaccount.com" \\
  --role="roles/viewer"`}
                />
              </div>
            </details>

            <button
              type="button"
              onClick={handleStep1Next}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
            >
              I&apos;ve configured the service account — Next
            </button>
          </div>
        )}

        {/* ── Step 2: Project ID + SA email inputs ──────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleStep2Next} className="rounded-2xl border border-cig bg-cig-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-cig-primary mb-1">
                Enter your GCP project details
              </h2>
              <p className="text-sm text-cig-secondary">
                Provide your GCP project ID and the service account email CIG should impersonate.
              </p>
            </div>

            {/* GCP Project ID */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                GCP Project ID
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  if (projectIdError) validateProjectId(e.target.value);
                }}
                onBlur={() => validateProjectId(projectId)}
                placeholder="my-gcp-project-123"
                className={`${inputClasses} ${projectIdError ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30 focus:border-red-500/40" : ""}`}
                autoComplete="off"
                spellCheck={false}
              />
              {projectIdError && (
                <p className="mt-1.5 text-[12px] text-red-600 dark:text-red-400">{projectIdError}</p>
              )}
              {!projectIdError && projectId && validateGcpProjectId(projectId).valid && (
                <p className="mt-1.5 flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Valid project ID
                </p>
              )}
            </div>

            {/* SA Email */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                Service Account Email
              </label>
              <input
                type="text"
                value={saEmail}
                onChange={(e) => {
                  setSaEmail(e.target.value);
                  if (saEmailError) validateEmail(e.target.value);
                }}
                onBlur={() => validateEmail(saEmail)}
                placeholder="my-sa@my-gcp-project-123.iam.gserviceaccount.com"
                className={`${inputClasses} ${saEmailError ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30 focus:border-red-500/40" : ""}`}
                autoComplete="off"
                spellCheck={false}
              />
              {saEmailError && (
                <p className="mt-1.5 text-[12px] text-red-600 dark:text-red-400">{saEmailError}</p>
              )}
              {!saEmailError && saEmail && validateSaEmail(saEmail).valid && (
                <p className="mt-1.5 flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Valid service account email
                </p>
              )}
            </div>

            {createIntentMutation.isError && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {(createIntentMutation.error as Error).message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-sm text-cig-muted hover:text-cig-secondary hover:bg-cig-hover transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={createIntentMutation.isPending || !isStep2Valid}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createIntentMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-flex size-4 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin" />
                    Creating intent…
                  </span>
                ) : (
                  "Create Intent"
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: CLI command + status polling ──────────────────────────── */}
        {step === 3 && intent && (
          <div className="rounded-2xl border border-cig bg-cig-card p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-cig-primary mb-1">
                Run the install command
              </h2>
              <p className="text-sm text-cig-secondary">
                Copy and run this command on the machine where you want to install the CIG Node.
              </p>
            </div>

            <CopyBlock label="CLI Install Command" code={intent.cliCommand} />

            {/* Status tracker */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
                Onboarding Progress
              </p>
              <div className="space-y-1.5">
                {STATUS_ORDER.map((s) => {
                  const currentIdx = status ? STATUS_ORDER.indexOf(status) : -1;
                  const thisIdx = STATUS_ORDER.indexOf(s);
                  const isDone = currentIdx > thisIdx;
                  const isActive = currentIdx === thisIdx;
                  const isError = status && isErrorStatus(status) && isActive;

                  return (
                    <div
                      key={s}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive && !isError
                          ? "bg-cyan-50 dark:bg-cyan-500/[0.08] border border-cyan-200 dark:border-cyan-500/20"
                          : isDone
                          ? "bg-emerald-50 dark:bg-emerald-500/[0.06] border border-emerald-200 dark:border-emerald-500/15"
                          : "border border-transparent"
                      }`}
                    >
                      <div className="shrink-0">
                        {isDone ? (
                          <svg className="size-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : isActive && !isError ? (
                          <span className="inline-flex size-4 border-2 border-cyan-500/60 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="size-4 rounded-full border border-cig-border" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isDone
                            ? "text-emerald-700 dark:text-emerald-400"
                            : isActive && !isError
                            ? "text-cyan-700 dark:text-cyan-400 font-medium"
                            : "text-cig-muted"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Error state */}
              {status && isErrorStatus(status) && (
                <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {STATUS_LABELS[status]} — check the CIG Node logs for details.
                </div>
              )}

              {/* Success state */}
              {status === "online" && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="size-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      Your CIG Node is online and discovering resources!
                    </p>
                  </div>
                  {nodeId ? (
                    <Link
                      href={`/nodes/${nodeId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
                    >
                      View Node
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
                    >
                      Go to Dashboard
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  )}
                </div>
              )}

              {/* Polling indicator */}
              {status && !isTerminalStatus(status) && (
                <p className="text-[11px] text-cig-muted flex items-center gap-1.5">
                  <span className="inline-flex size-2 rounded-full bg-cyan-500 animate-pulse" />
                  Checking status every 10 seconds…
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
