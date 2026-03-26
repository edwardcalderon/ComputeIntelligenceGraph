"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useNotification } from "@refinedev/core";
import { useTranslation } from "@cig-technology/i18n/react";

// ─── Shared in-memory store ───────────────────────────────────────────────────

export interface Notification {
  id: string;
  message: string;
  type: "success" | "error" | "progress";
  timestamp: Date;
  read: boolean;
}

type FilterType = "all" | "success" | "error" | "progress";

type NotificationEventDetail = {
  message: string;
  type: "success" | "error" | "progress";
  source?: "notifyUser" | "refine";
};

// Simple in-memory notification store — populated by useNotification interceptor
let _notifications: Notification[] = [];
let _listeners: (() => void)[] = [];

function broadcast() {
  _listeners.forEach((l) => l());
}

export function pushNotification(n: Omit<Notification, "id" | "timestamp" | "read">) {
  _notifications = [
    { ...n, id: crypto.randomUUID(), timestamp: new Date(), read: false },
    ..._notifications.slice(0, 49),
  ];
  broadcast();
}

export function markAllRead() {
  _notifications = _notifications.map((n) => ({ ...n, read: true }));
  broadcast();
}

export function clearNotification(id: string) {
  _notifications = _notifications.filter((n) => n.id !== id);
  broadcast();
}

export function clearAll() {
  _notifications = [];
  broadcast();
}

export function markAsUnread(id: string) {
  _notifications = _notifications.map((n) => (n.id === id ? { ...n, read: false } : n));
  broadcast();
}

export function useNotifications() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1);
    _listeners.push(cb);
    return () => {
      _listeners = _listeners.filter((l) => l !== cb);
    };
  }, []);
  return _notifications;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_DOT: Record<string, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
  progress: "bg-blue-500",
};

const TYPE_BADGE: Record<string, string> = {
  success: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  error: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  progress: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export function fmtTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Bell dropdown ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const notifications = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Mark all read 1.5 s after opening
  useEffect(() => {
    if (open && unread > 0) {
      const t = setTimeout(markAllRead, 1500);
      return () => clearTimeout(t);
    }
  }, [open, unread]);

  const filtered = useMemo(() => {
    let list = notifications;
    if (filter !== "all") list = list.filter((n) => n.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.message.toLowerCase().includes(q));
    }
    return list;
  }, [notifications, filter, search]);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: t("notifications.filterAll") },
    { key: "success", label: t("notifications.filterSuccess") },
    { key: "error", label: t("notifications.filterError") },
    { key: "progress", label: t("notifications.filterProgress") },
  ];

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center size-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={t("notifications.title")}
      >
        <svg
          className="size-5 text-gray-600 dark:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 sm:hidden" aria-hidden="true" />
      )}

      {/* Dropdown panel — full-width sheet on mobile, anchored popover on sm+ */}
      {open && (
        <div className="fixed left-2 right-2 top-14 z-50 rounded-xl border border-cig bg-cig-card shadow-xl flex flex-col overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96 sm:inset-x-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-cig">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-cig-primary">
                {t("notifications.title")}
              </span>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  {unread} {t("notifications.unread")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-cig-secondary hover:text-cig-primary transition-colors"
                  >
                    {t("notifications.markAllRead")}
                  </button>
                  <span className="text-cig-muted">·</span>
                  <button
                    onClick={clearAll}
                    className="text-[11px] text-cig-secondary hover:text-red-500 transition-colors"
                  >
                    {t("notifications.clearAll")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pt-2.5 pb-1.5">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-cig-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("notifications.searchPlaceholder")}
                className="w-full rounded-lg border border-cig bg-cig-elevated pl-7 pr-7 py-1.5 text-xs text-cig-primary placeholder-cig-muted outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-cig-muted hover:text-cig-primary"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-3 pb-2">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={[
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  filter === key
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    : "text-cig-secondary hover:bg-cig-hover hover:text-cig-primary",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[55vh] sm:max-h-72 overflow-y-auto divide-y divide-cig">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-cig-muted">
                {search || filter !== "all"
                  ? t("notifications.noResults")
                  : t("notifications.noNotifications")}
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                    !n.read ? "bg-blue-50/40 dark:bg-blue-950/10" : "hover:bg-cig-hover"
                  }`}
                >
                  <span className={`mt-1.5 size-2 rounded-full flex-shrink-0 ${TYPE_DOT[n.type]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-cig-primary leading-snug">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[n.type]}`}
                      >
                        {t(`notifications.type${n.type.charAt(0).toUpperCase()}${n.type.slice(1)}` as never)}
                      </span>
                      <span className="text-[10px] text-cig-muted">{fmtTime(n.timestamp)}</span>
                    </div>
                  </div>
                  <div className="mt-0.5 flex-shrink-0 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {n.read && (
                      <button
                        onClick={() => markAsUnread(n.id)}
                        className="text-[9px] text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 whitespace-nowrap transition-colors"
                        aria-label="Mark as unread"
                      >
                        Mark unread
                      </button>
                    )}
                    <button
                      onClick={() => clearNotification(n.id)}
                      className="text-cig-muted hover:text-red-500 transition-colors"
                      aria-label="Dismiss"
                    >
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer link */}
          <div className="border-t border-cig px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t("notifications.viewAll")}
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider() {
  const { open: notify } = useNotification();

  useEffect(() => {
    const origNotify = notify;

    // We use a custom event so any component can push notifications
    function handler(event: Event) {
      const detail = (event as CustomEvent<NotificationEventDetail>).detail;

      if (detail.source === "notifyUser") {
        return;
      }

      pushNotification(detail);
      origNotify?.({ message: detail.message, type: detail.type });
    }
    window.addEventListener("cig:notify" as never, handler as EventListener);
    return () => window.removeEventListener("cig:notify" as never, handler as EventListener);
  }, [notify]);

  return null;
}

export function notifyUser(
  message: string,
  type: "success" | "error" | "progress" = "progress"
) {
  pushNotification({ message, type });
  window.dispatchEvent(
    new CustomEvent("cig:notify", {
      detail: { message, type, source: "notifyUser" },
    })
  );
}
