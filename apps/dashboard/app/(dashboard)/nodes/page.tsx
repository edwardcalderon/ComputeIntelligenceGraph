"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { browserApiFetch } from "../../../lib/browserApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeListItem {
  id: string;
  hostname: string;
  os: string;
  architecture: string;
  ip_address: string;
  install_profile: string;
  mode: string;
  status: string;
  last_seen_at: string | null;
  permission_tier: number;
  cloud_provider: string | null;
  intent_id: string;
  created_at: string;
  active_connectors: string[];
}

interface NodesResponse {
  nodes: NodeListItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  online: "bg-emerald-500",
  degraded: "bg-yellow-400",
  offline: "bg-red-500",
  enrolling: "bg-gray-400",
  revoked: "bg-gray-400",
  "credential-error": "bg-gray-400",
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  online: "text-emerald-600 dark:text-emerald-400",
  degraded: "text-yellow-600 dark:text-yellow-400",
  offline: "text-red-600 dark:text-red-400",
  enrolling: "text-gray-500 dark:text-gray-400",
  revoked: "text-gray-500 dark:text-gray-400",
  "credential-error": "text-gray-500 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
  enrolling: "Enrolling",
  revoked: "Revoked",
  "credential-error": "Credential Error",
};

const TIER_LABELS: Record<number, string> = {
  0: "Tier 0 — None",
  1: "Tier 1 — Discovery",
  2: "Tier 2 — Read",
  3: "Tier 3 — Write",
  4: "Tier 4 — Admin",
};

const CLOUD_LABELS: Record<string, string> = {
  aws: "AWS",
  gcp: "GCP",
};

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const dot = STATUS_COLORS[status] ?? "bg-gray-400";
  const text = STATUS_TEXT_COLORS[status] ?? "text-gray-500 dark:text-gray-400";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${text}`}>
      <span className={`inline-block size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await browserApiFetch("/api/v1/nodes");
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? `Failed to load nodes (${res.status})`);
        return;
      }
      const data = (await res.json()) as NodesResponse;
      setNodes(data.nodes);
    } catch {
      setError("Unable to reach the API. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNodes();
  }, [fetchNodes]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-start justify-center pt-16">
        <span className="inline-flex size-6 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="w-full max-w-2xl rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-6 py-5 space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Failed to load nodes</p>
          <p className="text-sm text-red-600 dark:text-red-400/80">{error}</p>
          <button
            type="button"
            onClick={() => void fetchNodes()}
            className="px-4 py-2 rounded-xl text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (nodes.length === 0) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-cig-elevated border border-cig mb-4">
              <svg className="size-7 text-cig-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 6 0m-6 0H3m16.5 0a3 3 0 0 0 3-3m-3 3a3 3 0 1 1-6 0m6 0h1.5m-7.5 0v3.75m0-3.75a3 3 0 0 1-3-3m3 3a3 3 0 0 0 3-3m-6 0V6.75m6 7.5V6.75m0 0a3 3 0 0 0-3-3m3 3a3 3 0 0 1-3-3m0 0a3 3 0 0 1-3 3m3-3h1.5M9 6.75a3 3 0 0 0-3 3m3-3H7.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-cig-primary">No nodes yet</h1>
            <p className="mt-1 text-sm text-cig-muted">
              Onboard your first CIG Node to start discovering infrastructure.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Link
              href="/onboarding/aws"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
            >
              Connect AWS
            </Link>
            <Link
              href="/onboarding/gcp"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-cig-secondary border border-cig hover:bg-cig-hover transition-colors"
            >
              Connect GCP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Node list ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cig-primary">Nodes</h1>
          <p className="mt-0.5 text-sm text-cig-muted">
            {nodes.length} node{nodes.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/onboarding/aws"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-cyan-700 dark:text-white bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:border-cyan-500/40 transition-all"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Node
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-cig bg-cig-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cig">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
                Hostname
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cig-muted hidden sm:table-cell">
                Permission Tier
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cig-muted hidden md:table-cell">
                Cloud
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cig-muted hidden lg:table-cell">
                Last Seen
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-cig-border">
            {nodes.map((node) => (
              <tr
                key={node.id}
                className="hover:bg-cig-hover transition-colors cursor-pointer"
                onClick={() => { window.location.href = `/nodes/${node.id}`; }}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-cig-primary">{node.hostname}</div>
                  <div className="text-[11px] text-cig-muted font-mono">{node.ip_address}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={node.status} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-cig-secondary">
                  {TIER_LABELS[node.permission_tier] ?? `Tier ${node.permission_tier}`}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-cig-secondary">
                  {node.cloud_provider ? (CLOUD_LABELS[node.cloud_provider] ?? node.cloud_provider) : "—"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-cig-muted">
                  {formatLastSeen(node.last_seen_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/nodes/${node.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[12px] text-cig-muted hover:text-cig-secondary transition-colors"
                  >
                    View
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
