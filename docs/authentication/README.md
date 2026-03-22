# CIG Authentication Architecture

This document describes the authentication system for the CIG platform, including the OIDC/PKCE flow via Authentik, cross-origin token bridging, social provider integration, profile sync, and the Supabase fallback path.

## Overview

CIG uses **Authentik** as the primary identity provider with OAuth 2.0 Authorization Code + PKCE (S256). Social logins (Google, GitHub) bypass the Authentik login UI via dedicated per-provider flows. A **Supabase** fallback is available via a feature flag.

### Key Principals

| Component            | Origin (production)              | Role                                 |
| -------------------- | -------------------------------- | ------------------------------------ |
| Landing (`apps/landing`) | `cig.lat`                    | Login UI, social buttons, user menu  |
| Dashboard (`apps/dashboard`) | `app.cig.technology`     | Protected app, auth callback/relay   |
| Authentik            | `auth.cig.technology`            | OIDC provider, user directory        |
| Google / GitHub      | External                         | Social identity providers            |

## Auth Flow: Social Login (Google/GitHub)

```
Landing (cig.lat)                  Dashboard (app.cig.technology)            Authentik                    Google/GitHub
       |                                      |                                  |                              |
  1. User clicks "Continue with Google"        |                                  |                              |
       |                                      |                                  |                              |
  2. startAuthentikSocialLogin()              |                                  |                              |
     - Generate PKCE verifier + challenge      |                                  |                              |
     - Generate state                          |                                  |                              |
     - Store verifier, state, social_provider  |                                  |                              |
       in landing's sessionStorage             |                                  |                              |
     - Navigate to dashboard relay route       |                                  |                              |
       |                                      |                                  |                              |
       |-------- GET /auth/login/google ------>|                                  |                              |
       |    ?code_challenge=...&state=...      |                                  |                              |
       |    &code_verifier=...&client_id=...   |                                  |                              |
       |                                      |                                  |                              |
  3.   |                            Relay route serves HTML that:                  |                              |
       |                            - Stores verifier, state, social_provider      |                              |
       |                              in dashboard's sessionStorage                |                              |
       |                            - Redirects to Authentik flow                  |                              |
       |                                      |                                  |                              |
       |                                      |--- /if/flow/cig-google-login/ -->|                              |
       |                                      |    ?next=/application/o/authorize |                              |
       |                                      |                                  |                              |
  4.   |                                      |                     Flow has Redirect Stage                     |
       |                                      |                     pointing to Google source                   |
       |                                      |                                  |                              |
       |                                      |                                  |--- OAuth2 authorize -------->|
       |                                      |                                  |                              |
  5.   |                                      |                                  |<--- code (Google) ----------|
       |                                      |                                  |                              |
       |                                      |                     Authentik exchanges Google code,             |
       |                                      |                     links/creates user,                         |
       |                                      |                     runs source property mapping                |
       |                                      |                     (syncs name, email, picture),               |
       |                                      |                     follows ?next= to OIDC authorize,           |
       |                                      |                     issues CIG authorization code               |
       |                                      |                                  |                              |
  6.   |                                      |<-- /auth/callback?code=...&state= |                              |
       |                                      |                                  |                              |
  7.   |                            exchangeAuthentikCode():                      |                              |
       |                            - Read verifier from sessionStorage            |                              |
       |                            - Validate state                               |                              |
       |                            - POST /application/o/token/                   |                              |
       |                              (code + verifier -> tokens)                  |                              |
       |                            - Store tokens in sessionStorage               |                              |
       |                                      |                                  |                              |
  8.   |                            Cross-origin redirect back to landing:         |                              |
       |                            cig.lat#access_token=...&id_token=...          |                              |
       |                            &expires_in=...&social_provider=google         |                              |
       |                                      |                                  |                              |
  9.   |<------- hash fragment redirect ------|                                  |                              |
       |                                      |                                  |                              |
 10. AuthProvider reads hash:                 |                                  |                              |
     - Store tokens in landing's sessionStorage                                  |                              |
     - Decode id_token for user claims         |                                  |                              |
     - Clear hash from URL                     |                                  |                              |
     - Display user profile                    |                                  |                              |
```

### Why the Relay Route?

The landing and dashboard are on **different origins**. `sessionStorage` is per-origin, so the landing cannot write the PKCE verifier into the dashboard's storage. The relay route (`/auth/login/[provider]`) runs on the dashboard origin and bridges this gap by:

1. Storing the PKCE verifier + state in the **dashboard's** `sessionStorage`
2. Redirecting to Authentik with the OIDC authorize URL as the `?next=` parameter

After auth completes, `/auth/callback` (also on the dashboard) reads the verifier from its own `sessionStorage` to exchange the code.

### Why Per-Provider Flows?

Standard Authentik login shows its own login page. To skip this and go directly to Google/GitHub, each provider has a dedicated Authentik flow:

| Provider | Flow slug            | Redirect Stage target                       |
| -------- | -------------------- | ------------------------------------------- |
| Google   | `cig-google-login`   | `/source/oauth/login/google/`               |
| GitHub   | `cig-github-login`   | `/source/oauth/login/github/`               |

Each flow has a single **Redirect Stage** that sends the user straight to the social provider. The `?next=` parameter (containing the OIDC authorize URL) is preserved by Authentik's flow executor, so after the social auth completes, Authentik issues the CIG authorization code.

