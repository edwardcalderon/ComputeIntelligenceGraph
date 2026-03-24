import { CigClient } from "@cig/sdk";

export const DASHBOARD_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function getBrowserAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return sessionStorage.getItem("cig_access_token");
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
