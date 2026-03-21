"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DeviceAuthRequest {
  device_code: string;
  user_code: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
}

interface DeviceAuthResponse {
  items: DeviceAuthRequest[];
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function getPendingDeviceRequests(): Promise<DeviceAuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/device/pending`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function approveDevice(userCode: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/device/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ user_code: userCode }),
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
}

async function denyDevice(userCode: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/device/deny`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ user_code: userCode }),
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export default function DeviceApprovalPage() {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<string | null>(null);
  const [denying, setDenying] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<DeviceAuthResponse>({
    queryKey: ["device-auth", "pending"],
    queryFn: getPendingDeviceRequests,
    refetchInterval: 5_000, // Poll every 5 seconds
  });

  // Filter out expired records
  const activeRequests = (data?.items ?? []).filter(
    (req) => !isExpired(req.expires_at)
  );

  const handleApprove = async (userCode: string) => {
    setApproving(userCode);
    try {
      await approveDevice(userCode);
      queryClient.invalidateQueries({ queryKey: ["device-auth"] });
    } catch (err) {
      console.error("Failed to approve device:", err);
    } finally {
      setApproving(null);
    }
  };

  const handleDeny = async (userCode: string) => {
    setDenying(userCode);
    try {
      await denyDevice(userCode);
      queryClient.invalidateQueries({ queryKey: ["device-auth"] });
    } catch (err) {
      console.error("Failed to deny device:", err);
    } finally {
      setDenying(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Device Approval
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Approve or deny pending device authorization requests
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">
            Failed to load pending requests. Please try again.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : activeRequests.length === 0 ? (
        <div className="rounded-md bg-blue-50 p-6 text-center dark:bg-blue-900/20">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            No pending device authorization requests
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  User Code
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Requested At
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {activeRequests.map((req) => (
                <tr
                  key={req.user_code}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {req.user_code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {req.ip_address}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(req.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req.user_code)}
                        disabled={approving === req.user_code}
                        className="rounded-md bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
                      >
                        {approving === req.user_code ? "Approving..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleDeny(req.user_code)}
                        disabled={denying === req.user_code}
                        className="rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
                      >
                        {denying === req.user_code ? "Denying..." : "Deny"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
