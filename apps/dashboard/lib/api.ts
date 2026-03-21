const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface Resource {
  id: string;
  type: string;
  provider: string;
  name: string;
  region?: string;
  state?: string;
  tags?: Record<string, string>;
}

export interface PagedResources {
  items: Resource[];
  total: number;
  hasMore: boolean;
}

export interface DiscoveryStatus {
  running: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
}

export const getResourcesPaged = (params?: string): Promise<PagedResources> =>
  apiFetch<PagedResources>(`/api/v1/resources${params ? `?${params}` : ""}`);

export const searchResources = (q: string, params?: string): Promise<PagedResources> =>
  apiFetch<PagedResources>(
    `/api/v1/resources/search?q=${encodeURIComponent(q)}${params ? `&${params}` : ""}`
  );

export const getDiscoveryStatus = (): Promise<DiscoveryStatus> =>
  apiFetch<DiscoveryStatus>("/api/v1/discovery/status");

export const triggerDiscovery = (): Promise<{ message: string }> =>
  apiFetch<{ message: string }>("/api/v1/discovery/trigger", {
    method: "POST",
  });

export const getResource = (id: string): Promise<Resource> =>
  apiFetch<Resource>(`/api/v1/resources/${encodeURIComponent(id)}`);

export interface ResourceDependencies {
  items: Resource[];
}

export const getResourceDependencies = (id: string): Promise<ResourceDependencies> =>
  apiFetch<ResourceDependencies>(`/api/v1/resources/${encodeURIComponent(id)}/dependencies`);

export const getResourceDependents = (id: string): Promise<ResourceDependencies> =>
  apiFetch<ResourceDependencies>(`/api/v1/resources/${encodeURIComponent(id)}/dependents`);

export interface CostEntry {
  resourceId: string;
  monthlyCost: number;
  currency: string;
}

export interface CostsResponse {
  items: CostEntry[];
}

export const getResourceCost = (resourceId: string): Promise<CostsResponse> =>
  apiFetch<CostsResponse>(`/api/v1/costs?resourceId=${encodeURIComponent(resourceId)}`);

export interface CostBreakdownEntry {
  name: string;
  amount: number;
  currency: string;
  percentage?: number;
}

export interface CostBreakdown {
  byProvider: CostBreakdownEntry[];
  byType: CostBreakdownEntry[];
  byRegion: CostBreakdownEntry[];
  byTag: CostBreakdownEntry[];
}

export interface CostTrendPeriod {
  total: number;
  currency: string;
  change?: number;
}

export interface ResourceCostEntry {
  resourceId: string;
  resourceName?: string;
  type?: string;
  region?: string;
  amount: number;
  currency: string;
}

export interface CostSummary {
  totalMonthlyCost: number;
  currency: string;
  breakdown: CostBreakdown;
  trends: {
    "7d": CostTrendPeriod;
    "30d": CostTrendPeriod;
    "90d": CostTrendPeriod;
  };
  resourceCosts: ResourceCostEntry[];
}

export const getCostSummary = (): Promise<CostSummary> =>
  apiFetch<CostSummary>("/api/v1/costs");

export const getCostBreakdown = (): Promise<CostBreakdown> =>
  apiFetch<CostBreakdown>("/api/v1/costs/breakdown");

export interface SecurityFinding {
  id: string;
  resourceId: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  category?: "public-access" | "encryption" | "iam" | "network" | string;
  status?: "open" | "acknowledged" | "resolved" | "false-positive";
  remediationSteps?: string;
}

export interface SecurityFindingsResponse {
  items: SecurityFinding[];
  findings?: SecurityFinding[];
  total?: number;
  score?: SecurityScore;
  scannedAt?: string;
}

export interface SecurityScore {
  score: number;
  maxScore: number;
  grade: string;
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface SecurityScanResult {
  findings: SecurityFinding[];
  score: SecurityScore;
  scannedAt: string;
}

export const getResourceSecurityFindings = (resourceId: string): Promise<SecurityFindingsResponse> =>
  apiFetch<SecurityFindingsResponse>(`/api/v1/security/findings?resourceId=${encodeURIComponent(resourceId)}`);

export const getSecurityFindings = (resourceId?: string): Promise<SecurityFindingsResponse> =>
  apiFetch<SecurityFindingsResponse>(
    `/api/v1/security/findings${resourceId ? `?resourceId=${encodeURIComponent(resourceId)}` : ""}`
  );

export const getSecurityScore = (): Promise<SecurityScore> =>
  apiFetch<SecurityScore>("/api/v1/security/score");

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  answer: string;
  cypher?: string;
  needsClarification: boolean;
  clarifyingQuestion?: string;
}

export const sendChatMessage = (message: string, sessionId: string): Promise<ChatResponse> =>
  apiFetch<ChatResponse>("/api/v1/chat", {
    method: "POST",
    body: JSON.stringify({ message, sessionId }),
  });

/* ─── Targets (managed nodes) ──────────────────────────────────────────── */

export interface ManagedTarget {
  id: string;
  hostname: string;
  os: string;
  architecture: string;
  ip_address: string;
  profile: "core" | "full";
  status: "online" | "degraded" | "offline" | "revoked";
  last_seen: string | null;
  service_status: Record<string, unknown> | null;
  system_metrics: Record<string, unknown> | null;
  cig_version: string | null;
  created_at: string;
}

export interface TargetsResponse {
  items: ManagedTarget[];
  total: number;
}

export const getTargets = (): Promise<TargetsResponse> =>
  apiFetch<TargetsResponse>("/api/v1/targets");

export const deleteTarget = (id: string): Promise<{ message: string }> =>
  apiFetch<{ message: string }>(`/api/v1/targets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export interface EnrollmentTokenResponse {
  enrollment_token: string;
  expires_at: string;
}

export const createEnrollmentToken = (): Promise<EnrollmentTokenResponse> =>
  apiFetch<EnrollmentTokenResponse>("/api/v1/targets/enrollment-token", {
    method: "POST",
  });

/* ─── Bootstrap (self-hosted setup) ────────────────────────────────────── */

export interface BootstrapStatus {
  requires_bootstrap: boolean;
}

export const getBootstrapStatus = (): Promise<BootstrapStatus> =>
  apiFetch<BootstrapStatus>("/api/v1/bootstrap/status");

export const validateBootstrapToken = (token: string): Promise<{ valid: boolean }> =>
  apiFetch<{ valid: boolean }>("/api/v1/bootstrap/validate", {
    method: "POST",
    body: JSON.stringify({ bootstrap_token: token }),
  });

export interface BootstrapCompletePayload {
  bootstrap_token: string;
  username: string;
  email: string;
  password: string;
}

export interface BootstrapCompleteResponse {
  access_token: string;
  refresh_token: string;
}

export const completeBootstrap = (
  payload: BootstrapCompletePayload
): Promise<BootstrapCompleteResponse> =>
  apiFetch<BootstrapCompleteResponse>("/api/v1/bootstrap/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
