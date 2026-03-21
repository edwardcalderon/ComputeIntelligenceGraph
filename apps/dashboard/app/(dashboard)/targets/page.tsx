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
  online:   { dot: "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", label: "Online" },
  degraded: { dot: "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]",   badge: "bg-amber-500/15 text-amber-400 border-amber-500/20",     label: "Degraded" },
  offline:  { dot: "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]",      badge: "bg-red-500/15 text-red-400 border-red-500/20",           label: "Offline" },
  revoked:  { dot: "bg-white/25",                                            badge: "bg-white/[0.06] text-white/40 border-white/[0.08]",     label: "Revoked" },
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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TargetsPage() {
  const queryClient = useQueryClient();
  const [enrollToken, setEnrollToken] = useState<EnrollmentTokenResponse | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TargetsResponse>({
    queryKey: ["targets"],
    queryFn: getTargets,
    refetchInterval: 15_000,
  });

  const revokeMutation = useMutation({
    mutationFn: deleteTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      setRevokeId(null);
    },
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
          <h1 className="text-2xl font-bold text-white/95">Targets</h1>
          <p className="mt-1 text-sm text-white/40">
            Managed nodes enrolled in your CIG cluster
          </p>
        </div>
        <button
          onClick={() => enrollMutation.mutate()}
          disabled={enrollMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_16px_rgba(6,182,212,0.15)] transition-all disabled:opacity-50"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {enrollMutation.isPending ? "Generating..." : "Enroll Target"}
        </button>
      </div>

      {/* Enrollment token banner */}
      {enrollToken && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-cyan-400">Enrollment Token Generated</p>
            <button
              onClick={() => setEnrollToken(null)}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-white/40">
            Run this on the target machine. Token expires{" "}
            {new Date(enrollToken.expires_at).toLocaleString()}.
          </p>
          <code className="block text-xs font-mono bg-black/30 rounded-lg px-3 py-2 text-cyan-300 break-all select-all">
            cig enroll --token {enrollToken.enrollment_token}
          </code>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["online", "degraded", "offline", "revoked"] as const).map((status) => {
          const count = targets.filter((t) => t.status === status).length;
          const cfg = STATUS_CONFIG[status];
          return (
            <div
              key={status}
              className="rounded-xl border border-white/[0.06] bg-[#0a1628]/80 p-3 flex items-center gap-3"
            >
              <span className={`size-2.5 rounded-full ${cfg.dot}`} />
              <div>
                <p className="text-lg font-semibold text-white/90">{count}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/30">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0a1628]/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Hostname</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden sm:table-cell">OS / Arch</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">IP</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Profile</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden lg:table-cell">Last Seen</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-white/30">
                    <div className="size-4 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin" />
                    Loading targets...
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && targets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="size-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    </svg>
                    <p className="text-sm text-white/30">No targets enrolled yet</p>
                    <p className="text-xs text-white/20">Click &quot;Enroll Target&quot; to add your first node</p>
                  </div>
                </td>
              </tr>
            )}
            {targets.map((target) => (
              <tr key={target.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white/80">{target.hostname}</p>
                    {target.cig_version && (
                      <p className="text-[10px] font-mono text-white/25 mt-0.5">v{target.cig_version}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={target.status} />
                </td>
                <td className="px-4 py-3 text-white/50 hidden sm:table-cell">
                  {target.os} / {target.architecture}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/40 hidden md:table-cell">
                  {target.ip_address}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                    target.profile === "full"
                      ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                      : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                  }`}>
                    {target.profile}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-white/35 hidden lg:table-cell">
                  {timeAgo(target.last_seen)}
                </td>
                <td className="px-4 py-3 text-right">
                  {target.status !== "revoked" && (
                    <button
                      onClick={() => setRevokeId(target.id)}
                      className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revoke confirmation modal */}
      {revokeId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setRevokeId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0e1a30] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
              <h3 className="text-base font-semibold text-white/90 mb-2">Revoke Target</h3>
              <p className="text-sm text-white/50 mb-5">
                This will invalidate the node identity. The target will no longer be able to communicate with CIG.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setRevokeId(null)}
                  className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => revokeMutation.mutate(revokeId)}
                  disabled={revokeMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
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
