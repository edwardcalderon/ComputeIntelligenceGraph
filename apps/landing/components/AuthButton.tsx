"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth, useAuthReady, useAuthAvailable, getSupabaseClient, sendEmailOtp, verifyEmailOtp } from "@cig/auth";
import { useTranslation } from "@cig-technology/i18n/react";

/* ─── Icons ───────────────────────────────────────────────────────────── */

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ─── Shared button style ─────────────────────────────────────────────── */

const methodBtnClass =
  "w-full flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition-all hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-40 disabled:pointer-events-none";

/* ─── Modal views ─────────────────────────────────────────────────────── */
type ModalView = "methods" | "email-otp" | "cli-code" | "ssh-info";

/* ─── Sign-in modal content ──────────────────────────────────────────── */

function SignInModal({
  onClose,
  onGoogleSignIn,
  onGitHubSignIn,
}: {
  onClose: () => void;
  onGoogleSignIn: () => void;
  onGitHubSignIn: () => void;
}) {
  const [view, setView] = useState<ModalView>("methods");
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in-fast p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            {view !== "methods" && (
              <button
                onClick={() => setView("methods")}
                className="mr-1 rounded-lg p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeftIcon />
              </button>
            )}
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {view === "methods" && "Sign in to CIG"}
              {view === "email-otp" && "Email OTP"}
              {view === "cli-code" && "CLI Authentication"}
              {view === "ssh-info" && "SSH Key Auth"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {view === "methods" && (
            <MethodsView
              onGoogleSignIn={onGoogleSignIn}
              onGitHubSignIn={onGitHubSignIn}
              goTo={setView}
            />
          )}
          {view === "email-otp" && <EmailOtpView onSuccess={onClose} />}
          {view === "cli-code" && <CliCodeView />}
          {view === "ssh-info" && <SshInfoView />}
        </div>
      </div>
    </div>
  );
}

/* ─── Methods list ────────────────────────────────────────────────────── */

function MethodsView({
  onGoogleSignIn,
  onGitHubSignIn,
  goTo,
}: {
  onGoogleSignIn: () => void;
  onGitHubSignIn: () => void;
  goTo: (v: ModalView) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
        Choose how you&apos;d like to sign in to access the Dashboard, Console, and
        infrastructure tools.
      </p>

      {/* ── OAuth providers ─── */}
      <div className="flex flex-col gap-2">
        <button onClick={onGoogleSignIn} className={methodBtnClass}>
          <GoogleIcon />
          Continue with Google
        </button>
        <button onClick={onGitHubSignIn} className={methodBtnClass}>
          <GitHubIcon />
          Continue with GitHub
        </button>
      </div>

      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
        <span className="text-xs text-zinc-500 font-medium">OR</span>
        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
      </div>

      {/* ── Other methods ─── */}
      <div className="flex flex-col gap-2">
        <button onClick={() => goTo("email-otp")} className={methodBtnClass}>
          <MailIcon />
          Email OTP Code
          <span className="ml-auto text-xs text-zinc-500">Passwordless</span>
        </button>
        <button onClick={() => goTo("cli-code")} className={methodBtnClass}>
          <TerminalIcon />
          CLI Device Code
          <span className="ml-auto text-xs text-zinc-500">Terminal</span>
        </button>
        <button onClick={() => goTo("ssh-info")} className={methodBtnClass}>
          <KeyIcon />
          SSH Key
          <span className="ml-auto text-xs text-zinc-500">Local</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Email OTP flow ──────────────────────────────────────────────────── */

function EmailOtpView({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await sendEmailOtp(email);
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      await verifyEmailOtp(email, otpCode);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setVerifying(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email and we&apos;ll send you a one-time code to sign in — no
          password needed.
        </p>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={sending || !email}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-xl hover:shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? "Sending…" : "Send OTP Code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        We sent a 6-digit code to{" "}
        <span className="text-zinc-800 dark:text-zinc-200 font-medium">{email}</span>. Enter it
        below.
      </p>
      <input
        type="text"
        required
        autoFocus
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={otpCode}
        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={verifying || otpCode.length < 6}
        className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-xl hover:shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verifying ? "Verifying…" : "Verify & Sign In"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setOtpCode("");
          setError(null);
        }}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Didn&apos;t receive it? Try again
      </button>
    </form>
  );
}

/* ─── CLI Device Code flow ────────────────────────────────────────────── */

function CliCodeView() {
  const [copied, setCopied] = useState(false);
  const loginCommand = "npx @cig/cli auth login";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(loginCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [loginCommand]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Authenticate from your terminal. Run this command and follow the prompts
        to link your local machine.
      </p>
      <div className="relative group">
        <pre className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm font-mono text-cyan-600 dark:text-cyan-400 overflow-x-auto">
          <span className="text-zinc-400 dark:text-zinc-500 select-none">$ </span>
          {loginCommand}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {copied ? <CheckIcon /> : "Copy"}
        </button>
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
        <p className="font-medium text-zinc-800 dark:text-zinc-300">How it works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Run the command — it generates a one-time device code</li>
          <li>A browser window opens to confirm the code</li>
          <li>Sign in with any method (Google, email, etc.)</li>
          <li>Your CLI session is authenticated & token is cached locally</li>
        </ol>
      </div>
    </div>
  );
}

/* ─── SSH Key info ────────────────────────────────────────────────────── */

function SshInfoView() {
  const [copied, setCopied] = useState(false);
  const sshCommand = "cig auth add-key ~/.ssh/id_ed25519.pub";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sshCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sshCommand]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Register your SSH public key to authenticate with CIG infrastructure
        services — ideal for automated pipelines and local development.
      </p>
      <div className="relative group">
        <pre className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm font-mono text-cyan-600 dark:text-cyan-400 overflow-x-auto">
          <span className="text-zinc-400 dark:text-zinc-500 select-none">$ </span>
          {sshCommand}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {copied ? <CheckIcon /> : "Copy"}
        </button>
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
        <p className="font-medium text-zinc-800 dark:text-zinc-300">Supported key types</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Ed25519 (recommended)</li>
          <li>RSA (2048-bit minimum)</li>
          <li>ECDSA</li>
        </ul>
        <p className="pt-1 text-zinc-500">
          After registering, you can push configs and access CIG services
          without a browser session.
        </p>
      </div>
    </div>
  );
}

