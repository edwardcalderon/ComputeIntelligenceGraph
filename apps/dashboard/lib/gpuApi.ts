import { getDashboardClient } from "./cigClient";
import type {
  GpuSession,
  GpuSessionDetail,
  GpuHealthSummary,
  GpuLogEntry,
  GpuConfig,
  GpuActivityEvent,
  GpuSessionCreateRequest,
  PaginatedResponse,
} from "../types/gpu";

function getClient() {
  return getDashboardClient();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const getGpuSessions = (params?: string) =>
  getClient().request<PaginatedResponse<GpuSession>>(
    `/api/v1/gpu/sessions${params ? `?${params}` : ""}`,
  );

export const getGpuSession = (sessionId: string) =>
  getClient().request<GpuSessionDetail>(
    `/api/v1/gpu/sessions/${encodeURIComponent(sessionId)}`,
  );

export const createGpuSession = (payload: GpuSessionCreateRequest) =>
  getClient().request<GpuSession>("/api/v1/gpu/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteGpuSession = (sessionId: string) =>
  getClient().request<void>(
    `/api/v1/gpu/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );

export const restartGpuWorker = (sessionId: string) =>
  getClient().request<void>(
    `/api/v1/gpu/sessions/${encodeURIComponent(sessionId)}/restart-worker`,
    { method: "POST" },
  );

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const getGpuHealth = () =>
  getClient().request<GpuHealthSummary>("/api/v1/gpu/health");

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export const getGpuLogs = (params?: string) =>
  getClient().request<PaginatedResponse<GpuLogEntry>>(
    `/api/v1/gpu/logs${params ? `?${params}` : ""}`,
  );

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const getGpuConfig = () =>
  getClient().request<GpuConfig>("/api/v1/gpu/config");

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const getGpuActivity = (params?: string) =>
  getClient().request<PaginatedResponse<GpuActivityEvent>>(
    `/api/v1/gpu/activity${params ? `?${params}` : ""}`,
  );
