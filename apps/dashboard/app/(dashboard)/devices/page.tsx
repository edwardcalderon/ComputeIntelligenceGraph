"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@cig-technology/i18n/react";
import {
  approveDevice,
  denyDevice,
  getPendingDeviceRequests,
  getSessions,
  revokeSession as revokeDeviceSession,
  type DeviceAuthResponse,
  type DeviceSession,
} from "../../../lib/api";
import { getBrowserAccessToken } from "../../../lib/cigClient";

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "<1m left";
  return `${mins}m left`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    revoked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? colors.expired}`}
    >
      {status}
    </span>
  );
}

export default function DevicesPage() {
  const t = useTranslation();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [denying, setDenying] = useState<string | null>(null);

  const {
    data,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery<DeviceAuthResponse>({
    queryKey: ["device-auth", "pending"],
    queryFn: getPendingDeviceRequests,
    refetchInterval: (query) => (query.state.error ? false : 5_000),
    retry: false,
    enabled: Boolean(getBrowserAccessToken()),
  });

  const fetchSessions = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const payload = await getSessions();
      setSessions(payload.items ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions(true);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && getBrowserAccessToken()) {
        void fetchSessions();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchSessions]);

  const activeRequests = (data?.items ?? []).filter(
    (req) => new Date(req.expires_at).getTime() > Date.now()
  );

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSessions(), refetchPending()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApprove = async (userCode: string) => {
    setApproving(userCode);
    try {
      await approveDevice(userCode);
      await Promise.all([fetchSessions(), refetchPending()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApproving(null);
    }
  };

  const handleDeny = async (userCode: string) => {
    setDenying(userCode);
    try {
      await denyDevice(userCode);
      await refetchPending();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDenying(null);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeDeviceSession(sessionId);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, status: "revoked" } : session
        )
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cig-primary">Devices</h1>
          <p className="mt-1 text-sm text-cig-secondary">
            Approve CLI device logins and manage active device sessions from one view.
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="rounded-lg border border-cig px-3 py-1.5 text-sm font-medium text-cig-secondary transition-colors hover:bg-cig-hover hover:text-cig-primary"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-cig bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-cig px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-cig-primary">{t("deviceApproval.title")}</h2>
            <p className="mt-1 text-sm text-cig-secondary">{t("deviceApproval.subtitle")}</p>
          </div>
          <div className="inline-flex w-fit items-center rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
            {activeRequests.length} pending
          </div>
        </div>

        {pendingError && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {t("deviceApproval.failedToLoad")}
          </div>
        )}

        {pendingLoading && !data ? (
          <div className="px-5 py-12 text-center">
            <div className="mb-3 inline-flex size-8 animate-spin rounded-full border-2 border-cyan-500/40 border-t-transparent" />
            <p className="text-sm text-cig-muted">{t("deviceApproval.loading")}</p>
          </div>
        ) : activeRequests.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <svg
              className="mx-auto mb-3 size-10 text-cig-muted/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
              />
            </svg>
            <p className="text-sm text-cig-secondary">{t("deviceApproval.noPending")}</p>
            <p className="mt-1 text-xs text-cig-muted">{t("deviceApproval.requestsFromCli")}</p>
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {activeRequests.map((req) => (
              <div
                key={req.user_code}
                className="flex flex-col gap-4 rounded-xl border border-cig bg-cig-card p-5"
              >
                <div className="text-center">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cig-muted">
                    {t("deviceApproval.userCode")}
                  </p>
                  <p className="text-2xl font-bold tracking-[0.2em] text-cig-primary">
                    {req.user_code}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-cig-secondary">
                  <span className="font-mono">{req.ip_address}</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {timeLeft(req.expires_at)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(req.user_code)}
                    disabled={approving === req.user_code}
                    className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                  >
                    {approving === req.user_code
                      ? t("deviceApproval.approving")
                      : t("deviceApproval.approve")}
                  </button>
                  <button
                    onClick={() => handleDeny(req.user_code)}
                    disabled={denying === req.user_code}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    {denying === req.user_code
                      ? t("deviceApproval.denying")
                      : t("deviceApproval.deny")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-cig bg-white dark:bg-slate-900">
        <div className="border-b border-cig px-5 py-4">
          <h2 className="text-lg font-semibold text-cig-primary">Active Sessions</h2>
          <p className="mt-1 text-sm text-cig-secondary">
            Review approved devices, their recent activity, and revoke access when needed.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-cig">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cig-muted">
                  Device
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cig-muted">
                  OS / Arch
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cig-muted">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cig-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cig-muted">
                  Last Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cig-muted">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cig-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cig">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-cig-muted">
                    Loading sessions...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-cig-muted">
                    No device sessions found. Use{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                      cig login
                    </code>{" "}
                    to authenticate a device.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-cig-primary">
                      {session.device_name ?? session.device_code.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-cig-secondary">
                      {[session.device_os, session.device_arch].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-cig-secondary">
                      {session.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-cig-secondary">
                      {formatRelativeTime(session.last_active)}
                    </td>
                    <td className="px-4 py-3 text-sm text-cig-secondary">
                      {new Date(session.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.status === "active" && (
                        <button
                    onClick={() => handleRevokeSession(session.id)}
                          className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
