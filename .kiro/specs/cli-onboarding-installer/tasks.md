# Implementation Tasks: CIG CLI Onboarding & Installer

## Overview

This task list implements the CIG CLI Onboarding & Installer feature following the 10-phase implementation plan from the design document. The implementation covers device authorization, target enrollment, Docker-based installation, heartbeat monitoring, and dashboard integration for both managed and self-hosted modes.

## Implementation Language

**TypeScript** - All CLI, API, and Dashboard components will be implemented in TypeScript using the existing monorepo structure.

## Task Execution Guidelines

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property-based tests reference design document property numbers
- Checkpoints ensure incremental validation throughout implementation
- All code must pass linting, type checking, and existing tests before proceeding

## Tasks

- [ ] 1. Phase 1: Foundation and Authentication (Week 1-2)
  - [x] 1.1 Enhance CredentialManager for tokens and identities
    - Extend existing packages/cli/src/credential-manager.ts to support AuthTokens interface
    - Add saveTokens(), loadTokens(), saveIdentity(), loadIdentity() methods
    - Add saveBootstrapToken(), loadBootstrapToken() methods
    - Implement needsRefresh() and isRefreshTokenValid() helper methods
    - _Requirements: 1.8, 2.1, 2.3, 2.5, 3.7, 7.10, 17.3_

  - [ ]* 1.2 Write property test for credential encryption round-trip
    - **Property 1: Credential Encryption Round-Trip**
    - **Validates: Requirements 1.8, 2.1, 2.5, 3.7, 17.3**
    - Create packages/cli/src/managers/credential-manager.property.test.ts
    - Use fast-check to generate random AuthTokens, TargetIdentity, BootstrapToken
    - Verify encrypt-then-decrypt produces equivalent data
    - Run 100 iterations minimum

  - [ ]* 1.3 Write property test for encryption key derivation determinism
    - **Property 2: Encryption Key Derivation Determinism**
    - **Validates: Requirements 2.2**
    - Verify deriveEncryptionKey() returns same key across multiple calls
    - Run 100 iterations minimum

  - [ ]* 1.4 Write property test for file permission enforcement
    - **Property 3: File Permission Enforcement**
    - **Validates: Requirements 2.3**
    - Verify all credential files created have 0600 permissions
    - Test on Linux/macOS (skip on Windows)

  - [x] 1.5 Create StateManager for installation state persistence
    - Create packages/cli/src/managers/state-manager.ts
    - Implement InstallationState interface with version, mode, profile, installDir, status, services
    - Implement save(), load(), update(), delete() methods
    - Implement validateInstallDir() to check installation directory exists
    - Store state in ~/.cig/state.json with 0600 permissions
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [~] 1.6 Create ApiClient for CIG cloud API communication
    - Create packages/cli/src/services/api-client.ts
    - Implement get(), post(), delete() methods with fetch
    - Add setAccessToken() for authentication
    - Add getInstallManifest() method
    - Use CIG_CLOUD_API_URL from @cig/config
    - _Requirements: 8.4, 8.6, 23.1_

  - [~] 1.7 Implement AuthService with device authorization flow
    - Create packages/cli/src/services/auth.ts
    - Implement initiateDeviceAuth() to request device code
    - Implement pollForToken() with exponential backoff (5s → 15s max)
    - Implement saveTokens() to store encrypted tokens
    - Implement getValidToken() with automatic refresh
    - Implement refreshToken() for token rotation
    - Implement logout() to clear credentials
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.6, 2.7, 30.3_

  - [ ]* 1.8 Write property test for exponential backoff timing
    - **Property 5: Exponential Backoff Timing**
    - **Validates: Requirements 1.6, 16.10**
    - Verify each retry interval is at most 1.5x previous interval
    - Verify no interval exceeds specified maximum (15 seconds)
    - Run 100 iterations minimum

  - [~] 1.9 Implement login command
    - Create packages/cli/src/commands/login.ts
    - Implement LoginCommand class with execute() method
    - Display device code, user code, and verification URL
    - Display QR code URL for mobile approval
    - Poll API every 5 seconds with exponential backoff
    - Display success message when approved
    - Handle expiration (15 minutes) and denial gracefully
    - Register command in packages/cli/src/index.ts
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [~] 1.10 Implement logout command
    - Create packages/cli/src/commands/logout.ts
    - Implement LogoutCommand class with execute() method
    - Call CredentialManager.clearAll() to delete all credentials
    - Display confirmation message
    - Register command in packages/cli/src/index.ts
    - _Requirements: 2.8_

  - [~] 1.11 Add rate limiting middleware to API
    - Create packages/api/src/plugins/rate-limit.ts
    - Configure @fastify/rate-limit plugin
    - Set global rate limits and per-endpoint overrides
    - Return 429 with Retry-After header when exceeded
    - _Requirements: 19.13, 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7_

  - [ ]* 1.12 Write property test for rate limit enforcement
    - **Property 14: Rate Limit Enforcement**
    - **Validates: Requirements 19.13, 32.6**
    - Verify exceeding rate limit returns HTTP 429
    - Verify Retry-After header is present
    - Run 100 iterations minimum

  - [~] 1.13 Implement API device authorization endpoints
    - Create packages/api/src/routes/auth/device.ts
    - Implement POST /api/v1/auth/device/authorize endpoint
    - Generate device_code (32 chars) and user_code (6-8 chars)
    - Store authorization with 15-minute expiration
    - Return device_code, user_code, verification_uri, expires_in, interval
    - Implement POST /api/v1/auth/device/poll endpoint
    - Check authorization status (pending, approved, denied, expired)
    - Return tokens when approved
    - Implement POST /api/v1/auth/device/approve endpoint (requires auth)
    - Mark device as approved and associate with user
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 19.12, 19.13_

  - [ ]* 1.14 Write property test for token format validation
    - **Property 4: Token Format Validation**
    - **Validates: Requirements 1.2, 1.3, 7.3, 19.2**
    - Verify device codes are 32 hex characters
    - Verify user codes are 6-8 alphanumeric characters
    - Verify enrollment tokens are UUIDs
    - Verify bootstrap tokens are 32 hex characters
    - Run 100 iterations minimum

  - [~] 1.15 Create database migration for device_authorizations table
    - Create packages/api/migrations/001_create_device_authorizations.sql
    - Define table with id, device_code, user_code, user_id, status, ip_address, created_at, expires_at
    - Add indexes on device_code, user_code, status, expires_at
    - Add cleanup function for expired records (>24 hours)
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7_

  - [~] 1.16 Create Dashboard device approval component
    - Create apps/dashboard/components/DeviceApproval.tsx
    - Fetch pending device authorizations from API every 5 seconds
    - Display user_code, ip_address, created_at for each request
    - Implement approve and deny buttons
    - Remove from list when approved/denied/expired
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [ ]* 1.17 Write unit tests for AuthService
    - Test initiateDeviceAuth() returns valid response
    - Test pollForToken() handles pending, approved, denied, expired states
    - Test token refresh when access token expires
    - Test error handling for network failures
    - Achieve >80% code coverage

  - [ ]* 1.18 Write integration tests for device auth flow
    - Test complete flow: authorize → poll → approve → receive tokens
    - Test expiration after 15 minutes
    - Test denial flow
    - Test rate limiting enforcement
    - Use mock API server for fast execution

  - [~] 1.19 Checkpoint - Ensure authentication tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 2. Phase 2: Target Enrollment (Week 3)
  - [~] 2.1 Implement Ed25519 key pair generation utilities
    - Create packages/cli/src/utils/crypto.ts
    - Implement generateEd25519KeyPair() using @noble/curves/ed25519
    - Implement signMessage() for signing with private key
    - Implement verifyEd25519Signature() for verification with public key
    - Add to packages/api/src/utils/crypto.ts for API-side verification
    - _Requirements: 3.5, 16.4, 20.6, 21.3_

  - [ ]* 2.2 Write property test for Ed25519 signature round-trip
    - **Property 8: Ed25519 Signature Round-Trip**
    - **Validates: Requirements 16.4, 20.6, 21.3**
    - Generate random key pairs and messages
    - Verify signing then verifying succeeds
    - Verify verifying with wrong public key fails
    - Run 100 iterations minimum

  - [~] 2.3 Implement EnrollmentService in CLI
    - Create packages/cli/src/services/enrollment.ts
    - Implement requestEnrollmentToken() to get token from API
    - Implement collectMetadata() to gather hostname, OS, architecture, IP
    - Implement enroll() to send enrollment request with token and metadata
    - Store returned TargetIdentity securely via CredentialManager
    - Implement getIdentity() to retrieve stored identity
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.10_

  - [~] 2.4 Create database migrations for enrollment tables
    - Create packages/api/migrations/002_create_targets.sql
    - Define targets table with id (UUID), user_id, hostname, os, architecture, ip_address, install_profile, status, public_key, created_at, last_seen_at
    - Add indexes on user_id, status, last_seen_at
    - Create packages/api/migrations/003_create_enrollment_tokens.sql
    - Define enrollment_tokens table with id, user_id, token (UUID), used, created_at, expires_at
    - Add indexes on token, user_id, expires_at
    - Add cleanup function for expired tokens (>24 hours)
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

  - [~] 2.5 Implement API enrollment endpoints
    - Create packages/api/src/routes/targets/enrollment.ts
    - Implement POST /api/v1/targets/enrollment-token endpoint (requires auth)
    - Generate UUID token with 10-minute expiration
    - Implement POST /api/v1/targets/enroll endpoint
    - Validate enrollment token
    - Generate Ed25519 key pair for target identity
    - Create target record with metadata
    - Mark token as used
    - Return targetId, publicKey, privateKey
    - Implement GET /api/v1/targets endpoint (requires auth)
    - List all targets for authenticated user
    - Implement DELETE /api/v1/targets/:id endpoint (requires auth)
    - Revoke target identity
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10_

  - [ ]* 2.6 Write property test for token single-use constraint
    - **Property 6: Token Single-Use Constraint**
    - **Validates: Requirements 3.2**
    - Verify enrollment token can only be used once
    - Verify second use returns error
    - Run 100 iterations minimum

  - [~] 2.7 Implement audit logging service
    - Create packages/api/src/services/audit.ts
    - Implement AuditService with log() method
    - Store event_type, user_id, target_id, ip_address, details, timestamp
    - Add audit logging to device auth approve/deny
    - Add audit logging to target enrollment
    - Add audit logging to target revocation
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6_

  - [~] 2.8 Create database migration for audit_logs table
    - Create packages/api/migrations/006_create_audit_logs.sql
    - Define audit_logs table with id, event_type, user_id, target_id, ip_address, details (JSONB), created_at
    - Add indexes on event_type, user_id, target_id, created_at
    - Add cleanup function for old logs (>90 days)
    - _Requirements: 31.7, 31.8, 31.9_

  - [~] 2.9 Implement enroll command
    - Create packages/cli/src/commands/enroll.ts
    - Implement EnrollCommand class with execute() method
    - Check authentication status (require cig login first)
    - Request enrollment token from API
    - Collect target machine metadata
    - Send enrollment request
    - Store target identity securely
    - Display success message with target ID
    - Register command in packages/cli/src/index.ts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 2.10 Write unit tests for EnrollmentService
    - Test requestEnrollmentToken() returns valid UUID
    - Test collectMetadata() gathers correct system info
    - Test enroll() stores identity correctly
    - Test error handling for invalid tokens
    - Achieve >80% code coverage

  - [ ]* 2.11 Write integration tests for enrollment flow
    - Test complete flow: login → request token → enroll → verify identity stored
    - Test token expiration after 10 minutes
    - Test token single-use constraint
    - Test enrollment with invalid token fails
    - Use mock API server for fast execution

  - [~] 2.12 Checkpoint - Ensure enrollment tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Phase 3: Installation Engine (Week 4-5)
  - [~] 3.1 Create Docker Compose templates
    - Create infra/docker/docker-compose.core.yml template
    - Include services: api, neo4j, dashboard, discovery, cartography
    - Use environment variable placeholders (${NEO4J_PASSWORD}, ${JWT_SECRET}, etc.)
    - Create infra/docker/docker-compose.full.yml template
    - Include all core services plus: chatbot, chroma, agents
    - Copy templates to packages/cli/templates/ during build
    - _Requirements: 5.2, 5.3, 6.1, 6.2, 44.1, 44.2, 44.3, 44.4, 44.5_

  - [~] 3.2 Implement DockerService for container orchestration
    - Create packages/cli/src/services/docker.ts
    - Implement isInstalled() to check Docker availability
    - Implement isRunning() to check Docker daemon status
    - Implement isComposeAvailable() to check Docker Compose v2.0+
    - Implement composeUp() to start services
    - Implement composeDown() to stop and remove services
    - Implement composeStart(), composeStop(), composeRestart() for lifecycle
    - Implement getServiceStatus() to query container status
    - Implement getLogs() to retrieve service logs
    - Implement checkPortAvailable() to verify ports are free
    - _Requirements: 4.1, 4.2, 6.6, 9.2, 9.3, 10.2, 11.4, 11.5, 11.6_

  - [~] 3.3 Implement PrerequisiteValidator
    - Create packages/cli/src/validators/prerequisites.ts
    - Implement validate() method that checks all prerequisites
    - Check Docker installed and running
    - Check Docker Compose v2.0+ available
    - Check minimum 4GB RAM available
    - Check minimum 10GB disk space available
    - Check required ports not in use (3000, 7474, 7687, 8000, 8080)
    - Return ValidationResult with success flag and error list
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [~] 3.4 Implement InstallationService core logic
    - Create packages/cli/src/services/installation.ts
    - Implement install() method with InstallConfig parameter
    - Create installation directory with 0700 permissions
    - Generate secure random secrets (NEO4J_PASSWORD, JWT_SECRET, API_SECRET)
    - Select compose template based on profile (core/full)
    - Write docker-compose.yml to installation directory
    - Write .env file with secrets (0600 permissions)
    - Call DockerService.composeUp() to start services
    - Implement waitForHealthy() to poll container health (max 5 minutes)
    - Save installation state via StateManager
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [ ]* 3.5 Write property test for password generation entropy
    - **Property 7: Password Generation Entropy**
    - **Validates: Requirements 6.3**
    - Verify generated passwords have at least 128 bits entropy (16 random bytes)
    - Run 100 iterations minimum

  - [~] 3.6 Implement rollback mechanism
    - Add rollback() method to InstallationService
    - Stop all running CIG containers via DockerService.composeDown()
    - Remove containers and networks
    - Preserve data volumes unless --purge-data flag set
    - Delete docker-compose.yml and .env files
    - Delete installation state via StateManager
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

  - [ ]* 3.7 Write property test for rollback container cleanup
    - **Property 11: Rollback Container Cleanup**
    - **Validates: Requirements 9.2**
    - Verify no CIG containers running after rollback
    - Run 100 iterations minimum

  - [ ]* 3.8 Write property test for rollback volume preservation
    - **Property 12: Rollback Volume Preservation**
    - **Validates: Requirements 9.4**
    - Verify Docker volumes exist after rollback without --purge-data
    - Verify volumes removed with --purge-data
    - Run 100 iterations minimum

  - [~] 3.9 Implement install command
    - Create packages/cli/src/commands/install.ts
    - Implement InstallCommand class with execute() method
    - Check for existing installation (fail unless --force)
    - Run prerequisite validation via PrerequisiteValidator
    - Prompt for mode (managed/self-hosted) if not specified
    - Prompt for profile (core/full) if not specified
    - For managed mode: require authentication, complete enrollment
    - For self-hosted mode: skip auth/enrollment
    - Call InstallationService.install()
    - Handle errors with rollback prompt
    - Display success message with Dashboard URL
    - Register command in packages/cli/src/index.ts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1-6.10, 8.1-8.10, 9.1_

  - [ ]* 3.10 Write property test for installation idempotency detection
    - **Property 19: Installation Idempotency Detection**
    - **Validates: Requirements 49.1**
    - Verify cig install detects existing installation
    - Verify prompts user instead of proceeding automatically
    - Run 100 iterations minimum

  - [~] 3.11 Implement uninstall command
    - Create packages/cli/src/commands/uninstall.ts
    - Implement UninstallCommand class with execute() method
    - Prompt for confirmation before proceeding
    - Load installation state via StateManager
    - Call InstallationService.rollback()
    - Support --purge-data flag to remove volumes
    - Display summary of cleaned resources
    - Register command in packages/cli/src/index.ts
    - _Requirements: 9.8, 9.9, 9.10_

  - [~] 3.12 Implement doctor command
    - Create packages/cli/src/commands/doctor.ts
    - Implement DoctorCommand class with execute() method
    - Run PrerequisiteValidator.validate()
    - Display detailed results for each check
    - Display green checkmark for passed checks
    - Display red X for failed checks with remediation steps
    - Display overall system readiness summary
    - Register command in packages/cli/src/index.ts
    - _Requirements: 4.8, 4.9_

  - [ ]* 3.13 Write property test for error message remediation
    - **Property 18: Error Message Remediation**
    - **Validates: Requirements 4.6**
    - Verify prerequisite check failures include problem description
    - Verify error messages include suggested remediation steps
    - Run 100 iterations minimum

  - [ ]* 3.14 Write unit tests for InstallationService
    - Test install() creates correct directory structure
    - Test secret generation produces unique values
    - Test compose template selection based on profile
    - Test waitForHealthy() timeout handling
    - Test rollback() cleanup
    - Achieve >80% code coverage

  - [ ]* 3.15 Write integration tests for installation flow
    - Test self-hosted installation end-to-end
    - Test managed installation end-to-end
    - Test rollback on failure
    - Test uninstall cleanup
    - Test doctor command output
    - Use mock Docker for fast execution

  - [ ]* 3.16 Write E2E tests with real Docker containers
    - Test complete installation with real Docker Compose
    - Verify all services start and become healthy
    - Verify Dashboard accessible
    - Verify API health endpoint responds
    - Test uninstall removes all containers
    - Run in CI with Docker-in-Docker

  - [~] 3.17 Checkpoint - Ensure installation tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Phase 4: Bootstrap and Manifest (Week 6)
  - [~] 4.1 Implement bootstrap token generation in CLI
    - Add generateBootstrapToken() to InstallationService
    - Generate 32-character random hex string
    - Set expiration to 30 minutes after first use
    - Store via CredentialManager.saveBootstrapToken()
    - Display token and Dashboard URL after self-hosted installation
    - _Requirements: 7.3, 7.4, 7.5, 7.10_

  - [~] 4.2 Create database migration for bootstrap_tokens table
    - Create packages/api/migrations/004_create_bootstrap_tokens.sql
    - Define bootstrap_tokens table with id, token, used, first_used_at, created_at, expires_at
    - Add index on token
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7_

  - [~] 4.3 Implement API bootstrap endpoints
    - Create packages/api/src/routes/bootstrap.ts
    - Implement POST /api/v1/bootstrap/init endpoint (localhost only)
    - Generate 32-character bootstrap token
    - Store with no expiration until first use
    - Implement POST /api/v1/bootstrap/complete endpoint
    - Validate bootstrap token
    - Check no admin accounts exist
    - Create admin account with bcrypt password hash
    - Mark token as used
    - Return access and refresh tokens
    - Implement GET /api/v1/bootstrap/status endpoint
    - Return requiresBootstrap: true if no admin accounts exist
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10_

  - [~] 4.4 Create Dashboard bootstrap page
    - Create apps/dashboard/app/bootstrap/page.tsx
    - Check bootstrap status via GET /api/v1/bootstrap/status
    - Redirect to login if bootstrap not required
    - Display bootstrap form with token, username, email, password fields
    - Validate password minimum 12 characters
    - Submit to POST /api/v1/bootstrap/complete
    - Store returned tokens in localStorage
    - Redirect to dashboard on success
    - Display error message on failure
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

  - [~] 4.5 Implement bootstrap-reset command
    - Create packages/cli/src/commands/bootstrap-reset.ts
    - Implement BootstrapResetCommand class with execute() method
    - Check installation is self-hosted mode
    - Call API POST /api/v1/bootstrap/init endpoint
    - Store new bootstrap token via CredentialManager
    - Display new token and Dashboard URL
    - Register command in packages/cli/src/index.ts
    - _Requirements: 7.9_

  - [~] 4.6 Implement install manifest endpoint in API
    - Create packages/api/src/routes/targets/manifest.ts
    - Implement GET /api/v1/targets/install-manifest endpoint
    - Require valid enrollment token for authentication
    - Load compose template based on target's install profile
    - Generate environment variables with secrets
    - Include target identity credentials
    - Include CIG cloud API endpoint URL
    - Include service versions (Docker image tags)
    - Return dockerComposeTemplate, environmentVariables, serviceVersions
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9, 23.10_

  - [~] 4.7 Integrate manifest fetching in CLI installation
    - Update InstallationService.install() for managed mode
    - Call ApiClient.getInstallManifest() after enrollment
    - Use returned template and environment variables
    - Merge manifest env vars with generated secrets
    - Write compose file and .env file
    - Continue with normal installation flow
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ]* 4.8 Write unit tests for bootstrap flow
    - Test bootstrap token generation
    - Test bootstrap complete with valid token
    - Test bootstrap complete fails if admin exists
    - Test bootstrap status endpoint
    - Achieve >80% code coverage

  - [ ]* 4.9 Write E2E tests for Dashboard bootstrap
    - Test bootstrap page displays when no admin exists
    - Test bootstrap form submission with valid token
    - Test bootstrap form validation (password length, email format)
    - Test error handling for invalid token
    - Test redirect to login after successful bootstrap
    - Use Playwright for E2E testing

  - [ ]* 4.10 Write integration tests for manifest endpoint
    - Test manifest endpoint requires valid enrollment token
    - Test manifest includes correct compose template
    - Test manifest includes environment variables
    - Test manifest includes target identity credentials
    - Test manifest endpoint returns 401 for invalid token

  - [~] 4.11 Checkpoint - Ensure bootstrap and manifest tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 5: Heartbeat and Monitoring (Week 7)
  - [~] 5.1 Create database migration for target_heartbeats table
    - Create packages/api/migrations/005_create_target_heartbeats.sql
    - Define target_heartbeats table with id, target_id, service_status (JSONB), cpu_usage, memory_usage, disk_usage, created_at
    - Add indexes on target_id, created_at
    - Add cleanup function for old heartbeats (>30 days)
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_

  - [~] 5.2 Implement HeartbeatService in target API
    - Create packages/api/src/services/heartbeat-client.ts (runs on target machine)
    - Implement collectServiceStatus() to query Docker container health
    - Implement collectSystemMetrics() to gather CPU, memory, disk usage
    - Implement signHeartbeat() to create Ed25519 signature
    - Implement sendHeartbeat() to POST to cloud API every 60 seconds
    - Implement exponential backoff on failure (5s → 60s max)
    - Start heartbeat loop when API service starts in managed mode
    - _Requirements: 8.8, 16.1, 16.2, 16.9, 16.10_

  - [ ]* 5.3 Write property test for heartbeat message structure
    - **Property 9: Heartbeat Message Structure**
    - **Validates: Requirements 16.2**
    - Verify heartbeat contains targetId, serviceStatus, systemMetrics, signature
    - Verify systemMetrics contains cpuUsage, memoryUsage, diskUsage
    - Run 100 iterations minimum

  - [ ]* 5.4 Write property test for heartbeat timing interval
    - **Property 10: Heartbeat Timing Interval**
    - **Validates: Requirements 8.8**
    - Verify time between consecutive heartbeats is ~60 seconds (±5s tolerance)
    - Run 100 iterations minimum

  - [~] 5.5 Implement API heartbeat endpoint
    - Create packages/api/src/routes/targets/heartbeat.ts
    - Implement POST /api/v1/targets/:id/heartbeat endpoint
    - Validate target exists
    - Verify Ed25519 signature using target's public key
    - Update target's last_seen_at timestamp
    - Update target status to 'online'
    - Store heartbeat data in target_heartbeats table
    - Emit WebSocket event for real-time Dashboard updates
    - Return 401 if signature invalid (mark target 'unauthorized')
    - Rate limit to 1 request per 30 seconds per target
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10_

  - [~] 5.6 Implement status update logic for degraded/offline
    - Create scheduled job in API to check target last_seen_at
    - Mark targets 'degraded' if no heartbeat for 5 minutes
    - Mark targets 'offline' if no heartbeat for 15 minutes
    - Mark targets 'online' when heartbeat resumes
    - Run check every minute
    - _Requirements: 16.6, 16.7, 16.8_

  - [ ]* 5.7 Write property test for timestamp monotonicity
    - **Property 15: Timestamp Monotonicity**
    - **Validates: Requirements 25.6**
    - Verify last_seen_at increases or stays same after each heartbeat
    - Run 100 iterations minimum

  - [~] 5.8 Create Dashboard target management component
    - Create apps/dashboard/components/TargetList.tsx
    - Fetch targets from GET /api/v1/targets endpoint
    - Display table with hostname, OS, profile, status, last_seen_at
    - Color-code status: green (online), yellow (degraded), red (offline/unauthorized)
    - Listen for WebSocket 'target:heartbeat' events for real-time updates
    - Implement "Revoke Access" button calling DELETE /api/v1/targets/:id
    - Implement "Open Dashboard" button linking to target's local Dashboard
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [~] 5.9 Implement status command
    - Create packages/cli/src/commands/status.ts
    - Implement StatusCommand class with execute() method
    - Load installation state via StateManager
    - Query Docker for container status via DockerService.getServiceStatus()
    - Display service health check results
    - For managed mode: display enrollment status and last heartbeat
    - Display Dashboard URL and accessibility
    - Display diagnostic info for unhealthy services
    - Support --json flag for machine-readable output
    - Register command in packages/cli/src/index.ts
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [ ]* 5.10 Write property test for status reporting accuracy
    - **Property 13: Status Reporting Accuracy**
    - **Validates: Requirements 10.2**
    - Verify CLI status matches actual Docker container state
    - Test running, stopped, restarting, unhealthy states
    - Run 100 iterations minimum

  - [ ]* 5.11 Write unit tests for HeartbeatService
    - Test collectServiceStatus() returns correct format
    - Test collectSystemMetrics() returns valid percentages
    - Test signHeartbeat() produces valid signature
    - Test sendHeartbeat() retries on failure
    - Achieve >80% code coverage

  - [ ]* 5.12 Write integration tests for heartbeat processing
    - Test heartbeat endpoint validates signature
    - Test heartbeat updates last_seen_at
    - Test heartbeat updates target status to online
    - Test invalid signature marks target unauthorized
    - Test WebSocket event emitted on heartbeat
    - Test status update job marks targets degraded/offline

  - [~] 5.13 Checkpoint - Ensure heartbeat and monitoring tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Phase 6: Service Lifecycle Management (Week 8)
  - [~] 6.1 Implement start command
    - Create packages/cli/src/commands/start.ts
    - Implement StartCommand class with execute() method
    - Load installation state via StateManager
    - Check if services already running (display message if so)
    - Call DockerService.composeStart()
    - Display real-time progress for each service
    - Update installation state status to 'running'
    - Support --service flag to start specific service
    - Register command in packages/cli/src/index.ts
    - _Requirements: 11.1, 11.4, 11.7, 11.9_

  - [~] 6.2 Implement stop command
    - Create packages/cli/src/commands/stop.ts
    - Implement StopCommand class with execute() method
    - Load installation state via StateManager
    - Check if services already stopped (display message if so)
    - Call DockerService.composeStop()
    - Display real-time progress for each service
    - Update installation state status to 'stopped'
    - Support --service flag to stop specific service
    - Register command in packages/cli/src/index.ts
    - _Requirements: 11.2, 11.5, 11.7, 11.9_

  - [~] 6.3 Implement restart command
    - Create packages/cli/src/commands/restart.ts
    - Implement RestartCommand class with execute() method
    - Load installation state via StateManager
    - Call DockerService.composeRestart()
    - Display real-time progress for each service
    - Support --service flag to restart specific service
    - Register command in packages/cli/src/index.ts
    - _Requirements: 11.3, 11.6, 11.7, 11.9_

  - [ ]* 6.4 Write property test for service lifecycle idempotency
    - **Property 20: Service Lifecycle Idempotency**
    - **Validates: Requirements 49.5**
    - Verify cig start on running services completes successfully
    - Verify cig stop on stopped services completes successfully
    - Verify appropriate message displayed
    - Run 100 iterations minimum

  - [~] 6.5 Implement logs command
    - Create packages/cli/src/commands/logs.ts
    - Implement LogsCommand class with execute() method
    - Load installation state via StateManager
    - Call DockerService.getLogs() with options
    - Support --service flag to filter by service
    - Support --follow flag to stream logs in real-time
    - Support --tail flag to limit lines (default 100)
    - Support --since flag to filter by timestamp
    - Color-code logs by service for readability
    - Support --export flag to save logs to file
    - Register command in packages/cli/src/index.ts
    - _Requirements: 54.1, 54.2, 54.3, 54.4, 54.5, 54.6, 54.7, 54.8_

  - [~] 6.6 Implement health command
    - Create packages/cli/src/commands/health.ts
    - Implement HealthCommand class with execute() method
    - Check Docker daemon status
    - Check all CIG service container status
    - Check service health endpoints (API /health, Neo4j, etc.)
    - Check network connectivity between services
    - Check disk space usage
    - Check memory usage
    - Calculate health score (0-100)
    - Display specific problems and remediation steps
    - Support --watch flag for continuous monitoring
    - Register command in packages/cli/src/index.ts
    - _Requirements: 53.1, 53.2, 53.3, 53.4, 53.5, 53.6, 53.7, 53.8, 53.9, 53.10_

  - [~] 6.7 Add progress indicators with ora spinners
    - Install ora package for CLI spinners
    - Create packages/cli/src/utils/progress.ts
    - Implement ProgressReporter class with start(), succeed(), fail() methods
    - Use ora spinners for indeterminate operations (health checks, polling)
    - Use cli-progress bars for determinate operations (image pulls)
    - Add color-coded output with chalk (green success, red errors, yellow warnings)
    - Support --quiet flag to suppress progress output
    - Support --verbose flag for detailed debug logs
    - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.7, 33.8, 33.9_

  - [ ]* 6.8 Write property test for progress indicator consistency
    - **Property 17: Progress Indicator Consistency**
    - **Validates: Requirements 33.3**
    - Verify successful operations display success indicator (✓)
    - Run 100 iterations minimum

  - [ ]* 6.9 Write unit tests for lifecycle commands
    - Test start command starts stopped services
    - Test stop command stops running services
    - Test restart command restarts services
    - Test --service flag targets specific service
    - Test idempotency (start on running, stop on stopped)
    - Achieve >80% code coverage

  - [ ]* 6.10 Write integration tests for lifecycle commands
    - Test complete lifecycle: install → stop → start → restart → uninstall
    - Test logs command output format
    - Test health command diagnostics
    - Test progress indicators display correctly
    - Use mock Docker for fast execution

  - [~] 6.11 Checkpoint - Ensure lifecycle management tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 7: Security Hardening (Week 9)
  - [~] 7.1 Implement token rotation for refresh tokens
    - Update API POST /api/v1/auth/refresh endpoint
    - When refresh token used, generate new refresh token
    - Invalidate old refresh token
    - Return new access token and new refresh token
    - Update CLI AuthService.refreshToken() to handle rotation
    - Store new tokens via CredentialManager
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7_

  - [~] 7.2 Add security headers to API responses
    - Install @fastify/helmet plugin
    - Configure Content-Security-Policy header
    - Configure X-Frame-Options: DENY
    - Configure X-Content-Type-Options: nosniff
    - Configure Strict-Transport-Security for HTTPS
    - Configure Referrer-Policy: no-referrer
    - _Requirements: Security best practices_

  - [~] 7.3 Implement IP address tracking for device auth
    - Update device authorization endpoints to capture request.ip
    - Store ip_address in device_authorizations table
    - Display IP address in Dashboard device approval component
    - Log IP address in audit logs for all auth events
    - _Requirements: 31.1, 31.5_

  - [ ]* 7.4 Write property test for encryption integrity validation
    - **Property 16: Encryption Integrity Validation**
    - **Validates: Requirements 29.5**
    - Tamper with ciphertext, IV, or tag
    - Verify decryption fails with authentication error
    - Run 100 iterations minimum

  - [ ]* 7.5 Write security-focused integration tests
    - Test rate limiting enforcement on all endpoints
    - Test token expiration and refresh
    - Test signature verification rejects invalid signatures
    - Test audit logging captures all security events
    - Test CSRF protection on Dashboard
    - Test security headers present in responses

  - [ ]* 7.6 Conduct security review
    - Review all credential storage for encryption
    - Review all API endpoints for authentication
    - Review all user input for validation
    - Review all SQL queries for injection prevention
    - Review all secrets for secure generation
    - Document security findings and remediations

  - [~] 7.7 Checkpoint - Ensure security hardening complete
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Phase 8: Documentation and Polish (Week 10)
  - [~] 8.1 Write user guide for managed mode setup
    - Create docs/guides/managed-mode-setup.md
    - Document prerequisites (Docker, account creation)
    - Document cig login flow with screenshots
    - Document cig install flow
    - Document Dashboard device approval
    - Document target management
    - Include troubleshooting section
    - _Requirements: 39.1, 39.2_

  - [~] 8.2 Write user guide for self-hosted mode setup
    - Create docs/guides/self-hosted-mode-setup.md
    - Document prerequisites (Docker)
    - Document cig install --mode self-hosted flow
    - Document bootstrap token usage
    - Document Dashboard bootstrap page
    - Include troubleshooting section
    - _Requirements: 39.1, 39.3_

  - [~] 8.3 Write CLI command reference
    - Create docs/reference/cli-commands.md
    - Document all commands with syntax, options, examples
    - Include cig login, logout, install, uninstall, enroll
    - Include cig start, stop, restart, status, logs, health
    - Include cig doctor, bootstrap-reset
    - Document all flags (--mode, --profile, --service, --json, etc.)
    - _Requirements: 39.5_

  - [~] 8.4 Write troubleshooting guide
    - Create docs/guides/troubleshooting.md
    - Document common issues and solutions
    - Docker not running → how to start Docker
    - Ports in use → how to identify and free ports
    - Network connectivity issues → how to diagnose
    - Service unhealthy → how to check logs and restart
    - Authentication failures → how to re-login
    - Include cig doctor command usage
    - _Requirements: 39.6, 34.1, 34.2, 34.3, 34.4, 34.5, 34.6_

  - [~] 8.5 Write API reference with OpenAPI spec
    - Create docs/reference/api-reference.md
    - Document all new endpoints with request/response examples
    - Include device authorization endpoints
    - Include enrollment endpoints
    - Include heartbeat endpoint
    - Include bootstrap endpoints
    - Include manifest endpoint
    - Generate OpenAPI/Swagger specification
    - Publish at /api/v1/docs endpoint
    - _Requirements: 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.7_

  - [~] 8.6 Improve error messages with remediation steps
    - Review all error messages in CLI commands
    - Ensure each error includes problem description
    - Ensure each error includes suggested remediation
    - Add specific instructions for common failures
    - Test error messages with users for clarity
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6_

  - [~] 8.7 Implement troubleshoot command
    - Create packages/cli/src/commands/troubleshoot.ts
    - Implement TroubleshootCommand class with execute() method
    - Run comprehensive diagnostic checks
    - Check Docker installation and status
    - Check port availability
    - Check network connectivity
    - Check service health
    - Check log files for errors
    - Display suggested fixes for each issue found
    - Register command in packages/cli/src/index.ts
    - _Requirements: 34.8_

  - [~] 8.8 Add --help text for all commands
    - Review all command registrations in packages/cli/src/index.ts
    - Ensure each command has clear description
    - Ensure each option has clear description
    - Add usage examples to help text
    - Test help output for clarity
    - _Requirements: 34.7_

  - [~] 8.9 Update landing page with installation instructions
    - Update apps/landing/app/page.tsx
    - Add "Get Started" section with CLI installation
    - Link to managed mode setup guide
    - Link to self-hosted mode setup guide
    - Add quick start examples
    - _Requirements: Documentation visibility_

  - [~] 8.10 Checkpoint - Ensure documentation complete
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Phase 9: Testing and Validation (Week 11)
  - [~] 9.1 Increase test coverage to >80% for CLI package
    - Run coverage report for packages/cli
    - Identify untested code paths
    - Write additional unit tests for uncovered code
    - Write additional integration tests
    - Verify >80% coverage achieved
    - _Requirements: 36.9_

  - [~] 9.2 Increase test coverage to >80% for API package
    - Run coverage report for packages/api
    - Identify untested code paths
    - Write additional unit tests for uncovered code
    - Write additional integration tests for new endpoints
    - Verify >80% coverage achieved
    - _Requirements: 37.8_

  - [~] 9.3 Test on Ubuntu 20.04, 22.04, 24.04
    - Set up test VMs or containers for each Ubuntu version
    - Run complete installation flow on each
    - Test managed mode and self-hosted mode
    - Test all lifecycle commands
    - Document any platform-specific issues
    - _Requirements: 45.7_

  - [~] 9.4 Test on Debian 11, 12
    - Set up test VMs or containers for each Debian version
    - Run complete installation flow on each
    - Test managed mode and self-hosted mode
    - Test all lifecycle commands
    - Document any platform-specific issues
    - _Requirements: 45.7_

  - [~] 9.5 Test on RHEL 8, 9
    - Set up test VMs or containers for each RHEL version
    - Run complete installation flow on each
    - Test managed mode and self-hosted mode
    - Test all lifecycle commands
    - Document any platform-specific issues
    - _Requirements: 45.7_

  - [~] 9.6 Test with Docker Engine and Docker Desktop
    - Test on Linux with native Docker Engine
    - Test on macOS with Docker Desktop (if macOS support added)
    - Test on Windows with Docker Desktop (if Windows support added)
    - Verify all commands work correctly with both
    - Document any differences in behavior
    - _Requirements: 45.5, 45.6, 45.7_

  - [~] 9.7 Run property tests with 1000 iterations
    - Update all property test configurations to numRuns: 1000
    - Run complete property test suite
    - Fix any failures discovered
    - Document any edge cases found
    - _Requirements: Testing thoroughness_

  - [~] 9.8 Conduct load testing for API endpoints
    - Set up load testing with k6 or Artillery
    - Test device authorization endpoint under load
    - Test enrollment endpoint under load
    - Test heartbeat endpoint under load
    - Verify rate limiting works correctly under load
    - Verify performance targets met (see design doc)
    - _Requirements: Performance validation_

  - [~] 9.9 Fix all identified bugs
    - Review all test failures
    - Review all user feedback
    - Prioritize bugs by severity
    - Fix critical and high-priority bugs
    - Verify fixes with tests
    - _Requirements: Quality assurance_

  - [~] 9.10 Optimize performance bottlenecks
    - Profile CLI startup time (target <100ms)
    - Profile prerequisite checks (target <5s)
    - Profile Docker operations
    - Optimize slow operations
    - Verify performance targets met
    - _Requirements: 55.1, 55.2, 55.3, 55.4, 55.5, 55.6, 55.7_

  - [~] 9.11 Checkpoint - Ensure all testing complete
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Phase 10: Release Preparation (Week 12)
  - [~] 10.1 Create release notes
    - Document all new features
    - Document breaking changes (if any)
    - Document known issues
    - Document upgrade instructions
    - Include links to documentation
    - _Requirements: Release communication_

  - [~] 10.2 Update version numbers
    - Update packages/cli/package.json to 1.0.0
    - Update packages/api/package.json to 1.0.0
    - Update apps/dashboard/package.json to 1.0.0
    - Update root package.json
    - Update CHANGELOG.md
    - _Requirements: Version management_

  - [~] 10.3 Build and test release artifacts
    - Run pnpm build in all packages
    - Test CLI binary works correctly
    - Test API Docker image builds correctly
    - Test Dashboard Docker image builds correctly
    - Verify all dependencies included
    - _Requirements: Release quality_

  - [~] 10.4 Create installation packages
    - Create npm package for CLI (@cig/cli)
    - Create Docker images for API and Dashboard
    - Push Docker images to registry
    - Test installation from npm
    - Test installation from Docker registry
    - _Requirements: Distribution_

  - [~] 10.5 Update landing page with v1.0 announcement
    - Update apps/landing/app/page.tsx with v1.0 features
    - Add installation instructions
    - Add links to documentation
    - Add demo video or screenshots
    - Deploy updated landing page
    - _Requirements: Marketing_

  - [~] 10.6 Prepare announcement blog post
    - Write blog post announcing v1.0 release
    - Highlight key features (device auth, enrollment, installation)
    - Include getting started guide
    - Include screenshots and demos
    - Schedule publication
    - _Requirements: Marketing_

  - [~] 10.7 Set up support channels
    - Create GitHub Discussions for community support
    - Create issue templates for bug reports and feature requests
    - Document support process in README
    - Set up monitoring for support requests
    - _Requirements: Support infrastructure_

  - [~] 10.8 Deploy to production
    - Deploy cloud API to production environment
    - Deploy cloud Dashboard to production environment
    - Configure production database
    - Configure production secrets
    - Run smoke tests on production
    - _Requirements: Production deployment_

  - [~] 10.9 Monitor initial rollout
    - Set up monitoring dashboards
    - Monitor error rates
    - Monitor API performance
    - Monitor user adoption
    - Respond to critical issues immediately
    - _Requirements: Production monitoring_

  - [~] 10.10 Final checkpoint - v1.0 release complete
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP delivery
- Each task includes requirement references for traceability
- Property-based tests explicitly reference design document property numbers
- Checkpoints at end of each phase ensure incremental validation
- Estimated effort: 12 weeks total (2 weeks per phase for phases 1-6, 1 week per phase for phases 7-10)
- Critical path: Phases 1-6 are v1.0 release blockers
- Phases 7-9 are quality gates that should not be skipped
- Phase 10 is release preparation and can be parallelized with final testing

## Risk Indicators

- **High Risk**: Docker Compose template generation (complex, many edge cases)
- **High Risk**: Ed25519 signature verification (security-critical)
- **Medium Risk**: Heartbeat timing and reliability (network-dependent)
- **Medium Risk**: Cross-platform testing (requires multiple test environments)
- **Low Risk**: Dashboard components (well-understood React patterns)

## Dependencies

- Phase 2 depends on Phase 1 (authentication required for enrollment)
- Phase 3 depends on Phase 2 (enrollment required for managed installation)
- Phase 4 depends on Phase 3 (installation engine required for bootstrap/manifest)
- Phase 5 depends on Phase 4 (manifest required for heartbeat configuration)
- Phases 6-10 can proceed in parallel with some overlap

## Success Criteria

- All 56 requirements implemented and tested
- All 20 correctness properties validated with property-based tests
- >80% test coverage for CLI and API packages
- Successful installation on Ubuntu 20.04+, Debian 11+, RHEL 8+
- Performance targets met (CLI startup <100ms, prerequisite checks <5s)
- Complete documentation published
- v1.0 release deployed to production
