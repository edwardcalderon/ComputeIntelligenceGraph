# Design Document: CIG Authentication & Provisioning

## Overview

This milestone wires together the authentication and provisioning subsystems for the CIG platform across two operational modes: **managed** (Authentik as OIDC IdP on AWS) and **self-hosted** (local JWT, no external IdP). The design covers six major areas:

1. Auth adapter abstraction (`packages/auth`) — mode-aware factory hiding Supabase/Authentik/local-JWT details
2. Authentik AWS infrastructure (`packages/iac`, `packages/infra`) — Terraform module + deployer completing the existing stub
3. CLI flows (`packages/cli`) — device-code login (RFC 8628), enrollment, self-hosted bootstrap, install
4. API endpoints (`packages/api`) — device auth, enrollment, heartbeat, bootstrap, OIDC callback, internal JWT, audit
5. Dashboard pages (`apps/dashboard`) — device approval, targets list, bootstrap setup
6. Persistence model — tables/collections for all new entities

The `CIG_AUTH_MODE` environment variable (`managed` | `self-hosted`) gates all mode-specific behavior. No Authentik dependency is loaded in self-hosted mode.

---

## Architecture

```mermaid
graph TD
  subgraph CLI [packages/cli]
    Login[cig login\nDevice-Code Flow]
    Install[cig install\nEnrollment / Bootstrap]
    Doctor[cig doctor]
  end

  subgraph API [packages/api]
    DeviceAuth[/auth/device/*]
    Enrollment[/targets/*]
    Heartbeat[/targets/:id/heartbeat]
    Bootstrap[/bootstrap/*]
    OIDCCallback[/auth/oidc/callback]
    Audit[/audit]
    InternalJWT[Internal JWT]
  end

  subgraph Auth [packages/auth]
    Factory[createAuthAdapter]
    OIDCAdapter[OIDCAdapter\nManaged Mode]
    LocalJWTAdapter[LocalJWTAdapter\nSelf-Hosted Mode]
    InternalTokens[createInternalToken\nverifyInternalToken]
  end

  subgraph Infra [packages/infra + packages/iac]
    AuthentikBlueprint[AuthentikInfraBlueprint]
    TFModule[modules/authentik-aws]
  end

  subgraph Dashboard [apps/dashboard]
    DeviceApproval[/device-approval]
    Targets[/targets]
    BootstrapPage[/bootstrap]
  end

  subgraph Persistence
    DB[(PostgreSQL / SQLite)]
    AuditLog[(audit_events)]
  end

  Login -->|POST /auth/device/authorize| DeviceAuth
  Install -->|POST /targets/enrollment-token\nPOST /targets/enroll| Enrollment
  Dashboard -->|WebSocket + REST| API
  API --> Auth
  API --> Persistence
  AuthentikBlueprint --> TFModule
  OIDCAdapter -->|JWKS validation| Authentik[(Authentik on AWS)]
```

### Mode Dispatch

```
CIG_AUTH_MODE=managed   → OIDCAdapter (validates against Authentik JWKS)
CIG_AUTH_MODE=self-hosted → LocalJWTAdapter (validates against CIG_JWT_SECRET)
```

The `createAuthAdapter` factory is the single import point for all callers. Neither adapter leaks Supabase or Authentik imports into the other mode.

---

## Components and Interfaces

### 1. Auth Package — `packages/auth`

#### `createAuthAdapter` factory

```typescript
type AuthMode = 'managed' | 'self-hosted';

interface OIDCAdapterConfig {
  issuerUrl: string;       // Authentik issuer URL
  clientId: string;
  jwksUri: string;
}

interface LocalJWTAdapterConfig {
  secret: string;          // CIG_JWT_SECRET
}

interface AuthAdapter {
  verifyToken(token: string): Promise<VerifiedClaims>;
  // returns { sub, email, groups, tenant, mode }
}

function createAuthAdapter(
  mode: AuthMode,
  config: OIDCAdapterConfig | LocalJWTAdapterConfig
): AuthAdapter;
```

