"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@cig-technology/i18n/react";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Rocket,
  Server,
  Shield,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { StatCard } from "../../../components/StatCard";
import {
  getBootstrapStatus,
  validateBootstrapToken,
  type BootstrapStatus,
} from "../../../lib/api";
import { storeBrowserSession } from "../../../lib/cigClient";

type BootstrapView = "checking" | "token" | "account" | "managed" | "done" | "finished";

type BootstrapCompleteResponse = {
  access_token: string;
  refresh_token?: string | null;
  adminId?: string;
  message?: string;
  error?: string;
  code?: string;
};

type DemoResourceGroup = {
  title: string;
  accent: string;
  items: Array<{
    name: string;
    meta: string;
  }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";

const DEMO_RESOURCE_GROUPS: DemoResourceGroup[] = [
  {
    title: "Platform control plane",
    accent: "rgba(34, 211, 238, 0.9)",
    items: [
      { name: "Demo Platform Gateway", meta: "AWS · us-east-1 · public entry" },
      { name: "Demo Shared VPC", meta: "AWS · us-east-1 · shared network" },
    ],
  },
  {
    title: "Sales and data",
    accent: "rgba(59, 130, 246, 0.9)",
    items: [
      { name: "Demo Ventas API", meta: "AWS · us-east-1 · sales API" },
      { name: "Demo Clientes DB", meta: "AWS · us-east-1 · postgres" },
      { name: "Demo Cache Cluster", meta: "AWS · us-east-1 · hot cache" },
    ],
  },
  {
    title: "Automation and analytics",
    accent: "rgba(139, 92, 246, 0.9)",
    items: [
      { name: "Demo Productos Store", meta: "GCP · multi-region · object storage" },
      { name: "Demo Creditos Function", meta: "GCP · us-central1 · finance function" },
      { name: "Demo Campanas Function", meta: "AWS · us-west-2 · marketing function" },
      { name: "Demo Reporting App", meta: "Kubernetes · us-east-1 · analytics app" },
    ],
  },
];

const FLOW_STEPS = [
  {
    index: "01",
    title: "Token validation",
    description: "Checks the seeded install token before the admin form unlocks.",
    icon: LockKeyhole,
  },
  {
    index: "02",
    title: "Admin account",
    description: "Creates the first local administrator and seals bootstrap.",
    icon: Shield,
  },
  {
    index: "03",
    title: "Dashboard handoff",
    description: "Stores the browser session and returns you to the workspace.",
    icon: Rocket,
  },
] as const;

function isAlreadyCompleteMessage(message: string): boolean {
  return message.toLowerCase().includes("already been completed");
}

function StateBadge({
  label,
  tone = "cyan",
}: {
  label: string;
  tone?: "cyan" | "emerald" | "slate";
}) {
  const toneClasses: Record<"cyan" | "emerald" | "slate", string> = {
    cyan:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:border-cyan-500/20 dark:text-cyan-300",
    emerald:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:text-emerald-300",
    slate:
      "border-cig-border bg-cig-elevated text-cig-secondary dark:border-cig-border dark:text-cig-secondary",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

function DemoResourceCard({ group }: { group: DemoResourceGroup }) {
  return (
    <div className="rounded-2xl border border-cig bg-cig-base/60 p-4">
      <div className="flex items-center gap-3">
        <span
          className="size-2.5 rounded-full shadow-[0_0_0_6px_rgba(255,255,255,0.02)]"
          style={{ backgroundColor: group.accent }}
        />
        <h3 className="text-sm font-semibold text-cig-primary">{group.title}</h3>
      </div>
      <div className="mt-4 space-y-3">
        {group.items.map((item) => (
          <div key={item.name} className="rounded-xl border border-cig/60 bg-cig-card/80 px-3 py-2">
            <p className="text-sm font-medium text-cig-primary">{item.name}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-cig-muted">
              {item.meta}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BootstrapPage() {
  const router = useRouter();
  const t = useTranslation();
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [view, setView] = useState<BootstrapView>("checking");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [completion, setCompletion] = useState<BootstrapCompleteResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const next = await getBootstrapStatus();
        if (cancelled) {
          return;
        }

        setStatus(next);
        if (next.mode === "managed") {
          setView("managed");
          return;
        }

        setView(next.requires_bootstrap ? "token" : "done");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatusError(
          error instanceof Error ? error.message : t("bootstrap.statusCheckFailedDesc")
        );
        setView("token");
      }
    }

    void checkStatus();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (view !== "finished") {
      return;
    }

    const timer = window.setTimeout(() => {
      router.replace("/");
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [router, view]);

  async function handleTokenSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setTokenError(t("bootstrap.errorToken"));
      return;
    }

    setTokenLoading(true);
    setTokenError(null);
    setAccountError(null);

    try {
      await validateBootstrapToken(trimmedToken);
      setView("account");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("bootstrap.errorInvalidToken");

      if (isAlreadyCompleteMessage(message)) {
        setView("done");
        setStatus((current) =>
          current ?? { requires_bootstrap: false, mode: "self-hosted" }
        );
        return;
      }

      setTokenError(message || t("bootstrap.errorInvalidToken"));
    } finally {
      setTokenLoading(false);
    }
  }

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      setAccountError(t("bootstrap.errorAllRequired"));
      return;
    }

    if (password.length < 12) {
      setAccountError(t("bootstrap.errorPasswordLength"));
      return;
    }

    if (password !== confirmPassword) {
      setAccountError(t("bootstrap.errorPasswordMatch"));
      return;
    }

    setAccountLoading(true);
    setAccountError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/bootstrap/node/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bootstrap_token: token.trim(),
          username: trimmedUsername,
          email: trimmedEmail,
          password,
        }),
      });

      const body = (await response.json().catch(() => null)) as BootstrapCompleteResponse | null;

      if (!response.ok) {
        if (
          body?.code === "bootstrap_already_complete" ||
          body?.message?.toLowerCase().includes("already completed")
        ) {
          setView("done");
          return;
        }
        const errorMessage =
          body?.message ?? body?.error ?? `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      if (!body?.access_token) {
        throw new Error(t("bootstrap.errorFailed"));
      }

      storeBrowserSession({
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? null,
        authSource: "authentik",
      });

      setCompletion(body);
      setView("finished");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : t("bootstrap.errorFailed"));
    } finally {
      setAccountLoading(false);
    }
  }

  const modeLabel =
    status?.mode === "managed"
      ? t("bootstrap.managedInstance")
      : "Self-hosted";

  const modeTone = status?.mode === "managed" ? "emerald" : "cyan";

  return (
    <div className="relative isolate space-y-6 pb-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(139,92,246,0.08),transparent_26%)]"
      />

      <div className="flex flex-wrap items-center gap-3">
        <StateBadge label={modeLabel} tone={modeTone} />
        <StateBadge label="Dashboard shell" tone="slate" />
        <StateBadge label="Demo data visible" tone="slate" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.14fr_0.86fr]">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-cig bg-cig-card/90 p-6 shadow-[0_28px_80px_-48px_rgba(6,182,212,0.45)] md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
                  <Sparkles className="size-3.5" />
                  Self-hosted Setup
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-cig-primary sm:text-4xl">
                  {t("bootstrap.title")}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-cig-secondary sm:text-base">
                  {t("bootstrap.subtitle")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-cig bg-cig-base/70 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cig-muted">Mode</p>
                  <p className="mt-1 text-sm font-semibold text-cig-primary">{modeLabel}</p>
                </div>
                <div className="rounded-2xl border border-cig bg-cig-base/70 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cig-muted">Flow</p>
                  <p className="mt-1 text-sm font-semibold text-cig-primary">Token to admin</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Seeded resources" value={9} color="#06b6d4" />
            <StatCard label="Dependency links" value={9} color="#3b82f6" />
            <StatCard label="Primary regions" value={4} color="#8b5cf6" />
            <StatCard label="Token window" value="30m" color="#10b981" />
          </div>

          <div className="rounded-[2rem] border border-cig bg-cig-card/90 p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cig-muted">
                  Demo preview
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-cig-primary">
                  Seeded workspace layout
                </h2>
              </div>
              <div className="rounded-full border border-cig bg-cig-base/70 px-3 py-1.5 text-xs font-medium text-cig-secondary">
                9 resources
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {DEMO_RESOURCE_GROUPS.map((group) => (
                <DemoResourceCard key={group.title} group={group} />
              ))}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-cig bg-cig-base/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cig-primary">
                  <Server className="size-4 text-cyan-500" />
                  Platform layer
                </div>
                <p className="mt-2 text-sm leading-6 text-cig-secondary">
                  Demo Platform Gateway and Demo Shared VPC frame the top of the seeded stack.
                </p>
              </div>
              <div className="rounded-2xl border border-cig bg-cig-base/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cig-primary">
                  <Database className="size-4 text-blue-500" />
                  Data layer
                </div>
                <p className="mt-2 text-sm leading-6 text-cig-secondary">
                  Sales APIs, customer data, and cache resources show the operational core.
                </p>
              </div>
              <div className="rounded-2xl border border-cig bg-cig-base/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cig-primary">
                  <Layers3 className="size-4 text-violet-500" />
                  Analytics layer
                </div>
                <p className="mt-2 text-sm leading-6 text-cig-secondary">
                  Reporting, functions, and object storage complete the demo narrative.
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-cig bg-cig-card/95 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cig-muted">
                  Bootstrap flow
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-cig-primary">
                  {view === "managed"
                    ? t("bootstrap.managedInstance")
                    : view === "done"
                      ? t("bootstrap.alreadyDone")
                      : view === "finished"
                        ? t("bootstrap.complete")
                        : "Create the first admin"}
                </h2>
              </div>
              <StateBadge
                label={
                  status?.mode === "managed"
                    ? "managed"
                    : status?.requires_bootstrap === false
                      ? "ready"
                      : "self-hosted"
                }
                tone={status?.mode === "managed" ? "emerald" : "cyan"}
              />
            </div>

            {statusError && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4" />
                  <div>
                    <p className="font-medium">{t("bootstrap.statusCheckFailed")}</p>
                    <p className="mt-1 text-xs leading-5 opacity-90">{statusError}</p>
                  </div>
                </div>
              </div>
            )}

            {view === "checking" && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-cig bg-cig-base/70 px-4 py-4">
                <LoaderCircle className="size-5 animate-spin text-cyan-500" />
                <div>
                  <p className="text-sm font-medium text-cig-primary">{t("bootstrap.checking")}</p>
                  <p className="text-xs text-cig-muted">Resolving the live bootstrap state.</p>
                </div>
              </div>
            )}

            {view === "managed" && (
              <div className="mt-8 space-y-5">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {t("bootstrap.managedInstance")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-emerald-800/90 dark:text-emerald-200/90">
                        {t("bootstrap.managedInstanceDesc")}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200"
                >
                  {t("bootstrap.goToDashboard")}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            {view === "done" && (
              <div className="mt-8 space-y-5">
                <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-500/20 dark:bg-cyan-500/10">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 text-cyan-600 dark:text-cyan-300" />
                    <div>
                      <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                        {t("bootstrap.alreadyDone")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-cyan-900/85 dark:text-cyan-100/90">
                        {t("bootstrap.alreadyDoneDesc")}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200"
                >
                  {t("bootstrap.goToDashboard")}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            {view === "token" && (
              <form className="mt-8 space-y-5" onSubmit={handleTokenSubmit}>
                <div>
                  <p className="text-sm font-medium text-cig-primary">{t("bootstrap.tokenLabel")}</p>
                  <p className="mt-2 text-sm leading-6 text-cig-secondary">
                    The bootstrap token was generated when you first ran{" "}
                    <code className="rounded-md border border-cig bg-cig-base px-1.5 py-0.5 font-mono text-[11px] text-cig-primary">
                      cig install --mode self-hosted
                    </code>
                    . Paste it here to unlock the first admin account.
                  </p>
                </div>

                <div>
                  <input
                    value={token}
                    onChange={(event) => {
                      setToken(event.target.value);
                      setTokenError(null);
                    }}
                    type="text"
                    placeholder={t("bootstrap.tokenPlaceholder")}
                    className="w-full rounded-2xl border border-cig bg-cig-base px-4 py-3 font-mono text-sm text-cig-primary placeholder:text-cig-muted focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {tokenError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {tokenError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={tokenLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200"
                >
                  {tokenLoading ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      {t("bootstrap.validating")}
                    </>
                  ) : (
                    <>
                      {t("bootstrap.validateToken")}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {view === "account" && (
              <form className="mt-8 space-y-5" onSubmit={handleAccountSubmit}>
                <div>
                  <p className="text-sm font-medium text-cig-primary">
                    {t("bootstrap.createAdmin")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-cig-secondary">
                    This creates the first admin account and turns the seeded demo into a live
                    dashboard session.
                  </p>
                </div>

                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cig-muted">
                      {t("bootstrap.username")}
                    </span>
                    <input
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setAccountError(null);
                      }}
                      type="text"
                      placeholder={t("bootstrap.username")}
                      className="w-full rounded-2xl border border-cig bg-cig-base px-4 py-3 text-sm text-cig-primary placeholder:text-cig-muted focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                      autoComplete="username"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cig-muted">
                      {t("bootstrap.email")}
                    </span>
                    <input
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setAccountError(null);
                      }}
                      type="email"
                      placeholder={t("bootstrap.email")}
                      className="w-full rounded-2xl border border-cig bg-cig-base px-4 py-3 text-sm text-cig-primary placeholder:text-cig-muted focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                      autoComplete="email"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cig-muted">
                      {t("bootstrap.password")}
                    </span>
                    <input
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setAccountError(null);
                      }}
                      type="password"
                      placeholder={t("bootstrap.passwordPlaceholder")}
                      className="w-full rounded-2xl border border-cig bg-cig-base px-4 py-3 text-sm text-cig-primary placeholder:text-cig-muted focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                      autoComplete="new-password"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cig-muted">
                      {t("bootstrap.confirmPassword")}
                    </span>
                    <input
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setAccountError(null);
                      }}
                      type="password"
                      placeholder={t("bootstrap.confirmPasswordPlaceholder")}
                      className="w-full rounded-2xl border border-cig bg-cig-base px-4 py-3 text-sm text-cig-primary placeholder:text-cig-muted focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                      autoComplete="new-password"
                    />
                  </label>
                </div>

                {accountError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {accountError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={accountLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200"
                >
                  {accountLoading ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      {t("bootstrap.creatingAccount")}
                    </>
                  ) : (
                    <>
                      {t("bootstrap.createAdminAccount")}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {view === "finished" && (
              <div className="mt-8 space-y-5">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {t("bootstrap.complete")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-emerald-800/90 dark:text-emerald-200/90">
                        {completion?.message ?? t("bootstrap.completeDesc")}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200"
                >
                  {t("bootstrap.goToDashboard")}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-cig bg-cig-card/90 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-cig-primary">
              <LoaderCircle className="size-4 text-cyan-500" />
              Bootstrap sequence
            </div>
            <div className="mt-4 grid gap-3">
              {FLOW_STEPS.map((step) => {
                const StepIcon = step.icon;

                return (
                  <div key={step.title} className="rounded-2xl border border-cig bg-cig-base/60 p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-cig bg-cig-card text-[11px] font-semibold text-cig-primary">
                        {step.index}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StepIcon className="size-4 text-cyan-500" />
                          <p className="text-sm font-medium text-cig-primary">{step.title}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-cig-muted">{step.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
