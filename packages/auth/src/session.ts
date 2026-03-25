"use client";

const DEFAULT_API_URL = "https://api.cig.technology";

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL).replace(/\/$/, "");
}

/**
 * Best-effort session revocation through the API logout route.
 *
 * This keeps browser logout flows off Authentik's cross-origin revoke endpoint,
 * which avoids CORS noise while still letting the API revoke the token server-side.
 */
export async function revokeSessionViaApi(token?: string | null): Promise<void> {
  if (!token) return;

  await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    keepalive: true,
  }).catch(() => {
    // Logout should remain best-effort. The local session is cleared regardless.
  });
}
