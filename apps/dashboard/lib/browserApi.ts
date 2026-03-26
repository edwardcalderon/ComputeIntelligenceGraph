import { DASHBOARD_API_URL, getBrowserAccessToken, getDashboardClient } from "./cigClient";

export { getBrowserAccessToken };

export function buildBrowserApiHeaders(headers?: HeadersInit): Headers {
  const resolvedHeaders = new Headers(headers);

  if (!resolvedHeaders.has("Content-Type")) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  const token = getBrowserAccessToken();
  if (token && !resolvedHeaders.has("Authorization")) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  return resolvedHeaders;
}

export async function browserApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return getDashboardClient().requestRaw(path, init);
}

export function buildAuthenticatedWebSocketUrl(path = "/ws"): string | null {
  const token = getBrowserAccessToken();
  if (!token) {
    return null;
  }

  try {
    const url = new URL(DASHBOARD_API_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = path.startsWith("/") ? path : `/${path}`;
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}
