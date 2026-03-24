import type {
  BootstrapCompletePayload,
  BootstrapCompleteResponse,
  BootstrapStatus,
  ChatResponse,
  CostBreakdown,
  CostSummary,
  CostsResponse,
  DeviceAuthResponse,
  DiscoveryStatus,
  EnrollmentTokenResponse,
  PagedResources,
  Relationship,
  Resource,
  ResourceDependencies,
  SecurityFindingsResponse,
  SecurityScore,
  SessionListResponse,
  TargetsResponse,
} from "./types";

type AccessTokenResolver = () => string | null | undefined | Promise<string | null | undefined>;

export interface CigClientOptions {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  getAccessToken?: AccessTokenResolver;
  defaultHeaders?: HeadersInit;
  fetch?: typeof fetch;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function resolveUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

async function buildErrorMessage(response: Response): Promise<string> {
  const fallback = `API error ${response.status}: ${response.statusText}`;

  try {
    const text = await response.text();
    if (!text) {
      return fallback;
    }

    try {
      const payload = JSON.parse(text) as { error?: string; message?: string };
      return payload.error ?? payload.message ?? fallback;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

export class CigClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: CigClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async resolveHeaders(headers?: HeadersInit, body?: BodyInit | null): Promise<Headers> {
    const resolvedHeaders = new Headers(this.options.defaultHeaders);

    if (headers) {
      new Headers(headers).forEach((value, key) => {
        resolvedHeaders.set(key, value);
      });
    }

    if (!resolvedHeaders.has("Content-Type") && body && !(body instanceof FormData)) {
      resolvedHeaders.set("Content-Type", "application/json");
    }

    const token = await this.options.getAccessToken?.() ?? this.options.accessToken ?? null;
    if (token && !resolvedHeaders.has("Authorization")) {
      resolvedHeaders.set("Authorization", `Bearer ${token}`);
    }

    if (this.options.apiKey && !resolvedHeaders.has("x-api-key")) {
      resolvedHeaders.set("x-api-key", this.options.apiKey);
    }

    return resolvedHeaders;
  }

  async requestRaw(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = await this.resolveHeaders(init.headers, init.body ?? null);

    return this.fetchImpl(resolveUrl(this.options.baseUrl, path), {
      ...init,
      headers,
    });
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.requestRaw(path, init);

    if (!response.ok) {
      throw new Error(await buildErrorMessage(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  getResourcesPaged(params?: string): Promise<PagedResources> {
    return this.request<PagedResources>(`/api/v1/resources${params ? `?${params}` : ""}`);
  }

  searchResources(query: string, params?: string): Promise<PagedResources> {
    return this.request<PagedResources>(
      `/api/v1/resources/search?q=${encodeURIComponent(query)}${params ? `&${params}` : ""}`
    );
  }

  getDiscoveryStatus(): Promise<DiscoveryStatus> {
    return this.request<DiscoveryStatus>("/api/v1/discovery/status");
  }

  triggerDiscovery(): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/v1/discovery/trigger", {
      method: "POST",
    });
  }

  getResource(id: string): Promise<Resource> {
    return this.request<Resource>(`/api/v1/resources/${encodeURIComponent(id)}`);
  }

  getResourceDependencies(id: string): Promise<ResourceDependencies> {
    return this.request<ResourceDependencies>(
      `/api/v1/resources/${encodeURIComponent(id)}/dependencies`
    );
  }

  getResourceDependents(id: string): Promise<ResourceDependencies> {
    return this.request<ResourceDependencies>(
      `/api/v1/resources/${encodeURIComponent(id)}/dependents`
    );
  }

  getRelationships(limit = 1000): Promise<{ items: Relationship[] }> {
    return this.request<{ items: Relationship[] }>(`/api/v1/relationships?limit=${limit}`);
  }

  getResourceCost(resourceId: string): Promise<CostsResponse> {
    return this.request<CostsResponse>(`/api/v1/costs?resourceId=${encodeURIComponent(resourceId)}`);
  }

  getCostSummary(): Promise<CostSummary> {
    return this.request<CostSummary>("/api/v1/costs");
  }

  getCostBreakdown(): Promise<CostBreakdown> {
    return this.request<CostBreakdown>("/api/v1/costs/breakdown");
  }

  getResourceSecurityFindings(resourceId: string): Promise<SecurityFindingsResponse> {
    return this.request<SecurityFindingsResponse>(
      `/api/v1/security/findings?resourceId=${encodeURIComponent(resourceId)}`
    );
  }

  getSecurityFindings(resourceId?: string): Promise<SecurityFindingsResponse> {
    const query = resourceId ? `?resourceId=${encodeURIComponent(resourceId)}` : "";
    return this.request<SecurityFindingsResponse>(`/api/v1/security/findings${query}`);
  }

  getSecurityScore(): Promise<SecurityScore> {
    return this.request<SecurityScore>("/api/v1/security/score");
  }

  sendChatMessage(message: string, sessionId: string): Promise<ChatResponse> {
    return this.request<ChatResponse>("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify({ message, sessionId }),
    });
  }

  getTargets(): Promise<TargetsResponse> {
    return this.request<TargetsResponse>("/api/v1/targets");
  }

  deleteTarget(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/targets/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  createEnrollmentToken(): Promise<EnrollmentTokenResponse> {
    return this.request<EnrollmentTokenResponse>("/api/v1/targets/enrollment-token", {
      method: "POST",
    });
  }

  getBootstrapStatus(): Promise<BootstrapStatus> {
    return this.request<BootstrapStatus>("/api/v1/bootstrap/status");
  }

  validateBootstrapToken(token: string): Promise<{ valid: boolean }> {
    return this.request<{ valid: boolean }>("/api/v1/bootstrap/validate", {
      method: "POST",
      body: JSON.stringify({ bootstrap_token: token }),
    });
  }

  completeBootstrap(payload: BootstrapCompletePayload): Promise<BootstrapCompleteResponse> {
    return this.request<BootstrapCompleteResponse>("/api/v1/bootstrap/complete", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  getPendingDeviceRequests(): Promise<DeviceAuthResponse> {
    return this.request<DeviceAuthResponse>("/api/v1/auth/device/pending");
  }

  approveDevice(userCode: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/v1/auth/device/approve", {
      method: "POST",
      body: JSON.stringify({ user_code: userCode }),
    });
  }

  denyDevice(userCode: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/v1/auth/device/deny", {
      method: "POST",
      body: JSON.stringify({ user_code: userCode }),
    });
  }

  getSessions(): Promise<SessionListResponse> {
    return this.request<SessionListResponse>("/api/v1/sessions");
  }

  revokeSession(sessionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  }
}

export function createCigClient(options: CigClientOptions): CigClient {
  return new CigClient(options);
}
