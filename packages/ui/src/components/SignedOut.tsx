"use client";

import React from "react";

interface SignedOutProps {
  /** URL of the landing / sign-in page. Falls back to "/" if not provided. */
  signInUrl?: string;
  /** App name shown in the heading. */
  appName?: string;
}

/**
 * Shared "You've been signed out" page.
 * Framework-agnostic — works in both landing (static export) and dashboard (Next.js SSR).
 * Callers pass `signInUrl` so the button destination is always correct for the environment.
 */
export function SignedOut({
  signInUrl = "/",
  appName = "CIG",
}: SignedOutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      {/* Subtle background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-cyan-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        {/* Icon */}
        <div className="flex items-center justify-center size-16 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-lg">
          <svg
            className="size-8 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div>
          <p className="text-xs font-mono tracking-[0.25em] text-cyan-500 uppercase mb-2">
            {appName}
          </p>
          <h1 className="text-2xl font-semibold text-white">
            You&apos;ve been signed out
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xs">
            Your session has ended. Sign in again to access the dashboard.
          </p>
        </div>

        {/* CTA */}
        <a
          href={signInUrl}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg hover:bg-cyan-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          Sign in
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </a>

        {/* Footer note */}
        <p className="text-xs text-zinc-600">
          {appName} · Compute Intelligence Graph
        </p>
      </div>
    </div>
  );
}