#### Internal JWT helpers

```typescript
function createInternalToken(serviceName: string, secret: string): string;
// signs { iss: "cig-internal", sub: serviceName, exp: now+5min } with HMAC-SHA256

function verifyInternalToken(token: string, secret: string): InternalTokenPayload;
// throws if iss !== "cig-internal" or expired
```

### 2. IAC Package — `packages/iac/modules/authentik-aws`

New Terraform module directory structure:

```
packages/iac/modules/authentik-aws/
  main.tf          # VPC (optional), RDS, ECS Fargate, ALB, ACM, Route53
  variables.tf     # vpc_id (optional), domain, region, db_instance_class, etc.
  outputs.tf       # issuer_url, oidc_client_id, oidc_client_secret (sensitive)
  secrets.tf       # Secrets Manager resources
```

Key Terraform resources:
- `aws_vpc` / data source for existing VPC (conditional on `var.vpc_id`)
- `aws_db_instance` (PostgreSQL 15, Multi-AZ optional)
- `aws_ecs_cluster` + `aws_ecs_task_definition` + `aws_ecs_service` (Fargate)
- `aws_lb` + `aws_lb_listener` (HTTPS 443)
- `aws_acm_certificate` + `aws_route53_record`
- `aws_secretsmanager_secret` for admin password and DB credentials

### 3. Infra Package — `packages/infra`

`AuthentikDeployer` is extended to implement the stub methods using the new Terraform module:

```typescript
interface AuthentikInfraBlueprint {
  deploy(config: AuthentikDeploymentConfig): Promise<AuthentikBlueprintResult>;
  // AuthentikBlueprintResult adds: issuerUrl, oidcClientId, oidcClientSecret
}
```

The deployer calls `IACIntegration.applyModule('authentik-aws', variables)` and reads outputs. On failure it calls `IACIntegration.destroyModule(...)` for rollback.

### 4. CLI — `packages/cli`

New commands and flows:

```
cig login                    # Device-code flow (RFC 8628)
cig logout                   # Clear tokens + POST /auth/logout
cig install [--mode managed|self-hosted] [--profile core|full]
cig doctor                   # Prereq checks only
cig bootstrap-reset          # Regenerate bootstrap token (self-hosted)
```

Key new modules:
- `src/commands/login.ts` — device-code polling loop
- `src/commands/install.ts` — orchestrates prereq checks, enrollment/bootstrap, compose gen, health checks
- `src/commands/doctor.ts` — prereq checks only
- `src/prereqs.ts` — Docker, Compose, memory, disk, port checks
- `src/compose-generator.ts` — generates `docker-compose.yml` + `.env` from Install_Manifest

`CredentialManager` already has `saveTokens`, `saveIdentity`, `saveBootstrapToken` — these are used as-is.

### 5. API — `packages/api`

New route files added to `src/`:

```
src/routes/device-auth.ts    # POST /auth/device/{authorize,poll,approve,deny}, POST /auth/logout
src/routes/enrollment.ts     # POST /targets/enrollment-token, POST /targets/enroll,
                             # GET /targets, DELETE /targets/:id,
                             # GET /targets/install-manifest
src/routes/heartbeat.ts      # POST /targets/:id/heartbeat
src/routes/bootstrap.ts      # GET /bootstrap/status, POST /bootstrap/validate,
                             # POST /bootstrap/complete
src/routes/oidc.ts           # GET /auth/oidc/callback
src/routes/audit.ts          # GET /audit
src/middleware/node-auth.ts  # Ed25519 signature verification middleware
src/jobs/heartbeat-monitor.ts # Background job: degraded/offline status updates
```

### 6. Dashboard — `apps/dashboard`

New pages:

```
app/device-approval/page.tsx   # Pending device auth requests
app/targets/page.tsx           # Target nodes list + detail panel
app/bootstrap/page.tsx         # First-run bootstrap setup
```

