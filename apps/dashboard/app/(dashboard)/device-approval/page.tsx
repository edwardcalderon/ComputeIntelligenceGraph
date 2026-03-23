"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@cig-technology/i18n/react";
import { browserApiFetch } from "../../../lib/browserApi";

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

async function getPendingDeviceRequests(): Promise<DeviceAuthResponse> {
  const res = await browserApiFetch("/api/v1/auth/device/pending");
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

async function approveDevice(userCode: string): Promise<void> {
  const res = await browserApiFetch("/api/v1/auth/device/approve", {
    method: "POST",
    body: JSON.stringify({ user_code: userCode }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
}

async function denyDevice(userCode: string): Promise<void> {
  const res = await browserApiFetch("/api/v1/auth/device/deny", {
    method: "POST",
    body: JSON.stringify({ user_code: userCode }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "<1m left";
  return `${mins}m left`;
}

export default function DeviceApprovalPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<string | null>(null);
  const [denying, setDenying] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<DeviceAuthResponse>({
    queryKey: ["device-auth", "pending"],
    queryFn: getPendingDeviceRequests,
    refetchInterval: 5_000,
  });

  const activeRequests = (data?.items ?? []).filter(
    (req) => new Date(req.expires_at).getTime() > Date.now()
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
        <h1 className="text-2xl font-bold text-cig-primary">{t("deviceApproval.title")}</h1>
        <p className="mt-1 text-sm text-cig-secondary">
          {t("deviceApproval.subtitle")}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-400">
            {t("deviceApproval.failedToLoad")}
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-flex size-8 border-2 border-cyan-500/40 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-cig-muted">{t("deviceApproval.loading")}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && activeRequests.length === 0 && (
        <div className="rounded-xl border border-cig bg-cig-card p-10 text-center">
          <svg className="mx-auto size-10 text-cig-muted/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
          <p className="text-sm text-cig-secondary">{t("deviceApproval.noPending")}</p>
          <p className="text-xs text-cig-muted mt-1">{t("deviceApproval.requestsFromCli")}</p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && activeRequests.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeRequests.map((req) => (
            <div
              key={req.user_code}
              className="rounded-xl border border-cig bg-cig-card p-5 flex flex-col gap-4"
            >
              {/* User code — prominent */}
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-cig-muted mb-1">{t("deviceApproval.userCode")}</p>
                <p className="text-2xl font-mono font-bold tracking-[0.2em] text-cig-primary">
                  {req.user_code}
                </p>
              </div>

              {/* Details */}
              <div className="flex justify-between text-xs text-cig-secondary">
                <span className="font-mono">{req.ip_address}</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">{timeLeft(req.expires_at)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(req.user_code)}
                  disabled={approving === req.user_code}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  {approving === req.user_code ? t("deviceApproval.approving") : t("deviceApproval.approve")}
                </button>
                <button
                  onClick={() => handleDeny(req.user_code)}
                  disabled={denying === req.user_code}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {denying === req.user_code ? t("deviceApproval.denying") : t("deviceApproval.deny")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
