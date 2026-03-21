"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTargets,
  deleteTarget,
  createEnrollmentToken,
  ManagedTarget,
  TargetsResponse,
  EnrollmentTokenResponse,
} from "../../../lib/api";

type TargetStatus = ManagedTarget["status"];

const STATUS_CONFIG: Record<TargetStatus, { dot: string; badge: string; label: string }> = {
  online:   { dot: "bg-emerald-500 dark:shadow-[0_0_6px_rgba(16,185,129,0.6)]", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20", label: "Online" },
  degraded: { dot: "bg-amber-500 dark:shadow-[0_0_6px_rgba(245,158,11,0.6)]",   badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",     label: "Degraded" },
  offline:  { dot: "bg-red-500 dark:shadow-[0_0_6px_rgba(239,68,68,0.6)]",       badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20",           label: "Offline" },
  revoked:  { dot: "bg-slate-400 dark:bg-white/25",                               badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.06] dark:text-white/40 dark:border-white/[0.08]", label: "Revoked" },
};

function StatusBadge({ status }: { status: TargetStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badge}`}>
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TargetsPage() {
  const queryClient = useQueryClient();
  const [enrollToken, setEnrollToken] = useState<EnrollmentTokenResponse | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<TargetsResponse>({
    queryKey: ["targets"],
    queryFn: getTargets,
    refetchInterval: 15_000,
    retry: 1,
  });

  const revokeMutation = useMutation({
    mutationFn: deleteTarget,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["targets"] }); setRevokeId(null); },
  });

  const enrollMutation = useMutation({
    mutationFn: createEnrollmentToken,
    onSuccess: (data) => setEnrollToken(data),
  });

  const targets = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cig-primary">Targets</h1>
          <p className="mt-1 text-sm text-cig-secondary">Managed nodes enrolled in your CIG cluster</p>
        </div>
        <button
          onClick={() => enrollMutation.mutate()}
          disabled={enrollMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all disabled:opacity-50"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {enrollMutation.isPending ? "Generating..." : "Enroll Target"}
        </button>
      </div>

      {/* Enrollment token banner */}
      {enrollToken && (
        <div className="rounded-xl border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50 dark:bg-cyan-500/[0.06] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Enrollment Token Generated</p>
            <button onClick={() => setEnrollToken(null)} className="text-cig-muted hover:text-cig-secondary transition-colors">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="text-[11px] text-cig-secondary">Run this on the target machine. Token expires {new Date(enrollToken.expires_at).toLocaleString()}.</p>
          <code className="block text-xs font-mono bg-slate-100 dark:bg-black/30 rounded-lg px-3 py-2 text-cyan-700 dark:text-cyan-300 break-all select-all">
            cig enroll --token {enrollToken.enrollment_token}
          </code>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-400">Failed to load targets. The API may be unreachable.</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["online", "degraded", "offline", "revoked"] as const).map((status) => {
          const count = targets.filter((t) => t.status === status).length;
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} className="rounded-xl border border-cig bg-cig-card p-3 flex items-center gap-3">
              <span className={`size-2.5 rounded-full ${cfg.dot}`} />
              <div>
                <p className="text-lg font-semibold text-cig-primary">{count}</p>
                <p className="text-[10px] uppercase tracking-wider text-cig-muted">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-flex size-8 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-cig-muted">Loading targets...</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && targets.length === 0 && (
        <div className="rounded-xl border border-cig bg-cig-card p-10 text-center">
          <svg className="mx-auto size-10 text-cig-muted/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
          <p className="text-sm text-cig-secondary">No targets enrolled yet</p>
          <p className="text-xs text-cig-muted mt-1">Click &quot;Enroll Target&quot; to add your first node</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && targets.length > 0 && (
        <div className="rounded-xl border border-cig bg-cig-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cig">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-cig-muted">Hostname</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-cig-muted">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-cig-muted hidden sm:table-cell">OS / Arch</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-cig-muted hidden md:table-cell">IP</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-cig-muted hidden md:table-cell">Profile</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-cig-muted hidden lg:table-cell">Last Seen</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-cig-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cig">
              {targets.map((target) => (
                <tr key={target.id} className="hover:bg-cig-hover transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-cig-primary">{target.hostname}</p>
                    {target.cig_version && <p className="text-[10px] font-mono text-cig-muted mt-0.5">v{target.cig_version}</p>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={target.status} /></td>
                  <td className="px-4 py-3 text-cig-secondary hidden sm:table-cell">{target.os} / {target.architecture}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cig-muted hidden md:table-cell">{target.ip_address}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${
                      target.profile === "full"
                        ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/20"
                        : "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/20"
                    }`}>
                      {target.profile}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-cig-muted hidden lg:table-cell">{timeAgo(target.last_seen)}</td>
                  <td className="px-4 py-3 text-right">
                    {target.status !== "revoked" && (
                      <button onClick={() => setRevokeId(target.id)} className="text-xs text-red-600 dark:text-red-400/60 hover:text-red-700 dark:hover:text-red-400 transition-colors">Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revoke modal */}
      {revokeId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={() => setRevokeId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-red-200 dark:border-red-500/20 bg-cig-card p-6 shadow-xl">
              <h3 className="text-base font-semibold text-cig-primary mb-2">Revoke Target</h3>
              <p className="text-sm text-cig-secondary mb-5">This will invalidate the node identity. The target will no longer communicate with CIG.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setRevokeId(null)} className="px-4 py-2 rounded-xl text-sm text-cig-secondary hover:text-cig-primary hover:bg-cig-hover transition-colors">Cancel</button>
                <button onClick={() => revokeMutation.mutate(revokeId)} disabled={revokeMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  {revokeMutation.isPending ? "Revoking..." : "Revoke"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
