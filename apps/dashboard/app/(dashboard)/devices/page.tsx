"use client";

import { useState, useEffect, useCallback } from "react";

interface DeviceSession {
  id: string;
  device_code: string;
  device_name: string | null;
  device_os: string | null;
  device_arch: string | null;
  ip_address: string | null;
  status: string;
  last_active: string;
  created_at: string;
}

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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    revoked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? colors.expired}`}>
      {status}
    </span>
  );
}

export default function DevicesPage() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/sessions`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
      const data = await res.json();
      setSessions(data.items ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Revocation failed: ${res.status}`);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: "revoked" } : s))
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cig-primary">Devices &amp; Sessions</h1>
          <p className="mt-1 text-sm text-cig-secondary">
            Manage authenticated CLI devices and active sessions.
          </p>
        </div>
        <button
          onClick={fetchSessions}
          className="rounded-lg border border-cig px-3 py-1.5 text-sm font-medium text-cig-secondary hover:text-cig-primary hover:bg-cig-hover transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Sessions table */}
      <div className="overflow-hidden rounded-xl border border-cig bg-white dark:bg-slate-900">
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
                  Loading sessions…
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-cig-muted">
                  No device sessions found. Use <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">cig login</code> to authenticate a device.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-cig-primary">
                    {session.device_name ?? session.device_code.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-cig-secondary">
                    {[session.device_os, session.device_arch].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-cig-secondary">
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
                        onClick={() => revokeSession(session.id)}
                        className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
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
    </div>
  );
}
