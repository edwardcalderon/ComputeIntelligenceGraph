# CIG Authentication Architecture

This document describes the current authentication setup used by CIG and the Authentik resources that make it work. It also calls out the provider-agnostic pattern to follow when adding another social identity source or another relying party.

## Overview

CIG uses **Authentik** as the primary identity provider and **Supabase** as a feature-flagged fallback. The primary path is:

1. Start OIDC Authorization Code + PKCE from the landing app
2. Bounce through the dashboard relay route so PKCE state exists on the dashboard origin
3. Enter Authentik through a provider-specific social login flow
4. Exchange the OIDC code on the dashboard
5. Return the tokens to landing through a hash fragment
6. Use the landing app as the canonical logout orchestrator

### Current production principals

| Component | Production origin | Role |
| --------- | ----------------- | ---- |
| Landing (`apps/landing`) | `https://cig.lat` | Public entrypoint, login buttons, canonical logout completion target |
| Dashboard (`apps/dashboard`) | `https://app.cig.technology` | Protected app, PKCE relay, OAuth callback |
| Authentik | `https://auth.cig.technology` | OIDC provider, user directory, social-source broker |
| Google / GitHub | External | Upstream social identity providers |

## Current login flow

### Social login sequence

```
Landing (cig.lat)                  Dashboard (app.cig.technology)            Authentik                    Google/GitHub
       |                                      |                                  |                              |
  1. User clicks a social login button         |                                  |                              |
       |                                      |                                  |                              |
  2. startAuthentikSocialLogin()              |                                  |                              |
     - Generate PKCE verifier + challenge      |                                  |                              |
     - Generate state                          |                                  |                              |
     - Store verifier/state/provider in        |                                  |                              |
       landing sessionStorage                  |                                  |                              |
     - Navigate to dashboard relay route       |                                  |                              |
       |                                      |                                  |                              |
       |-------- GET /auth/login/{provider} -->|                                  |                              |
       |                                      |                                  |                              |
  3.   |                            Relay HTML stores verifier/state/provider     |                              |
       |                            in dashboard sessionStorage                   |                              |
       |                            and redirects into an Authentik flow          |                              |
       |                                      |                                  |                              |
       |                                      |--- /if/flow/cig-{provider}-login/|                              |
       |                                      |    ?next=/application/o/authorize |                              |
       |                                      |                                  |                              |
  4.   |                                      |                     Redirect stage points to                     |
       |                                      |                     /source/oauth/login/{provider}/             |
       |                                      |                                  |                              |
       |                                      |                                  |--- OAuth2 authorize -------->|
       |                                      |                                  |                              |
  5.   |                                      |                                  |<--- provider callback ------|
       |                                      |                                  |                              |
  6.   |                                      |                     Authentik links or enrolls the user,        |
       |                                      |                     runs source property mappings,              |
       |                                      |                     resumes ?next= authorization,               |
       |                                      |                     and issues the CIG auth code               |
       |                                      |                                  |                              |
  7.   |                                      |<-- /auth/callback?code=...&state=|                              |
       |                                      |                                  |                              |
  8.   |                            exchangeAuthentikCode()                      |                              |
       |                            - Validate state                             |                              |
       |                            - Read verifier from dashboard storage       |                              |
       |                            - POST /application/o/token/                 |                              |
       |                            - Store tokens in dashboard storage          |                              |
       |                                      |                                  |                              |
  9.   |<------- hash fragment redirect ------|                                  |                              |
       |            #access_token=...&id_token=...&expires_in=...                |                              |
       |                                      |                                  |                              |
 10. Landing AuthProvider stores the tokens, decodes id_token claims, and clears the hash                          |
```

### Why the relay route exists

The landing app and dashboard are different origins. `sessionStorage` is origin-scoped, so the PKCE verifier created on landing would not be visible to the dashboard callback page. The relay route on the dashboard origin solves that by writing the PKCE verifier into the dashboard's `sessionStorage` before entering Authentik.

### Why per-provider login flows exist

Authentik's default login UI is intentionally bypassed for social login. Each upstream social provider gets its own Authentik **authentication** flow with a single **Redirect Stage**:

| Flow slug | Redirect target |
| --------- | --------------- |
| `cig-google-login` | `/source/oauth/login/google/` |
| `cig-github-login` | `/source/oauth/login/github/` |

That keeps the RP flow explicit and avoids accidental dependence on whatever the tenant's default login screen happens to show.

## Current logout flow

Logout is intentionally centralized in the landing app, even when the user clicks logout inside the dashboard.

```
Dashboard or Landing                  Landing                              Authentik
        |                               |                                     |
  1. Dashboard logout redirects -------->| ?signout=1                          |
        |                               |                                     |
  2. Landing signOut()                  |                                     |
     - Best-effort revoke access token  |                                     |
     - Clear local `cig_*` session keys |                                     |
     - Build RP-initiated end-session   |                                     |
       URL using `id_token_hint`        |                                     |
     - Set post_logout_redirect_uri     |                                     |
       to `https://cig.lat/?logged_out=1`                                     |
        |------------------------------>| /end-session/...                     |
        |                               |                                     |
  3. Authentik provider invalidation flow runs                                 |
     - User Logout stage ends the authentik browser session                    |
     - Redirect stage sends the browser back to landing                        |
        |<------------------------------|                                     |
        |                               |                                     |
  4. Landing loads `?logged_out=1`, cleans the URL, and remains signed out     |
