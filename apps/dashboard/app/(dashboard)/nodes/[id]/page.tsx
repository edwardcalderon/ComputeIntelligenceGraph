"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { browserApiFetch, getBrowserAccessToken } from "../../../../lib/browserApi";
import { DASHBOARD_API_URL } from "../../../../lib/cigClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeDetail {
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
  nodes: NodeDetail[];
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
  0: "None",
  1: "Discovery",
  2: "Read",
  3: "Write",
  4: "Admin",
};

const TIER_DESCRIPTIONS: Record<number, string> = {
  0: "No cloud permissions granted",
  1: "Read-only infrastructure discovery",
  2: "Extended read access to resources",
  3: "Write access to manage resources",
  4: "Full administrative access",
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-cig-border last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-cig-primary text-right font-mono">{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params?.id as string | undefined;

  const [node, setNode] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const sseRef = useRef<EventSource | null>(null);

  const fetchNode = useCallback(async () => {    if (!nodeId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all nodes and find the one matching this ID
      const res = await browserApiFetch("/api/v1/nodes");
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? `Failed to load node (${res.status})`);
        return;
      }
      const data = (await res.json()) as NodesResponse;
      const found = data.nodes.find((n) => n.id === nodeId) ?? null;
      if (!found) {
        setError("Node not found");
        return;
      }
      setNode(found);
    } catch {
      setError("Unable to reach the API. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    void fetchNode();

    // Connect SSE for real-time status updates
    if (!nodeId) return;

    const token = getBrowserAccessToken();
    const sseUrl = new URL("/api/v1/nodes/sse", DASHBOARD_API_URL);
    if (token) sseUrl.searchParams.set("token", token);

    const es = new EventSource(sseUrl.toString());
    sseRef.current = es;

    es.addEventListener("node-status", (event) => {
      try {
        const data = JSON.parse(event.data as string) as { nodeId: string; status: string; timestamp: string };
        if (data.nodeId === nodeId) {
          setNode((prev) => prev ? { ...prev, status: data.status, last_seen_at: data.timestamp } : prev);
        }
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [fetchNode, nodeId]);

  async function handleRevoke() {
    if (!nodeId) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await browserApiFetch(`/api/v1/nodes/${nodeId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setRevokeError(err.error ?? `Revocation failed (${res.status})`);
        return;
      }
      // Navigate back to nodes list after successful revocation
      router.push("/nodes");
    } catch {
      setRevokeError("Unable to reach the API. Check your connection and try again.");
    } finally {
      setRevoking(false);
      setShowRevokeConfirm(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-start justify-center pt-16">
        <span className="inline-flex size-6 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error || !node) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="w-full max-w-2xl rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-6 py-5 space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            {error ?? "Node not found"}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void fetchNode()}
              className="px-4 py-2 rounded-xl text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
            >
              Retry
            </button>
            <Link
              href="/nodes"
              className="px-4 py-2 rounded-xl text-sm font-medium text-cig-muted border border-cig hover:bg-cig-hover transition-colors"
            >
              Back to Nodes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusDot = STATUS_COLORS[node.status] ?? "bg-gray-400";
  const statusText = STATUS_TEXT_COLORS[node.status] ?? "text-gray-500 dark:text-gray-400";
  const statusLabel = STATUS_LABELS[node.status] ?? node.status;
  const tierLabel = TIER_LABELS[node.permission_tier] ?? `Tier ${node.permission_tier}`;
  const tierDesc = TIER_DESCRIPTIONS[node.permission_tier] ?? "";
  const isRevoked = node.status === "revoked";

  return (
    <div className="flex items-start justify-center pt-8">
      <div className="w-full max-w-2xl space-y-6">

        {/* Back link */}
        <Link
          href="/nodes"
          className="inline-flex items-center gap-1.5 text-sm text-cig-muted hover:text-cig-secondary transition-colors"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          All Nodes
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-cig-primary">{node.hostname}</h1>
            <p className="mt-0.5 text-sm font-mono text-cig-muted">{node.id}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusText}`}>
            <span className={`inline-block size-2.5 rounded-full ${statusDot}`} />
            {statusLabel}
          </span>
        </div>

        {/* Node info */}
        <div className="rounded-2xl border border-cig bg-cig-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted mb-3">
            Node Info
          </p>
          <InfoRow label="OS" value={node.os} />
          <InfoRow label="Architecture" value={node.architecture} />
          <InfoRow label="IP Address" value={node.ip_address} />
          <InfoRow label="Mode" value={node.mode} />
          <InfoRow label="Install Profile" value={node.install_profile} />
          <InfoRow
            label="Cloud Provider"
            value={node.cloud_provider ? node.cloud_provider.toUpperCase() : "—"}
          />
          <InfoRow label="Enrolled" value={<span className="font-sans">{formatDate(node.created_at)}</span>} />
        </div>

        {/* Health status */}
        <div className="rounded-2xl border border-cig bg-cig-card p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
            Health Status
          </p>
          <div className="flex items-center gap-3">
            <span className={`inline-block size-3 rounded-full ${statusDot}`} />
            <span className={`text-base font-semibold ${statusText}`}>{statusLabel}</span>
          </div>
          <div className="text-sm text-cig-secondary">
            Last seen:{" "}
            <span className="text-cig-primary font-medium">
              {formatLastSeen(node.last_seen_at)}
            </span>
            {node.last_seen_at && (
              <span className="text-cig-muted ml-2 font-sans text-[12px]">
                ({formatDate(node.last_seen_at)})
              </span>
            )}
          </div>
        </div>

        {/* Permission tier */}
        <div className="rounded-2xl border border-cig bg-cig-card p-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
            Permission Tier
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center size-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-base font-bold text-cyan-700 dark:text-cyan-400">
              {node.permission_tier}
            </span>
            <div>
              <p className="text-sm font-semibold text-cig-primary">
                Tier {node.permission_tier} — {tierLabel}
              </p>
              <p className="text-[12px] text-cig-muted">{tierDesc}</p>
            </div>
          </div>
          {/* Tier progress bar */}
          <div className="flex gap-1 mt-2">
            {[0, 1, 2, 3, 4].map((t) => (
              <div
                key={t}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  t <= node.permission_tier
                    ? "bg-cyan-500"
                    : "bg-cig-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Active connectors */}
        <div className="rounded-2xl border border-cig bg-cig-card p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cig-muted">
            Active Connectors
          </p>
          {node.active_connectors.length === 0 ? (
            <p className="text-sm text-cig-muted">No active connectors</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {node.active_connectors.map((connector) => (
                <span
                  key={connector}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-medium bg-cig-elevated border border-cig text-cig-secondary"
                >
                  {connector}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Revoke node */}
        {!isRevoked && (
          <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.04] p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Revoke Node</p>
              <p className="text-[12px] text-red-600 dark:text-red-400/80 mt-0.5">
                Revoking this node will invalidate its credentials and stop all discovery. This action cannot be undone.
              </p>
            </div>

            {revokeError && (
              <p className="text-[12px] text-red-600 dark:text-red-400">{revokeError}</p>
            )}

            {!showRevokeConfirm ? (
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
              >
                Revoke Node
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleRevoke()}
                  disabled={revoking}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {revoking ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-flex size-3.5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                      Revoking…
                    </span>
                  ) : (
                    "Confirm Revoke"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirm(false)}
                  className="px-4 py-2 rounded-xl text-sm text-cig-muted hover:text-cig-secondary hover:bg-cig-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Already revoked notice */}
        {isRevoked && (
          <div className="rounded-2xl border border-cig bg-cig-elevated px-5 py-4">
            <p className="text-sm text-cig-muted">
              This node has been revoked and is no longer active.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
