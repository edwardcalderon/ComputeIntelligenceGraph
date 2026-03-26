export interface ApiResponse<T> {
  data: T;
  error?: string;
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

export interface ChatHealthStatus {
  provider: "openai" | "fallback";
  model: string;
  configured: boolean;
  reachable: boolean;
  providerReachable: boolean;
  checkedAt: string;
  latencyMs: number | null;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  timestamp: string;
  chat: ChatHealthStatus;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
}

export interface Relationship {
  sourceId: string;
  targetId: string;
  type: string;
}

export interface ResourceDependencies {
  items: Resource[];
}

export interface CostEntry {
  resourceId: string;
  monthlyCost: number;
  currency: string;
}

export interface CostsResponse {
  items: CostEntry[];
}

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

export interface EnrollmentTokenResponse {
  enrollment_token: string;
  expires_at: string;
}

export interface BootstrapStatus {
  requires_bootstrap: boolean;
  mode: "managed" | "self-hosted";
}

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

export interface DeviceSession {
  id: string;
  device_code: string;
  device_name: string | null;
  device_os: string | null;
  device_arch: string | null;
  ip_address: string | null;
  status: string;
  last_active: string;
  created_at: string;
}

export interface SessionListResponse {
  items: DeviceSession[];
  total: number;
}

export interface DeviceAuthRequest {
  device_code: string;
  user_code: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
}

export interface DeviceAuthResponse {
  items: DeviceAuthRequest[];
  total: number;
}