## Authentik Configuration

### OIDC Provider

- **Application**: CIG Platform
- **Client type**: Public (PKCE-only, no client secret)
- **Allowed redirect URIs**: `https://app.cig.technology/auth/callback`, `http://localhost:3001/auth/callback`
- **Scopes**: `openid`, `email`, `profile`

### OAuth Sources (Google, GitHub)

Each source must be configured with:
- **Consumer key/secret**: From the respective provider's developer console
- **Callback URL**: `https://auth.cig.technology/source/oauth/callback/{provider}/`
- **Authentication flow**: `default-authentication-flow` (existing users)
- **Enrollment flow**: CIG enrollment flow (new users)
- **User matching mode**: `identifier` (matches by source connection, not email)

### Source Property Mapping: Profile Sync

A source property mapping **"CIG: Sync profile from social provider"** is assigned to both Google and GitHub sources. It runs on each login and syncs the user's profile from the social provider:

```python
# Source OAuth property mappings receive `info` (OAuth userinfo dict)
# and must return a dict of User model fields to set.
name = info.get("name", "")
email = info.get("email", "")
picture = info.get("picture", "") or info.get("avatar_url", "")

result = {}
if name:
    result["name"] = name
if email:
    result["email"] = email
if picture:
    result["attributes"] = {"picture": picture, "avatar": picture}

return result
```

This ensures that if a user changes their name or avatar on Google/GitHub, it auto-updates in CIG on next login.

### OIDC Scope Mapping: Profile Claims

The OIDC provider's **profile scope mapping** includes the synced picture in the id_token:

```python
return {
    "name": request.user.name,
    "given_name": request.user.name,
    "preferred_username": request.user.username,
    "nickname": request.user.username,
    "groups": [group.name for group in request.user.groups.all()],
    "picture": request.user.attributes.get("picture", ""),
}
```

### Per-Provider Flows

Each social provider needs a dedicated Authentik flow with a single **Redirect Stage**:

1. Create flow: `cig-{provider}-login` (designation: Authentication)
2. Add one stage: **Redirect Stage**
   - Mode: Static URL
   - URL: `/source/oauth/login/{provider}/`
3. The landing's relay route passes `?next=<OIDC authorize URL>` to the flow

## Token Lifecycle

| Event          | Action                                                          |
| -------------- | --------------------------------------------------------------- |
| Login start    | Clear all `cig_*` sessionStorage keys (prevent identity bleed)  |
| Relay route    | Store PKCE verifier + state + social_provider in dashboard sessionStorage |
| Callback       | Exchange code, store tokens, set `cig_has_session` cookie       |
| Cross-origin redirect | Pass tokens in hash fragment, landing stores them        |
| Page load      | `AuthProvider` reads sessionStorage, decodes id_token for user claims |
| Token expired  | `readAuthentikSession()` returns null, user appears signed out  |
| Sign out       | Revoke token via Authentik API, clear all `cig_*` keys + cookie |

## Supabase Fallback

Set `NEXT_PUBLIC_AUTH_PROVIDER=supabase` to switch to Supabase auth:

- Login uses Supabase's `signInWithOAuth()` instead of PKCE
- User info comes from `supabase.auth.getSession()` and `onAuthStateChange()`
- Social provider detected from `user.app_metadata.provider`
- Sign-out calls `supabase.auth.signOut()`

This fallback exists for resilience if Authentik is unavailable. No code changes are needed — just set the env variable.

## Security Measures

| Measure                   | Implementation                                                        |
| ------------------------- | --------------------------------------------------------------------- |
| PKCE S256                 | 256-bit random verifier, SHA-256 challenge                            |
| CSRF (state param)        | 128-bit random state, validated on callback                           |
| Open redirect protection  | Callback validates redirect against allowed origins whitelist         |
| Session isolation          | `sessionStorage` per-origin, per-tab, non-persistent                 |
| Secure cookies            | `cig_has_session` includes `Secure` flag over HTTPS                  |
| Identity bleed prevention | All `cig_*` keys cleared before storing new tokens on every login    |
| Token revocation           | Access token revoked server-side via Authentik on sign-out           |
| Referrer protection        | `referrerPolicy="no-referrer"` on external avatar images             |
| Provider whitelisting      | Relay route only accepts `google` and `github` via `Set` check       |
| JSON.stringify escaping    | Relay route HTML uses `JSON.stringify()` for all injected values     |

## Files Reference

| File                                                      | Purpose                                      |
| --------------------------------------------------------- | -------------------------------------------- |
| `packages/auth/src/authentik.ts`                          | PKCE helpers, social login, token exchange    |
| `packages/auth/src/index.ts`                              | Package exports                              |
| `packages/auth/src/client.ts`                             | Supabase client singleton                    |
| `packages/auth/src/adapters/oidc-adapter.ts`              | Server-side JWT verification via JWKS        |
| `apps/landing/components/AuthProvider.tsx`                 | Unified auth context (Authentik + Supabase)  |
| `apps/landing/components/AuthButton.tsx`                   | Login modal with social buttons              |
| `apps/dashboard/app/auth/login/[provider]/route.ts`       | Relay route (cross-origin PKCE bridge)       |
| `apps/dashboard/app/auth/callback/page.tsx`               | OAuth callback (code exchange + redirect)    |
| `apps/dashboard/middleware.ts`                             | Session cookie gate for protected routes     |
