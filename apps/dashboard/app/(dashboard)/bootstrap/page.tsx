"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getBootstrapStatus,
  validateBootstrapToken,
  completeBootstrap,
  BootstrapStatus,
} from "../../../lib/api";

type Step = "check" | "token" | "admin" | "complete";

export default function BootstrapPage() {
  const [step, setStep] = useState<Step>("check");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Check if bootstrap is needed
  const { isLoading: checkLoading } = useQuery<BootstrapStatus>({
    queryKey: ["bootstrap", "status"],
    queryFn: getBootstrapStatus,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: step === "check",
    meta: {
      onSuccess: (data: BootstrapStatus) => {
        if (data.requires_bootstrap) {
          setStep("token");
        }
      },
    },
  });

  const { data: bootstrapStatus } = useQuery<BootstrapStatus>({
    queryKey: ["bootstrap", "status"],
    queryFn: getBootstrapStatus,
    retry: 1,
    enabled: step === "check",
  });

  // If status loaded and doesn't need bootstrap, show "already done"
  const alreadyBootstrapped = bootstrapStatus && !bootstrapStatus.requires_bootstrap && step === "check";

  // Move to token step when data loads
  if (bootstrapStatus?.requires_bootstrap && step === "check") {
    setStep("token");
  }

  const validateMutation = useMutation({
    mutationFn: () => validateBootstrapToken(token),
    onSuccess: () => {
      setError(null);
      setStep("admin");
    },
    onError: (err: Error) => {
      setError(err.message || "Invalid bootstrap token");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      completeBootstrap({
        bootstrap_token: token,
        username,
        email,
        password,
      }),
    onSuccess: () => {
      setError(null);
      setStep("complete");
    },
    onError: (err: Error) => {
      setError(err.message || "Bootstrap failed");
    },
  });

  function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError("Please enter a bootstrap token");
      return;
    }
    validateMutation.mutate();
  }

  function handleComplete(e: React.FormEvent) {
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
    completeMutation.mutate();
  }

  return (
    <div className="flex items-start justify-center pt-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <svg className="size-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white/95">Bootstrap</h1>
          <p className="mt-1 text-sm text-white/40">
            Set up your self-hosted CIG instance
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {(["token", "admin", "complete"] as const).map((s, i) => {
            const active = step === s;
            const done =
              (s === "token" && (step === "admin" || step === "complete")) ||
              (s === "admin" && step === "complete");
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${done || active ? "bg-cyan-500/40" : "bg-white/[0.06]"}`} />}
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-colors ${
                    active
                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                      : done
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-white/[0.03] border-white/[0.08] text-white/25"
                  }`}
                >
                  {done ? (
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Checking status */}
        {step === "check" && checkLoading && (
          <div className="text-center py-12">
            <div className="inline-flex size-8 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-white/40">Checking bootstrap status...</p>
          </div>
        )}

        {/* Already bootstrapped */}
        {alreadyBootstrapped && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center size-12 rounded-full bg-emerald-500/15 border border-emerald-500/20">
              <svg className="size-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/90">Already Bootstrapped</h2>
            <p className="text-sm text-white/40">
              This CIG instance has already been configured. An admin account exists.
            </p>
          </div>
        )}

        {/* Step 1: Token */}
        {step === "token" && (
          <form onSubmit={handleValidate} className="rounded-2xl border border-white/[0.06] bg-[#0a1628]/80 p-6 space-y-5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-2">
                Bootstrap Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter the token from your CLI setup"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors font-mono"
                autoFocus
              />
              <p className="mt-2 text-[11px] text-white/25">
                The bootstrap token was generated when you first ran <code className="text-cyan-400/60">cig init</code>.
              </p>
            </div>
            <button
              type="submit"
              disabled={validateMutation.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_16px_rgba(6,182,212,0.15)] transition-all disabled:opacity-50"
            >
              {validateMutation.isPending ? "Validating..." : "Validate Token"}
            </button>
          </form>
        )}

        {/* Step 2: Admin account */}
        {step === "admin" && (
          <form onSubmit={handleComplete} className="rounded-2xl border border-white/[0.06] bg-[#0a1628]/80 p-6 space-y-4">
            <p className="text-sm text-white/50 mb-2">
              Create the first admin account for your CIG instance.
            </p>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 12 characters"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-colors"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("token")}
                className="px-4 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={completeMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_16px_rgba(6,182,212,0.15)] transition-all disabled:opacity-50"
              >
                {completeMutation.isPending ? "Creating account..." : "Create Admin Account"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Complete */}
        {step === "complete" && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-emerald-500/15 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <svg className="size-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/90">Bootstrap Complete</h2>
            <p className="text-sm text-white/40">
              Your admin account has been created. You can now sign in and start configuring CIG.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
            >
              Go to Dashboard
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
