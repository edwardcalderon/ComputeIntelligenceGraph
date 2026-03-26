import { CigClient } from "@cig/sdk";

export const DASHBOARD_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";

function clearExpiredBrowserSession(): void {
  try {
    sessionStorage.removeItem("cig_access_token");
    sessionStorage.removeItem("cig_id_token");
    sessionStorage.removeItem("cig_refresh_token");
    sessionStorage.removeItem("cig_expires_in");
    sessionStorage.removeItem("cig_expires_at");
    sessionStorage.removeItem("cig_auth_source");
    sessionStorage.removeItem("cig_social_provider");
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch {
    // ignore
  }
}

export function getBrowserAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (expiresAt && Date.now() > Number.parseInt(expiresAt, 10)) {
      clearExpiredBrowserSession();
      return null;
    }

    const authSource = sessionStorage.getItem("cig_auth_source");
    const accessToken = sessionStorage.getItem("cig_access_token");
    const idToken = sessionStorage.getItem("cig_id_token");

    if (authSource === "authentik" && idToken) {
      return idToken;
    }

    return accessToken ?? idToken;
  } catch {
    return null;
  }
}

let dashboardClient: CigClient | null = null;

export function getDashboardClient(): CigClient {
  if (!dashboardClient) {
    dashboardClient = new CigClient({
      baseUrl: DASHBOARD_API_URL,
      getAccessToken: getBrowserAccessToken,
    });
  }

  return dashboardClient;
}
