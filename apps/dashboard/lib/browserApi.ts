import { getBrowserAccessToken, getDashboardClient } from "./cigClient";

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
