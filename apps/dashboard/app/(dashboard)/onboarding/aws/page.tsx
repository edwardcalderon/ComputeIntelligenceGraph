"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { validateRoleArn } from "@cig/sdk";
import { browserApiFetch } from "../../../../lib/browserApi";
import type { OnboardingStatus } from "@cig/sdk";

// ─── IAM Policy constants ────────────────────────────────────────────────────

const CIG_CONTROL_PLANE_ACCOUNT_ID = process.env.NEXT_PUBLIC_CIG_AWS_ACCOUNT_ID ?? "123456789012";

const TRUST_POLICY = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          AWS: `arn:aws:iam::${CIG_CONTROL_PLANE_ACCOUNT_ID}:root`,
        },
        Action: "sts:AssumeRole",
        Condition: {
          StringEquals: {
            "sts:ExternalId": "<your-external-id>",
          },
        },
      },
    ],
  },
  null,
  2
);

const PERMISSION_POLICY = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "CIGNodeTier1Discovery",
        Effect: "Allow",
        Action: [
          "ec2:Describe*",
          "s3:ListAllMyBuckets",
          "s3:GetBucketLocation",
          "s3:GetBucketTagging",
          "rds:Describe*",
          "elasticloadbalancing:Describe*",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "iam:ListRoles",
          "iam:GetRole",
          "iam:ListAttachedRolePolicies",
        ],
        Resource: "*",
      },
    ],
  },
  null,
  2
);

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Sub-components ──────────────────────────────────────────────────────────

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

// ─── Main component ──────────────────────────────────────────────────────────

export default function AwsOnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [roleArn, setRoleArn] = useState("");
  const [arnError, setArnError] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentResponse | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inputClasses =
    "w-full rounded-xl border border-cig bg-cig-base px-4 py-2.5 text-sm text-cig-primary placeholder-cig-muted focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors font-mono";

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateArn(value: string) {
    if (!value.trim()) {
      setArnError("Role ARN is required");
      return false;
    }
    const result = validateRoleArn(value.trim());
    if (!result.valid) {
      setArnError(result.error ?? "Invalid Role ARN format");
      return false;
    }
    setArnError(null);
    return true;
  }

  // ── Create intent mutation ──────────────────────────────────────────────────

  const createIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await browserApiFetch("/api/v1/onboarding/intents", {
        method: "POST",
        body: JSON.stringify({
          cloudProvider: "aws",
          credentialsRef: roleArn.trim(),
          installProfile: "core",
          targetMode: "local",
          awsConfig: { roleArn: roleArn.trim() },
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
      // Start polling every 10s
      pollRef.current = setInterval(() => {
        void pollStatus(intent.intentId);
      }, 10_000);
      // Also poll immediately
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
    if (!validateArn(roleArn)) return;
    createIntentMutation.mutate();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex items-start justify-center pt-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 mb-4">
            <svg className="size-7 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.527 3.051a1 1 0 0 0-1.054 0L2.473 9.051A1 1 0 0 0 2 9.94v4.12a1 1 0 0 0 .473.889l10 6a1 1 0 0 0 1.054 0l10-6A1 1 0 0 0 22 14.06V9.94a1 1 0 0 0-.473-.889l-10-6Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-cig-primary">Connect AWS Account</h1>
          <p className="mt-1 text-sm text-cig-muted">
            Set up an IAM Role so CIG can discover your infrastructure
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={3} />

        {/* Step labels */}
        <div className="flex justify-center gap-0">
          {(["IAM Setup", "Role ARN", "Install"] as const).map((label, i) => (
            <div key={label} className="flex-1 text-center">
              <span className={`text-[11px] font-medium ${i + 1 === step ? "text-cyan-600 dark:text-cyan-400" : "text-cig-muted"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Step 1: IAM Setup ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="rounded-2xl border border-cig bg-cig-card p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-cig-primary mb-1">
                Create an IAM Role in your AWS account
              </h2>
              <p className="text-sm text-cig-secondary">
                CIG uses cross-account role assumption — no long-lived access keys required.
                Follow these steps in the AWS Console or CLI.
              </p>
            </div>

            <CopyBlock label="Trust Policy (attach to your new role)" code={TRUST_POLICY} />
            <CopyBlock label="Permission Policy — Tier 1 Discovery" code={PERMISSION_POLICY} />

            <div className="rounded-xl border border-cig bg-cig-elevated px-4 py-3 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
                Expected Role ARN format
              </p>
              <code className="text-sm font-mono text-cig-primary">
                arn:aws:iam::&lt;12-digit-account-id&gt;:role/&lt;role-name&gt;
              </code>
              <p className="text-[11px] text-cig-muted">
                Example: arn:aws:iam::123456789012:role/CIGDiscoveryRole
              </p>
            </div>

            <button
              type="button"
              onClick={handleStep1Next}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
            >
              I&apos;ve created the role — Next
            </button>
          </div>
        )}

        {/* ── Step 2: Role ARN input ────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleStep2Next} className="rounded-2xl border border-cig bg-cig-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-cig-primary mb-1">
                Enter your IAM Role ARN
              </h2>
              <p className="text-sm text-cig-secondary">
                Paste the ARN of the role you just created. CIG will validate the format before proceeding.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                Role ARN
              </label>
              <input
                type="text"
                value={roleArn}
                onChange={(e) => {
                  setRoleArn(e.target.value);
                  if (arnError) validateArn(e.target.value);
                }}
                onBlur={() => validateArn(roleArn)}
                placeholder="arn:aws:iam::123456789012:role/CIGDiscoveryRole"
                className={`${inputClasses} ${arnError ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30 focus:border-red-500/40" : ""}`}
                autoComplete="off"
                spellCheck={false}
              />
              {arnError && (
                <p className="mt-1.5 text-[12px] text-red-600 dark:text-red-400">{arnError}</p>
              )}
              {!arnError && roleArn && validateRoleArn(roleArn).valid && (
                <p className="mt-1.5 flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Valid ARN format
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
                disabled={createIntentMutation.isPending || !roleArn || !!arnError}
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
                  {nodeId && (
                    <Link
                      href={`/nodes/${nodeId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
                    >
                      View Node
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  )}
                  {!nodeId && (
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
