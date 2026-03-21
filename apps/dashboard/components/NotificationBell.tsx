"use client";

import { useState, useRef, useEffect } from "react";
import { useNotification } from "@refinedev/core";

interface Notification {
  id: string;
  message: string;
  type: "success" | "error" | "progress";
  timestamp: Date;
  read: boolean;
}

// Simple in-memory notification store — populated by useNotification interceptor
let _notifications: Notification[] = [];
let _listeners: (() => void)[] = [];

export function pushNotification(n: Omit<Notification, "id" | "timestamp" | "read">) {
  _notifications = [
    { ...n, id: crypto.randomUUID(), timestamp: new Date(), read: false },
    ..._notifications.slice(0, 49), // keep last 50
  ];
  _listeners.forEach((l) => l());
}

function useNotifications() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1);
    _listeners.push(cb);
    return () => { _listeners = _listeners.filter((l) => l !== cb); };
  }, []);
  return _notifications;
}

function markAllRead() {
  _notifications = _notifications.map((n) => ({ ...n, read: true }));
  _listeners.forEach((l) => l());
}

const TYPE_COLORS: Record<string, string> = {
  success:  "text-green-500",
  error:    "text-red-500",
  progress: "text-blue-500",
};

const TYPE_DOT: Record<string, string> = {
  success:  "bg-green-500",
  error:    "bg-red-500",
  progress: "bg-blue-500",
};

function fmtTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) setTimeout(markAllRead, 1500);
        }}
        className="relative flex items-center justify-center size-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <svg className="size-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${!n.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                >
                  <span className={`mt-1.5 size-2 rounded-full flex-shrink-0 ${TYPE_DOT[n.type]}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium ${TYPE_COLORS[n.type]}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtTime(n.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook — connect Refine's notification system to our bell.
 * Mount once inside Providers tree.
 */
export function NotificationProvider() {
  const { open: notify } = useNotification();

  // Patch the notify function to also push to our local store
  useEffect(() => {
    const origNotify = notify;

    // We use a custom event so any component can push notifications
    function handler(e: CustomEvent<{ message: string; type: "success" | "error" | "progress" }>) {
      pushNotification(e.detail);
      origNotify?.(e.detail);
    }

    window.addEventListener("cig:notify" as never, handler as EventListener);
    return () => window.removeEventListener("cig:notify" as never, handler as EventListener);
  }, [notify]);

  return null;
}

/** Dispatch a notification from anywhere without prop drilling. */
export function notifyUser(
  message: string,
  type: "success" | "error" | "progress" = "progress"
) {
  pushNotification({ message, type });
  window.dispatchEvent(new CustomEvent("cig:notify", { detail: { message, type } }));
}
