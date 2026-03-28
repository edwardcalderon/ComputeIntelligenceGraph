"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storeBrowserSession } from "../../lib/cigClient";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "checking" | "token" | "account" | "done" | "not-required";

interface BootstrapStatusResponse {
  bootstrapRequired: boolean;
}

interface BootstrapCompleteResponse {
  access_token: string;
  refresh_token?: string;
  adminId?: string;
  message?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BootstrapPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Check bootstrap status on mount ────────────────────────────────────────

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await apiFetch("/api/v1/bootstrap/node/status");
        if (!res.ok) {
          setError("Failed to check bootstrap status. Is the API running?");
          setPhase("token");
          return;
        }
        const data = (await res.json()) as BootstrapStatusResponse;
        if (data.bootstrapRequired) {
          setPhase("token");
        } else {
          setPhase("not-required");
          // Redirect to the dashboard after a short delay
          setTimeout(() => router.replace("/"), 2000);
        }
      } catch {
        setError("Could not reach the API. Make sure the self-hosted stack is running.");
        setPhase("token");
      }
    }
    void checkStatus();
  }, [router]);

  // ── Submit bootstrap token ──────────────────────────────────────────────────

  function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Bootstrap token is required");
      return;
    }
    setError(null);
    setPhase("account");
  }

  // ── Submit account creation ─────────────────────────────────────────────────

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !email.trim() || !password) {
      setError("All fields are required");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/bootstrap/node/complete", {
        method: "POST",
        body: JSON.stringify({
          bootstrap_token: token.trim(),
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed: ${res.status}`);
        return;
      }

      const data = (await res.json()) as BootstrapCompleteResponse;
      storeBrowserSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        authSource: "authentik",
      });
      setPhase("done");
      setTimeout(() => router.replace("/"), 2500);
    } catch {
      setError("Network error — could not complete bootstrap");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const inputClasses =
    "w-full rounded-xl border border-cig bg-cig-base px-4 py-2.5 text-sm text-cig-primary placeholder-cig-muted focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 mb-4">
            <svg
              className="size-7 text-cyan-600 dark:text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-cig-primary">Self-Hosted Setup</h1>
          <p className="mt-1 text-sm text-cig-muted">
            Complete the initial bootstrap to create your admin account
          </p>
        </div>

        {/* Checking state */}
        {phase === "checking" && (
          <div className="rounded-2xl border border-cig bg-cig-card p-6 flex items-center justify-center gap-3">
            <span className="inline-flex size-5 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-cig-secondary">Checking bootstrap status…</span>
          </div>
        )}

        {/* Not required */}
        {phase === "not-required" && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06] p-6 text-center space-y-2">
            <svg
              className="size-8 text-emerald-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Bootstrap already complete
            </p>
            <p className="text-xs text-cig-muted">Redirecting to login…</p>
          </div>
        )}

        {/* Token entry */}
        {phase === "token" && (
          <form
            onSubmit={handleTokenSubmit}
            className="rounded-2xl border border-cig bg-cig-card p-6 space-y-5"
          >
            <div>
              <h2 className="text-base font-semibold text-cig-primary mb-1">
                Enter Bootstrap Token
              </h2>
              <p className="text-sm text-cig-secondary">
                Paste the bootstrap token that was displayed when you ran{" "}
                <code className="text-xs font-mono bg-cig-elevated px-1.5 py-0.5 rounded">
                  cig install --mode self-hosted
                </code>
                .
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                Bootstrap Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(null);
                }}
                placeholder="32-character hex token"
                className={`${inputClasses} font-mono`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!token.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </form>
        )}

        {/* Account creation */}
        {phase === "account" && (
          <form
            onSubmit={handleAccountSubmit}
            className="rounded-2xl border border-cig bg-cig-card p-6 space-y-5"
          >
            <div>
              <h2 className="text-base font-semibold text-cig-primary mb-1">
                Create Admin Account
              </h2>
              <p className="text-sm text-cig-secondary">
                This will be the primary administrator account for your self-hosted CIG instance.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className={inputClasses}
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className={inputClasses}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 12 characters"
                  className={inputClasses}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className={inputClasses}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPhase("token");
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-xl text-sm text-cig-muted hover:text-cig-secondary hover:bg-cig-hover transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-flex size-4 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  "Create Admin Account"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06] p-6 text-center space-y-3">
            <svg
              className="size-10 text-emerald-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
              Bootstrap complete
            </p>
            <p className="text-sm text-cig-secondary">
              Admin account created. Redirecting to the dashboard…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
