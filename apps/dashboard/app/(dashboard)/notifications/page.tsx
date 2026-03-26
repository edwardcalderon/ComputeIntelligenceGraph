"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@cig-technology/i18n/react";
import {
  useNotifications,
  clearNotification,
  clearAll,
  markAllRead,
  fmtTime,
  type Notification,
} from "../../../components/NotificationBell";

type FilterType = "all" | "success" | "error" | "progress";

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

export default function NotificationsPage() {
  const t = useTranslation();
  const notifications = useNotifications();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const unread = notifications.filter((n) => !n.read).length;

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: t("notifications.filterAll") },
    { key: "success", label: t("notifications.filterSuccess") },
    { key: "error", label: t("notifications.filterError") },
    { key: "progress", label: t("notifications.filterProgress") },
  ];

  const filtered = useMemo(() => {
    let list = notifications;
    if (filter !== "all") list = list.filter((n) => n.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.message.toLowerCase().includes(q));
    }
    return list;
  }, [notifications, filter, search]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cig-primary">
            {t("notifications.pageTitle")}
          </h1>
          <p className="mt-0.5 text-sm text-cig-muted">
            {t("notifications.pageSubtitle")}
          </p>
        </div>
        {notifications.length > 0 && (
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            {unread > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
                {unread} {t("notifications.unread")}
              </span>
            )}
            <button
              onClick={markAllRead}
              className="text-xs text-cig-secondary hover:text-cig-primary transition-colors"
            >
              {t("notifications.markAllRead")}
            </button>
            <span className="text-cig-muted">·</span>
            <button
              onClick={clearAll}
              className="text-xs text-cig-secondary hover:text-red-500 transition-colors"
            >
              {t("notifications.clearAll")}
            </button>
          </div>
        )}
      </div>

      {/* Search + filters */}
      <div className="mb-4 rounded-xl border border-cig bg-cig-card p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cig-muted"
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
            className="w-full rounded-lg border border-cig bg-cig-elevated pl-9 pr-8 py-2 text-sm text-cig-primary placeholder-cig-muted outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cig-muted hover:text-cig-primary"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === key
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "text-cig-secondary hover:bg-cig-hover hover:text-cig-primary border border-cig",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      <div className="rounded-xl border border-cig bg-cig-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-cig-muted">
            <svg
              className="mx-auto mb-3 size-10 text-cig-muted/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
              />
            </svg>
            {search || filter !== "all"
              ? t("notifications.noResults")
              : t("notifications.noNotifications")}
          </div>
        ) : (
          <ul className="divide-y divide-cig">
            {filtered.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onDismiss={() => clearNotification(n.id)}
                typeLabel={t(`notifications.type${n.type.charAt(0).toUpperCase()}${n.type.slice(1)}` as never)}
              />
            ))}
          </ul>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-3 text-center text-xs text-cig-muted">
          {filtered.length} / {notifications.length}
        </p>
      )}
    </div>
  );
}

function NotificationRow({
  notification: n,
  onDismiss,
  typeLabel,
}: {
  notification: Notification;
  onDismiss: () => void;
  typeLabel: string;
}) {
  return (
    <li
      className={`group flex items-start gap-4 px-5 py-4 transition-colors ${
        !n.read ? "bg-blue-50/40 dark:bg-blue-950/10" : "hover:bg-cig-hover"
      }`}
    >
      <span className={`mt-1.5 size-2.5 rounded-full flex-shrink-0 ${TYPE_DOT[n.type]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-cig-primary leading-snug">{n.message}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_BADGE[n.type]}`}>
            {typeLabel}
          </span>
          <span className="text-xs text-cig-muted">{fmtTime(n.timestamp)}</span>
          {!n.read && (
            <span className="size-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 rounded p-1 text-cig-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        aria-label="Dismiss"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}