```

### Important logout design rules

- The app clears its own session **before** leaving for Authentik so a partially completed remote logout does not leave stale local identity visible.
- The post-logout target is always the landing root with `?logged_out=1`, not the current pathname, so logout completion is deterministic.
- If you keep using `default-provider-invalidation-flow`, every RP that shares it will inherit the same post-logout behavior.
- Once multiple relying parties need different logout destinations, create a provider-specific invalidation flow instead of hardcoding a shared default flow.

## Authentik resources CIG depends on

### 1. OIDC provider and application

Current CIG production provider:

- Application: `CIG Platform`
- Provider: `CIG Dashboard`
- Client type: public
- Flow style: Authorization Code + PKCE
- Redirect URIs: `https://app.cig.technology/auth/callback`, `http://localhost:3001/auth/callback`
- Scopes used by the app: `openid email profile`
- Invalidation flow: currently `default-provider-invalidation-flow`

Provider-agnostic requirement:

- Every relying party needs an application/provider pair with redirect URIs for every environment it serves.
- For browser-only apps, use PKCE and avoid client secrets in the frontend.
- Decide the invalidation flow deliberately. The Authentik default is not enough if you want RP logout to also end the Authentik browser session and return to the application.

### 2. OAuth sources

Current CIG sources:

- `google`
- `github`

Each source needs:

- provider-issued client credentials
- callback URL in the upstream provider console:
  `https://auth.cig.technology/source/oauth/callback/{provider}/`
- authentication flow for existing users
- enrollment flow for first-time users
- matching mode set to `identifier`

Why `identifier` matters:

- source links are based on the upstream account binding, not on email equality
- this avoids silently merging accounts just because two providers share an email address

### 3. Source property mapping

CIG uses a source property mapping to normalize profile fields from upstream providers into Authentik's user record:

```python
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

Provider-agnostic rule:

- normalize upstream claims inside the identity provider once
- downstream relying parties should consume stable OIDC claims, not provider-specific raw fields

### 4. OIDC scope mapping

CIG's OIDC profile scope mapping exposes the normalized avatar back to the applications:

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

Provider-agnostic rule:

- every relying party should receive the same normalized profile shape regardless of whether the user came from Google, GitHub, or another source

### 5. Per-provider login flows

For every upstream social provider CIG exposes directly in the landing UI:

1. Create an **Authentication** flow named `cig-{provider}-login`
2. Bind a **Redirect Stage**
3. Set the Redirect Stage to static mode
4. Point it at `/source/oauth/login/{provider}/`

This keeps the app's social buttons mapped to explicit Authentik resources instead of implicit tenant defaults.

### 6. Provider invalidation flow

This is the resource that fixes the logout issue that originally caused users to remain attached to the previous Authentik browser session.

Minimum working pattern:

1. Use an **Invalidation** flow for the provider
2. Add a **User Logout** stage so RP logout also ends the Authentik session
3. Add a **Redirect Stage** after it so the browser returns to the application

Current CIG production behavior:

- the `CIG Dashboard` provider uses `default-provider-invalidation-flow`
- that flow must contain:
  - `User Logout`
  - a Redirect Stage to `https://cig.lat/?logged_out=1`

Recommended provider-agnostic pattern:

- create a dedicated invalidation flow per relying party when different apps need different logout destinations
- reserve `default-provider-invalidation-flow` for shared behavior only
- if you need the redirect target to vary dynamically, use a Redirect Stage plus policy-driven `redirect_stage_target`

## Token and session lifecycle

| Event | Action |
| ----- | ------ |
| Login start | Clear `cig_*` session keys before writing new PKCE/session state |
| Relay route | Store verifier, state, and provider on the dashboard origin |
| Callback | Exchange code, store tokens, set `cig_has_session` cookie |
| Cross-origin return | Pass tokens back to landing via hash fragment |
| Page load | `AuthProvider` reads session storage and decodes the id token |
| Local logout | Clear local `cig_*` state immediately |
| Remote logout | Revoke access token best-effort, then call Authentik end-session |
| Logout completion | Return to `/?logged_out=1`, clean URL, remain signed out |

## Supabase fallback

Set `NEXT_PUBLIC_AUTH_PROVIDER=supabase` to use the fallback path:

- login uses Supabase OAuth instead of the Authentik PKCE flow
- user state comes from `supabase.auth.getSession()` and `onAuthStateChange()`
- logout calls `supabase.auth.signOut()`

The fallback is implementation-compatible at the app level, but it does not use Authentik login flows, Authentik source mappings, or Authentik invalidation flows.

## Security and failure-mode notes

| Measure | Implementation |
| ------- | -------------- |
| PKCE S256 | random verifier + SHA-256 challenge |
| CSRF protection | state parameter validated on callback |
| Origin isolation | verifier lives on the dashboard origin that completes the callback |
| Identity bleed prevention | all `cig_*` session keys are cleared before new login data is stored |
| Local-first logout | local app state is cleared before remote logout finishes |
| Remote token revocation | access token revocation is best-effort and uses `keepalive` |
| Authentik session termination | provider invalidation flow includes `User Logout` |
| Deterministic return target | logout completes on `/?logged_out=1` |
| Open redirect protection | callback validates redirect targets against allowed origins |

## Files reference

| File | Purpose |
| ---- | ------- |
| `packages/auth/src/authentik.ts` | PKCE helpers, code exchange, end-session URL builder, token revocation |
| `packages/auth/src/index.ts` | client-safe auth exports |
| `apps/landing/components/AuthProvider.tsx` | landing-side session state and canonical logout orchestration |
| `apps/landing/components/AuthButton.tsx` | login UI and social button entrypoints |
| `apps/landing/app/page.tsx` | logout entry and completion query normalization |
| `apps/dashboard/app/auth/login/[provider]/route.ts` | cross-origin PKCE bridge into Authentik |
| `apps/dashboard/app/auth/callback/page.tsx` | OIDC code exchange and landing redirect |
| `apps/dashboard/lib/authProvider.ts` | dashboard logout handoff to landing |
