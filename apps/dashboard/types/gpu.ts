/** Generic paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Session status values matching gpu-orchestrator SessionStatus */
export type GpuSessionStatus =
  | "creating"
  | "connected"
  | "running"
  | "disconnected"
  | "error"
  | "terminated";

/** Session summary for the sessions list */
export interface GpuSession {
  sessionId: string;
  status: GpuSessionStatus;
  provider: string;
  models: string[];
  createdAt: string;
  lastVerifiedAt: string;
  uptimeSeconds: number;
  healthStatus: "healthy" | "unhealthy" | "no_data";
}

/** Health dimension result */
export interface GpuHealthDimension {
  healthy: boolean;
  latencyMs: number;
}

/** Session health dimension with status string */
export interface GpuSessionHealthDimension extends GpuHealthDimension {
  status: string;
}

/** Worker heartbeat health dimension */
export interface GpuWorkerHeartbeatDimension extends GpuHealthDimension {
  lastHeartbeatAt?: string;
  ageSeconds?: number;
}

/** Full health check result for a session */
export interface GpuHealthCheck {
  timestamp: string;
  sessionId: string;
  checks: {
    session: GpuSessionHealthDimension;
    workerHeartbeat: GpuWorkerHeartbeatDimension;
  };
  overall: boolean;
}

/** Recovery state for unhealthy sessions */
export interface GpuRecoveryState {
  actionType: "restart_worker" | "recreate_session" | "enter_dormant";
  consecutiveFailures: number;
  nextRetryAt: string;
}

/** Detailed session view (single session) */
export interface GpuSessionDetail {
  sessionId: string;
  status: GpuSessionStatus;
  provider: string;
  models: string[];
  createdAt: string;
  lastVerifiedAt: string;
  ttlExpiry: string;
  uptimeSeconds: number;
  healthCheck: GpuHealthCheck | null;
  recoveryState: GpuRecoveryState | null;
  recentLogs: GpuLogEntry[];
}

/** Per-session health card data */
export interface GpuSessionHealth {
  sessionId: string;
  healthStatus: "healthy" | "unhealthy" | "no_data";
  healthCheck: GpuHealthCheck | null;
  recoveryState: GpuRecoveryState | null;
  lastCheckTimestamp: string | null;
}

/** Aggregate health summary */
export interface GpuHealthSummary {
  totalHealthy: number;
  totalUnhealthy: number;
  totalNoData: number;
  oldestHeartbeatAgeSeconds: number | null;
  sessions: GpuSessionHealth[];
}

/** Log level values */
export type GpuLogLevel = "debug" | "info" | "warn" | "error";

/** Structured log entry */
export interface GpuLogEntry {
  id: string;
  timestamp: string;
  level: GpuLogLevel;
  component: string;
  sessionId: string | null;
  message: string;
  details?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

/** Orchestrator config (redacted) */
export interface GpuConfig {
  providerSettings: GpuConfigEntry[];
  awsSettings: GpuConfigEntry[];
  healthCheckSettings: GpuConfigEntry[];
  loggingSettings: GpuConfigEntry[];
}

export interface GpuConfigEntry {
  key: string;
  value: string;
  redacted: boolean;
}

/** Activity event types */
export type GpuActivityEventType =
  | "session_created"
  | "session_terminated"
  | "session_rotated"
  | "health_check_failed"
  | "recovery_triggered"
  | "worker_restarted"
  | "config_changed";

/** Activity timeline event */
export interface GpuActivityEvent {
  id: string;
  timestamp: string;
  eventType: GpuActivityEventType;
  sessionId: string | null;
  description: string;
}

/** Request body for creating a new session */
export interface GpuSessionCreateRequest {
  provider: "colab" | "local";
  modelNames: string[];
  configOverrides?: Record<string, string>;
}

/** Setup phases for session creation progress */
export type GpuSetupPhase =
  | "uploading_notebook"
  | "connecting_runtime"
  | "installing_ollama"
  | "pulling_models"
  | "starting_worker";
