"use client";

import { useAppStore } from "../lib/store";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslation } from "@cig-technology/i18n/react";
import { NotificationBell } from "./NotificationBell";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { getPendingDeviceRequests, type DeviceAuthResponse } from "../lib/api";

export function Header() {
  const { toggleSidebar, theme, setTheme } = useAppStore();
  const t = useTranslation();
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
    <header className="flex h-12 min-w-0 items-center justify-between border-b border-cig bg-cig-card px-3 sm:px-4">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        aria-label={t("header.toggleSidebar")}
        className="rounded-lg p-2 text-cig-muted hover:text-cig-secondary hover:bg-cig-hover transition-colors lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="hidden lg:block" />

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {pendingCount > 0 && (
          <Link
            href="/devices"
            className="relative rounded-lg p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title={t("header.pendingDeviceApprovals")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center size-4 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full">
              {pendingCount}
            </span>
          </Link>
        )}

        <NotificationBell />

        <LocaleSwitcher />

        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={t("header.toggleDarkMode")}
          className="rounded-lg p-2 text-cig-muted hover:text-cig-secondary hover:bg-cig-hover transition-colors"
        >
          {theme === "dark" ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
