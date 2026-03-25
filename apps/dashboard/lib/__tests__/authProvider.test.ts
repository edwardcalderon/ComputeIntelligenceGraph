import { authProvider } from "../authProvider";
import { getSupabaseClient } from "@cig/auth";

jest.mock("@cig/auth", () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

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

    const result = await authProvider.logout();

    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      redirectTo: "http://localhost:3000",
    });
    expect(sessionStorage.getItem("cig_access_token")).toBeNull();
    expect(sessionStorage.getItem("cig_auth_source")).toBeNull();
  });
});