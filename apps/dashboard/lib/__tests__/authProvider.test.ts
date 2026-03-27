import { authProvider } from "../authProvider";
import { getSupabaseClient, revokeSessionViaApi } from "@cig/auth";

jest.mock("@cig/auth", () => ({
  getSupabaseClient: jest.fn(),
  revokeSessionViaApi: jest.fn().mockResolvedValue(undefined),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockRevokeSessionViaApi = revokeSessionViaApi as jest.MockedFunction<typeof revokeSessionViaApi>;

function makeJwt(issuer: string): string {
  const payload = Buffer.from(JSON.stringify({ iss: issuer }), "utf8").toString("base64url");
  return `header.${payload}.signature`;
}

describe("dashboard authProvider.logout", () => {
  const originalAuthProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = "authentik";
  });

  afterEach(() => {
    sessionStorage.clear();
    if (originalAuthProvider === undefined) {
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
    } else {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = originalAuthProvider;
    }
  });

  it("signs out Supabase sessions before returning to landing", async () => {
    const supabaseSignOut = jest.fn().mockResolvedValue({ error: null });
    mockGetSupabaseClient.mockReturnValue({
      auth: {
        signOut: supabaseSignOut,
      },
    } as never);

    sessionStorage.setItem("cig_access_token", "supabase-access-token");
    sessionStorage.setItem("cig_auth_source", "supabase");
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    const result = await authProvider.logout({} as never);

    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(supabaseSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({
      success: true,
      redirectTo: "https://cig.lat?logged_out=1",
    });
    expect(sessionStorage.getItem("cig_access_token")).toBeNull();
    expect(sessionStorage.getItem("cig_auth_source")).toBeNull();
  });

  it("infers Supabase sessions from the token issuer even when the auth source tag is missing", async () => {
    const supabaseSignOut = jest.fn().mockResolvedValue({ error: null });
    mockGetSupabaseClient.mockReturnValue({
      auth: {
        signOut: supabaseSignOut,
      },
    } as never);

    sessionStorage.setItem("cig_access_token", makeJwt("https://project.supabase.co/auth/v1"));
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    const result = await authProvider.logout({} as never);

    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(supabaseSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({
      success: true,
      redirectTo: "https://cig.lat?logged_out=1",
    });
  });

  it("revokes Authentik sessions via the API logout route and returns to landing", async () => {
    sessionStorage.setItem("cig_access_token", "authentik-access-token");
    sessionStorage.setItem("cig_auth_source", "authentik");
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    const result = await authProvider.logout({} as never);

    expect(mockRevokeSessionViaApi).toHaveBeenCalledTimes(1);
    expect(mockRevokeSessionViaApi).toHaveBeenCalledWith("authentik-access-token");
    expect(result).toEqual({
      success: true,
      redirectTo: "https://cig.lat?logged_out=1",
    });
  });
});

describe("dashboard authProvider auth gating", () => {
  const originalLocation = window.location;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    process.env.NEXT_PUBLIC_SITE_URL = "https://cig.lat";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("allows unauthenticated access on local hosts", async () => {
    const result = await authProvider.check({} as never);

    expect(result).toEqual({ authenticated: true });
  });

  it("redirects unauthenticated production visits to landing sign-in", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        hostname: "app.cig.lat",
        protocol: "https:",
        pathname: "/graph",
        search: "?x=1",
      },
    });

    const result = await authProvider.check({} as never);

    expect(result).toEqual({
      authenticated: false,
      redirectTo: "https://cig.lat/?auth=signin&dashboard_redirect=%2Fgraph%3Fx%3D1",
      error: { name: "Unauthenticated", message: "No active session." },
    });
  });

  it("redirects protected-host auth failures back to landing sign-in", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        hostname: "app.cig.lat",
        protocol: "https:",
        pathname: "/graph",
        search: "",
      },
    });

    sessionStorage.setItem("cig_access_token", "stale-token");
    sessionStorage.setItem("cig_expires_at", String(Date.now() + 60_000));

    const result = await authProvider.onError({ status: 401 });

    expect(result).toEqual({
      logout: true,
      redirectTo: "https://cig.lat/?auth=signin&dashboard_redirect=%2Fgraph",
    });
    expect(sessionStorage.getItem("cig_access_token")).toBeNull();
  });
});