---

## Data Models

### `managed_targets`

```sql
CREATE TABLE managed_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  hostname      TEXT NOT NULL,
  os            TEXT NOT NULL,
  architecture  TEXT NOT NULL,
  ip_address    TEXT NOT NULL,
  profile       TEXT NOT NULL CHECK (profile IN ('core', 'full')),
  public_key    TEXT NOT NULL,          -- Ed25519 public key (PEM)
  status        TEXT NOT NULL DEFAULT 'online'
                  CHECK (status IN ('online', 'degraded', 'offline', 'revoked')),
  last_seen     TIMESTAMPTZ,
  service_status JSONB,
  system_metrics JSONB,
  cig_version   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `enrollment_tokens`

```sql
CREATE TABLE enrollment_tokens (
  token         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `bootstrap_tokens`

```sql
CREATE TABLE bootstrap_tokens (
  token         TEXT PRIMARY KEY,       -- 32-char random hex
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `device_auth_records`

```sql
CREATE TABLE device_auth_records (
  device_code   TEXT PRIMARY KEY,       -- 32 hex chars
  user_code     TEXT NOT NULL UNIQUE,   -- 8 alphanumeric
  user_id       TEXT,                   -- set on approval
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  ip_address    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  last_polled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `audit_events`

```sql
CREATE TABLE audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  actor       TEXT NOT NULL,            -- user_id or target_id
  ip_address  TEXT NOT NULL,
  outcome     TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_events (created_at DESC);
CREATE INDEX ON audit_events (actor);
```

### `admin_accounts` (self-hosted only)

```sql
CREATE TABLE admin_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Install Manifest (JSON structure)

```typescript
interface InstallManifest {
  profile: 'core' | 'full';
  services: string[];           // e.g. ["api", "dashboard", "neo4j", ...]
  env_overrides: Record<string, string>;
  node_identity: {
    target_id: string;
    public_key: string;
    private_key: string;        // returned once, never stored server-side
  };
  generated_secrets: Record<string, string>;
}
```

---

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Auth adapter token verification round trip

*For any* valid token issued by the configured issuer (Authentik in managed mode, CIG API in self-hosted mode), `adapter.verifyToken(token)` should return claims that include the original `sub` and `email` values. *For any* token issued by a different issuer or signed with a wrong key, `verifyToken` should throw.

**Validates: Requirements 2.1, 2.2**

### Property 2: Auth adapter rejects expired tokens

*For any* token whose `exp` claim is in the past, `adapter.verifyToken(token)` should throw with an error indicating `token_expired`.

**Validates: Requirements 2.10** *(edge case)*

### Property 3: Auth adapter rejects tampered tokens

*For any* token whose signature has been altered, `adapter.verifyToken(token)` should throw with an error indicating `token_invalid`.

**Validates: Requirements 2.11** *(edge case)*

### Property 4: Device authorize response completeness and format

*For any* call to `POST /api/v1/auth/device/authorize`, the response should contain a `device_code` of exactly 32 lowercase hex characters, a `user_code` of exactly 8 alphanumeric characters, a non-empty `verification_uri`, and `expires_in: 900`.

**Validates: Requirements 3.1, 12.1, 12.2**

### Property 5: Token storage round trip

*For any* `AuthTokens` value, storing it via `CredentialManager.saveTokens()` and then loading it via `loadTokens()` should return an equivalent value.

**Validates: Requirements 3.5**

### Property 6: Token refresh predicate correctness

*For any* `AuthTokens` where `expiresAt < Date.now() + 5 * 60 * 1000`, `CredentialManager.needsRefresh()` should return `true`; otherwise it should return `false`.

**Validates: Requirements 3.9**

### Property 7: Enrollment token single-use invariant

*For any* enrollment token, using it once via `POST /api/v1/targets/enroll` should succeed; any subsequent use of the same token should return HTTP 410 with error code `token_consumed`.

**Validates: Requirements 4.2, 13.2, 13.5**

### Property 8: Node identity key pair validity

*For any* successful enrollment, the returned `private_key` and `public_key` should form a valid Ed25519 key pair — i.e., a message signed with the private key should verify against the public key.

**Validates: Requirements 4.4, 13.4**

### Property 9: Bootstrap token format

*For any* generated bootstrap token, it should be exactly 32 characters of cryptographically random hex (or alphanumeric) content.

**Validates: Requirements 5.3**

### Property 10: Bootstrap token single-use invariant

*For any* bootstrap token, calling `POST /api/v1/bootstrap/complete` with it once should succeed and return a session token; any subsequent call with the same token should return HTTP 409 with error code `bootstrap_already_complete`.

**Validates: Requirements 5.10, 5.11, 15.4, 15.5**

### Property 11: Password length validation

*For any* password string with fewer than 12 characters, `POST /api/v1/bootstrap/complete` should return HTTP 422 with error code `password_too_short`.

**Validates: Requirements 5.8, 15.7**

### Property 12: Prerequisite check correctness

*For any* mocked system state (Docker present/absent, memory available/insufficient, ports free/occupied), each prerequisite check function should return `pass` when the condition is met and `fail` with a remediation message when it is not.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

### Property 13: Compose generation completeness

*For any* valid `InstallManifest` with profile `core` or `full`, the generated `docker-compose.yml` should contain a service entry for every service listed in the manifest's `services` array.

**Validates: Requirements 7.7, 6.2, 6.3**

### Property 14: Generated secrets uniqueness

*For any* two independent calls to the secret generation function, the returned secrets should be distinct (collision probability negligible with 256-bit entropy).

**Validates: Requirements 7.8**

### Property 15: Ed25519 heartbeat signature round trip

*For any* request body bytes and Ed25519 key pair, signing the body with the private key and verifying with the public key should succeed; verifying with a different public key should fail.

**Validates: Requirements 8.3, 8.4, 14.2**

### Property 16: Internal JWT round trip

*For any* service name and HMAC secret, `verifyInternalToken(createInternalToken(serviceName, secret), secret)` should return a payload with `iss === "cig-internal"` and `sub === serviceName`. A token verified with a different secret should throw.

**Validates: Requirements 17.1, 17.2, 17.3, 17.4**

### Property 17: Audit event completeness

*For any* auditable action (device authorized, enrolled, heartbeat failure, bootstrap completed, etc.), after the action completes an audit event should exist in `audit_events` with the correct `event_type`, a non-null `actor`, a non-null `ip_address`, and `outcome` set to `success` or `failure`.

**Validates: Requirements 18.1, 18.2**

### Property 18: Audit write failure does not block primary operation

*For any* auditable action where the audit write is forced to fail (e.g., DB unavailable), the primary operation should still complete successfully and return the expected response.

**Validates: Requirements 18.5**

### Property 19: Blueprint deployment outputs completeness

*For any* successful `AuthentikInfraBlueprint.deploy()` call, the result should contain non-empty `issuerUrl`, `oidcClientId`, and `oidcClientSecret` fields.

**Validates: Requirements 1.7**

### Property 20: Blueprint deployment failure triggers rollback

*For any* deployment that fails at any phase, a `DeploymentError` should be thrown with a non-empty message, and the deployer should have attempted to destroy provisioned resources.

**Validates: Requirements 1.8**

---

## Error Handling

### Auth Errors

| Condition | HTTP | Error Code |
|---|---|---|
| OIDC token expired | 401 | `token_expired` |
| OIDC token signature invalid | 401 | `token_invalid` |
| Internal JWT wrong issuer | 401 | `invalid_issuer` |
| OIDC state mismatch | 400 | `invalid_state` |
| Authentik upstream failure | 502 | `oidc_upstream_error` |

### Enrollment / Bootstrap Errors

| Condition | HTTP | Error Code |
|---|---|---|
| Enrollment token expired or used | 410 | `token_consumed` |
| Bootstrap token expired | 401 | `bootstrap_token_expired` |
| Bootstrap already complete | 409 | `bootstrap_already_complete` |
| Password too short | 422 | `password_too_short` |
| Bootstrap from non-localhost (self-hosted) | 403 | `forbidden_origin` |

### Heartbeat Errors

| Condition | HTTP | Error Code |
|---|---|---|
| Ed25519 signature invalid | 401 | `invalid_signature` |
| Rate limit exceeded | 429 | `rate_limited` |

### Device Auth Errors

| Condition | HTTP / Response |
|---|---|
| Poll too fast | `{ status: "slow_down" }` |
| Device code expired/unknown | `{ status: "expired" }` |
| Device denied | `{ status: "denied" }` |

### General Principles

- All errors return `{ error: string, code: string, statusCode: number }` JSON
- Audit write failures are logged to the application logger but never propagate to the caller
- Deployment rollback errors are logged but the original error is re-thrown
- CLI exits with code 1 on any unrecoverable error; prerequisite failures include remediation steps

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests cover specific examples, integration points, and error conditions
- Property tests verify universal correctness across randomized inputs

### Property-Based Testing

**Library**: `fast-check` (TypeScript, works in both Node and browser environments)

Each property test must:
- Run a minimum of **100 iterations** (fast-check default; increase to 1000 for crypto properties)
- Include a comment tag in the format: `// Feature: cig-auth-provisioning, Property N: <property_text>`
- Be implemented as a single `fc.assert(fc.property(...))` call per design property

Property test files:
```
packages/auth/src/__tests__/auth-adapter.property.test.ts      # Properties 1, 2, 3
packages/auth/src/__tests__/internal-jwt.property.test.ts      # Property 16
packages/cli/src/__tests__/credentials.property.test.ts        # Properties 5, 6
packages/cli/src/__tests__/bootstrap-token.property.test.ts    # Property 9
packages/cli/src/__tests__/prereqs.property.test.ts            # Property 12
packages/cli/src/__tests__/compose-generator.property.test.ts  # Properties 13, 14
packages/api/src/__tests__/device-auth.property.test.ts        # Property 4
packages/api/src/__tests__/enrollment.property.test.ts         # Properties 7, 8
packages/api/src/__tests__/bootstrap.property.test.ts          # Properties 10, 11
packages/api/src/__tests__/heartbeat.property.test.ts          # Property 15
packages/api/src/__tests__/audit.property.test.ts              # Properties 17, 18
packages/infra/src/__tests__/blueprint.property.test.ts        # Properties 19, 20
```

### Unit Tests

Unit test files cover:
- `createAuthAdapter` returns the correct adapter type per mode
- OIDC callback endpoint: valid code exchange, state mismatch, upstream error
- Device auth flow: full approve/deny/expire lifecycle
- Bootstrap status endpoint: returns `requires_bootstrap: true` with empty admin table
- Poll rate limiting: second rapid poll returns `slow_down`
- Heartbeat background job: nodes transition to `degraded` / `offline` at correct intervals
- Dashboard bootstrap page: redirects to `/bootstrap` when `requires_bootstrap: true`
- Dashboard targets page: renders correct status indicators per node status
- Node revocation: `DELETE /targets/:id` sets status to `revoked`

### Integration Tests

- Full managed-mode login flow: authorize → approve → poll → tokens stored
- Full self-hosted install flow: bootstrap token generated → bootstrap/complete → session returned
- Full enrollment flow: enrollment-token → enroll → install-manifest
- Heartbeat signature verification end-to-end

### Test Configuration

```typescript
// fast-check configuration for crypto-sensitive properties
fc.configureGlobal({ numRuns: 1000 });

// Standard properties
fc.configureGlobal({ numRuns: 100 });
```
