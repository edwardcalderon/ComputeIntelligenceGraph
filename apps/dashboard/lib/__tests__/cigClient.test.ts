import { getSupabaseClient } from "@cig/auth";
import {
  getBrowserAccessToken,
  resolveDashboardAccessToken,
  storeBrowserSession,
  syncSupabaseSessionToBrowserStorage,
} from "../cigClient";

jest.mock("@cig/auth", () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function makeJwt(issuer: string): string {
  const payload = Buffer.from(JSON.stringify({ iss: issuer }), "utf8").toString("base64url");
  return `header.${payload}.signature`;
}

describe("dashboard cigClient token resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  });

  it("prefers the Authentik id token when available", () => {
    sessionStorage.setItem("cig_access_token", "access-token");
    sessionStorage.setItem("cig_id_token", "id-token");
    sessionStorage.setItem("cig_auth_source", "authentik");
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    expect(getBrowserAccessToken()).toBe("id-token");
  });

  it("returns the access token for non-Authentik sessions", () => {
    sessionStorage.setItem("cig_access_token", "access-token");
    sessionStorage.setItem("cig_id_token", "id-token");
    sessionStorage.setItem("cig_auth_source", "supabase");
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    expect(getBrowserAccessToken()).toBe("access-token");
  });

  it("prefers the JWT issuer over a stale explicit auth source tag", () => {
    sessionStorage.setItem("cig_access_token", makeJwt("https://project.supabase.co/auth/v1"));
    sessionStorage.setItem("cig_auth_source", "authentik");
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    expect(getBrowserAccessToken()).toBe(sessionStorage.getItem("cig_access_token"));
  });

  it("syncs the live Supabase session into browser storage", () => {
    syncSupabaseSessionToBrowserStorage({
      access_token: "supabase-access-token",
      refresh_token: "supabase-refresh-token",
      expires_in: 1800,
      expires_at: Math.floor(Date.now() / 1000) + 1800,
      user: {
        app_metadata: { provider: "email" },
      },
    } as never);

    expect(sessionStorage.getItem("cig_access_token")).toBe("supabase-access-token");
    expect(sessionStorage.getItem("cig_refresh_token")).toBe("supabase-refresh-token");
    expect(sessionStorage.getItem("cig_auth_source")).toBe("supabase");
    expect(sessionStorage.getItem("cig_social_provider")).toBe("email");
    expect(document.cookie).toContain("cig_has_session=1");
  });

  it("stores a bootstrap session using the dashboard session keys", () => {
    storeBrowserSession({
      accessToken: "bootstrap-access-token",
      authSource: "authentik",
    });

    expect(sessionStorage.getItem("cig_access_token")).toBe("bootstrap-access-token");
    expect(sessionStorage.getItem("cig_auth_source")).toBe("authentik");
    expect(localStorage.getItem("cig-access-token")).toBeNull();
    expect(document.cookie).toContain("cig_has_session=1");
  });

  it("migrates the legacy bootstrap token into the dashboard session store", () => {
    localStorage.setItem("cig-access-token", "legacy-bootstrap-token");

    expect(getBrowserAccessToken()).toBe("legacy-bootstrap-token");
    expect(sessionStorage.getItem("cig_access_token")).toBe("legacy-bootstrap-token");
    expect(sessionStorage.getItem("cig_auth_source")).toBe("authentik");
  });

  it("resolves the latest Supabase session token from the client", async () => {
    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "fresh-supabase-token",
              refresh_token: "fresh-refresh-token",
              expires_in: 1800,
              expires_at: Math.floor(Date.now() / 1000) + 1800,
              user: {
                app_metadata: { provider: "email" },
              },
            },
          },
        }),
      },
    } as never);

    sessionStorage.setItem("cig_access_token", "stale-supabase-token");
    sessionStorage.setItem("cig_auth_source", "supabase");
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    await expect(resolveDashboardAccessToken()).resolves.toBe("fresh-supabase-token");
    expect(sessionStorage.getItem("cig_access_token")).toBe("fresh-supabase-token");
  });

  it("clears expired sessions before returning a token", () => {
    sessionStorage.setItem("cig_access_token", "expired-token");
    sessionStorage.setItem("cig_id_token", "expired-id-token");
    sessionStorage.setItem("cig_auth_source", "authentik");
    sessionStorage.setItem("cig_expires_at", String(Date.now() - 60_000));

    expect(getBrowserAccessToken()).toBeNull();
    expect(sessionStorage.getItem("cig_access_token")).toBeNull();
    expect(sessionStorage.getItem("cig_id_token")).toBeNull();
    expect(document.cookie).not.toContain("cig_has_session=1");
  });
});
