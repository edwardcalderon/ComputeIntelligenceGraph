import {
  getSupabaseAdminConfig,
  syncOidcUserToSupabase,
  type OidcSyncPayload,
} from "../authSync";

function makePayload(overrides: Partial<OidcSyncPayload> = {}): OidcSyncPayload {
  return {
    sub: "google-oauth2|user-123",
    iss: "https://auth.cig.technology/application/o/cig-dashboard/",
    email: "new.user@example.com",
    emailVerified: true,
    name: "New User",
    picture: "https://example.com/avatar.png",
    provider: "google",
    rawClaims: {
      email: "new.user@example.com",
      email_verified: true,
      name: "New User",
      picture: "https://example.com/avatar.png",
      sub: "google-oauth2|user-123",
    },
    ...overrides,
  };
}

function makeClient() {
  return {
    rpc: jest.fn().mockResolvedValue({ error: null }),
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({
          data: { users: [], nextPage: null, lastPage: 1, total: 0 },
          error: null,
        }),
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: "auth-user-1", email: "new.user@example.com" } },
          error: null,
        }),
        updateUserById: jest.fn().mockResolvedValue({
          data: { user: { id: "auth-user-1", email: "new.user@example.com" } },
          error: null,
        }),
        deleteUser: jest.fn().mockResolvedValue({
          data: { user: { id: "auth-user-1", email: "new.user@example.com" } },
          error: null,
        }),
      },
    },
  };
}

describe("authSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads server-side Supabase admin config", () => {
    expect(
      getSupabaseAdminConfig({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      url: "https://project.supabase.co",
      serviceRoleKey: "service-role-key",
    });
  });

  it("accepts the legacy Supabase service role env alias", () => {
    expect(
      getSupabaseAdminConfig({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE: "legacy-service-role-key",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      url: "https://project.supabase.co",
      serviceRoleKey: "legacy-service-role-key",
    });
  });

  it("creates a shadow auth user and upserts the app user", async () => {
    const client = makeClient();

    const result = await syncOidcUserToSupabase(client, makePayload());

    expect(result).toEqual({
      synced: true,
      authUserId: "auth-user-1",
      authUserCreated: true,
      authUserUpdated: false,
    });
    expect(client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new.user@example.com",
        email_confirm: true,
        app_metadata: expect.objectContaining({
          provider: "authentik",
          auth_source: "authentik",
          oidc_sub: "google-oauth2|user-123",
          upstream_provider: "google",
        }),
      }),
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "upsert_oidc_user",
      expect.objectContaining({
        p_sub: "google-oauth2|user-123",
        p_email: "new.user@example.com",
        p_provider: "google",
        p_raw_claims: expect.objectContaining({
          shadow_supabase_auth_user_id: "auth-user-1",
          shadow_supabase_auth_user_created: true,
          auth_source: "authentik",
        }),
      }),
    );
  });

  it("reuses an existing shadow auth user matched by Authentik identity", async () => {
    const client = makeClient();
    client.auth.admin.listUsers.mockResolvedValueOnce({
      data: {
        users: [
          {
            id: "auth-user-existing",
            email: "new.user@example.com",
            user_metadata: {
              name: "New User",
              full_name: "New User",
              avatar_url: "https://example.com/avatar.png",
              oidc_sub: "google-oauth2|user-123",
              oidc_issuer: "https://auth.cig.technology/application/o/cig-dashboard/",
              upstream_provider: "google",
            },
            app_metadata: {
              provider: "authentik",
              auth_source: "authentik",
              oidc_sub: "google-oauth2|user-123",
              oidc_issuer: "https://auth.cig.technology/application/o/cig-dashboard/",
              upstream_provider: "google",
            },
          },
        ],
        nextPage: null,
        lastPage: 1,
        total: 1,
      },
      error: null,
    });

    const result = await syncOidcUserToSupabase(client, makePayload());

    expect(result).toEqual({
      synced: true,
      authUserId: "auth-user-existing",
      authUserCreated: false,
      authUserUpdated: false,
    });
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
    expect(client.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("updates an existing auth user found by email when metadata drifted", async () => {
    const client = makeClient();
    client.auth.admin.listUsers.mockResolvedValueOnce({
      data: {
        users: [
          {
            id: "auth-user-existing",
            email: "new.user@example.com",
            user_metadata: {
              name: "Old Name",
            },
            app_metadata: {
              provider: "authentik",
              auth_source: "authentik",
              oidc_sub: "google-oauth2|user-123",
              oidc_issuer: "https://auth.cig.technology/application/o/cig-dashboard/",
              upstream_provider: "google",
            },
          },
        ],
        nextPage: null,
        lastPage: 1,
        total: 1,
      },
      error: null,
    });

    const result = await syncOidcUserToSupabase(client, makePayload());

    expect(result).toEqual({
      synced: true,
      authUserId: "auth-user-1",
      authUserCreated: false,
      authUserUpdated: true,
    });
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith(
      "auth-user-existing",
      expect.objectContaining({
        email: "new.user@example.com",
        app_metadata: expect.objectContaining({
          provider: "authentik",
        }),
      }),
    );
  });

  it("rolls back a newly created shadow auth user when app-user sync fails", async () => {
    const client = makeClient();
    client.rpc.mockResolvedValueOnce({
      error: { message: "app user upsert failed" },
    });

    await expect(
      syncOidcUserToSupabase(client, makePayload()),
    ).rejects.toThrow("upsert_oidc_user failed: app user upsert failed");

    expect(client.auth.admin.createUser).toHaveBeenCalled();
    expect(client.auth.admin.deleteUser).toHaveBeenCalledWith("auth-user-1");
  });
});
