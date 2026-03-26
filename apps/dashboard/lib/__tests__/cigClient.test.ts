import { getBrowserAccessToken } from "../cigClient";

describe("dashboard cigClient token resolution", () => {
  beforeEach(() => {
    sessionStorage.clear();
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
