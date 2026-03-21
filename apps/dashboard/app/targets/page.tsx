"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface TargetNode {
  id: string;
  hostname: string;
  os: string;
  architecture: string;
  ip_address: string;
  profile: string;
  status: "online" | "degraded" | "offline" | "revoked";
  last_seen: string | null;
  cig_version: string | null;
  created_at: string;
  service_status?: Record<string, string>;
  system_metrics?: Record<string, unknown>;
}

interface TargetsResponse {
  items: TargetNode[];
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function getTargets(): Promise<TargetsResponse> {
  const res = await fetch(`${API_URL}/api/v1/targets`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function revokeTarget(targetId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/targets/${targetId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
}

function getStatusColor(
  status: "online" | "degraded" | "offline" | "revoked"
): string {
  switch (status) {
    case "online":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "degraded":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "offline":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "revoked":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
}

function getStatusDot(
  status: "online" | "degraded" | "offline" | "revoked"
): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "degraded":
      return "bg-yellow-500";
    case "offline":
      return "bg-red-500";
    case "revoked":
      return "bg-gray-500";
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString();
}

function calculateUptime(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${diffDays}d ${diffHours}h`;
}

export default function TargetsPage() {
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<TargetNode | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<TargetsResponse>({
    queryKey: ["targets"],
    queryFn: getTargets,
    refetchInterval: 30_000, // Poll every 30 seconds
  });

  const handleRevoke = async (targetId: string) => {
    if (!confirm("Are you sure you want to revoke access to this target?")) {
      return;
    }
    setRevoking(targetId);
    try {
      await revokeTarget(targetId);
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      setSelectedTarget(null);
    } catch (err) {
      console.error("Failed to revoke target:", err);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Managed Targets
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor and manage enrolled Target_Nodes
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">
            Failed to load targets. Please try again.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="rounded-md bg-blue-50 p-6 text-center dark:bg-blue-900/20">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            No targets enrolled yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Targets list */}
          <div className="lg:col-span-2">
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Hostname
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      OS
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Last Heartbeat
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(data?.items ?? []).map((target) => (
                    <tr
                      key={target.id}
                      onClick={() => setSelectedTarget(target)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {target.hostname}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {target.os}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${getStatusDot(
                              target.status
                            )}`}
                          />
                          <span
                            className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                              target.status
                            )}`}
                          >
                            {target.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(target.last_seen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel */}
          {selectedTarget && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-4 flex items-start justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedTarget.hostname}
                </h2>
                <button
                  onClick={() => setSelectedTarget(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    IP Address
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {selectedTarget.ip_address}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    Architecture
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {selectedTarget.architecture}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    Profile
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {selectedTarget.profile}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    CIG Version
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {selectedTarget.cig_version ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    Uptime
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {calculateUptime(selectedTarget.created_at)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    Status
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${getStatusDot(
                        selectedTarget.status
                      )}`}
                    />
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                        selectedTarget.status
                      )}`}
                    >
                      {selectedTarget.status}
                    </span>
                  </div>
                </div>

                {selectedTarget.status !== "revoked" && (
                  <button
                    onClick={() => handleRevoke(selectedTarget.id)}
                    disabled={revoking === selectedTarget.id}
                    className="mt-6 w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    {revoking === selectedTarget.id
                      ? "Revoking..."
                      : "Revoke Access"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
