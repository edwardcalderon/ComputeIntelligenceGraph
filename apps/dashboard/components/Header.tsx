"use client";

import { useAppStore } from "../lib/store";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { NotificationBell } from "./NotificationBell";

interface DeviceAuthResponse {
  items: Array<{ expires_at: string }>;
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function getPendingDeviceRequests(): Promise<DeviceAuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/device/pending`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export function Header() {
  const { toggleSidebar, theme, setTheme } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data } = useQuery<DeviceAuthResponse>({
    queryKey: ["device-auth", "pending"],
    queryFn: getPendingDeviceRequests,
    refetchInterval: 5_000,
    enabled: mounted,
  });

  const activeRequests = (data?.items ?? []).filter(
    (req) => new Date(req.expires_at).getTime() > Date.now()
  );
  const pendingCount = activeRequests.length;

  return (
    <header className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-[#070d1a] px-4">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="rounded-lg p-2 text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="hidden lg:block" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Device approval badge */}
        {pendingCount > 0 && (
          <Link
            href="/device-approval"
            className="relative rounded-lg p-2 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title="Pending device approvals"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center size-4 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.5)]">
              {pendingCount}
            </span>
          </Link>
        )}

        <NotificationBell />

        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle dark mode"
          className="rounded-lg p-2 text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
        >
          {theme === "dark" ? (
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