/* ─── Main AuthButton ─────────────────────────────────────────────────── */

function AuthButtonReady() {
  const { user, loading, signIn, signOutUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleGoogleSignIn = useCallback(() => {
    signIn({ provider: "google", flow: "redirect", redirectUri: window.location.origin });
    setShowModal(false);
  }, [signIn]);

  const handleGitHubSignIn = useCallback(() => {
    signIn({ provider: "github", flow: "redirect", redirectUri: window.location.origin });
    setShowModal(false);
  }, [signIn]);

  if (loading) {
    return <div className="h-10 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />;
  }

  if (user) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full border border-zinc-200 dark:border-zinc-700"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="size-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
              {(user.email?.[0] || "U").toUpperCase()}
            </div>
          )}
          <span className="text-sm text-zinc-700 dark:text-zinc-300 hidden sm:inline max-w-[140px] truncate">
            {user.email}
          </span>
          <svg className="size-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden animate-fade-in-fast">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{user.email}</p>
              {user.provider && (
                <p className="text-xs text-zinc-500 mt-0.5 capitalize">
                  via {user.provider}
                </p>
              )}
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  signOutUser();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        Sign In
      </button>

      {showModal && (
        <SignInModal
          onClose={() => setShowModal(false)}
          onGoogleSignIn={handleGoogleSignIn}
          onGitHubSignIn={handleGitHubSignIn}
        />
      )}
    </>
  );
}

function SignInButtonOnly() {
  const [showModal, setShowModal] = useState(false);

  const triggerOAuth = useCallback((provider: "google" | "github") => {
    setShowModal(false);
    const supabase = getSupabaseClient();
    if (!supabase) return;
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
  }, []);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        Sign In
      </button>
      {showModal && (
        <SignInModal
          onClose={() => setShowModal(false)}
          onGoogleSignIn={() => triggerOAuth("google")}
          onGitHubSignIn={() => triggerOAuth("github")}
        />
      )}
    </>
  );
}

export function AuthButton() {
  const ready = useAuthReady();
  const available = useAuthAvailable();

  // Not initialised yet — show nothing briefly
  if (!ready) return null;

  // Auth client not configured (missing env vars) — still show sign-in button
  // so the page doesn't look broken; useAuth() is never called here
  if (!available) return <SignInButtonOnly />;

  return <AuthButtonReady />;
}
