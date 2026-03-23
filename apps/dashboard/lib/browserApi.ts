const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function getBrowserAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return sessionStorage.getItem("cig_access_token");
  } catch {
    return null;
  }
}

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
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: buildBrowserApiHeaders(init.headers),
  });
}
