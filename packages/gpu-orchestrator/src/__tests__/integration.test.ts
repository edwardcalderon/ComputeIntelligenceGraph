/**
 * Integration tests — wire all components end-to-end.
 *
 * Tests cover:
 * 1. End-to-end session lifecycle: create → setup → monitor → teardown
 * 2. Recovery from stale heartbeat (restart_worker)
 * 3. Recovery from terminated session (recreate_session)
 * 4. Health HTTP endpoint returns correct JSON
 * 5. Graceful shutdown cleans up resources
 *
 * All external dependencies (ComputeProvider, DynamoDB) are mocked.
 * Uses vi.useFakeTimers() to control time.
 *
 * Validates: Requirements 12.3, 2.1, 2.4, 7.4, 8.5, 8.7, 10.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../session/manager.js';
import { HealthMonitor } from '../health/monitor.js';
import { RecoveryStrategy } from '../health/recovery.js';
import { HealthEndpoint } from '../health/endpoint.js';
import type { HealthCheckResult } from '../health/recovery.js';
import type {
  ComputeProvider,
  SessionInfo,
  CommandResult,
} from '../providers/types.js';
import type { SessionRegistrar } from '../state/session-registrar.js';
import type { OrchestratorConfig } from '../config/schemas.js';
import { Logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Silent logger that suppresses all output during tests. */
function createSilentLogger(): Logger {
  return new Logger({
    component: 'integration-test',
    sessionId: 'int-test-session',
    writer: () => {},
  });
}

/** Minimal valid OrchestratorConfig for integration testing. */
function createTestConfig(
  overrides: Partial<OrchestratorConfig> = {},
): OrchestratorConfig {
  return {
    provider: 'local',
    modelNames: ['llama3'],
    awsRegion: 'us-east-2',
    requestQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/req',
    responseQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/res',
    dynamoTableName: 'llm-proxy-state',
    healthCheckIntervalMs: 60_000,
    healthEndpointPort: 0, // use 0 to avoid port conflicts
    heartbeatThresholdSeconds: 180,
    logLevel: 'info',
    ...overrides,
  };
}

/** Default successful SessionInfo. */
function createSessionInfo(
  overrides: Partial<SessionInfo> = {},
): SessionInfo {
  return {
    sessionId: 'int-sess-001',
    status: 'connected',
    provider: 'local',
    startedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

/** Successful command result. */
function successResult(stdout = ''): CommandResult {
  return { exitCode: 0, stdout, stderr: '' };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockProvider(): ComputeProvider {
  return {
    providerName: 'local',
    createSession: vi
      .fn<ComputeProvider['createSession']>()
      .mockResolvedValue(createSessionInfo()),
    destroySession: vi
      .fn<ComputeProvider['destroySession']>()
      .mockResolvedValue(undefined),
    getSessionStatus: vi
      .fn<ComputeProvider['getSessionStatus']>()
      .mockResolvedValue(createSessionInfo({ status: 'running' })),
    executeCommand: vi
      .fn<ComputeProvider['executeCommand']>()
      .mockResolvedValue(successResult()),
    getSessionLogs: vi
      .fn<ComputeProvider['getSessionLogs']>()
      .mockResolvedValue(''),
  };
}

function createMockRegistrar(): SessionRegistrar {
  return {
    registerSession: vi.fn().mockResolvedValue(undefined),
    updateTimestamp: vi.fn().mockResolvedValue(undefined),
    removeSession: vi.fn().mockResolvedValue(undefined),
    getWorkerHeartbeat: vi.fn().mockResolvedValue({
      lastHeartbeatAt: new Date().toISOString(),
      status: 'active',
    }),
  } as unknown as SessionRegistrar;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: end-to-end wiring', () => {
  let provider: ComputeProvider;
  let registrar: SessionRegistrar;
  let logger: Logger;
  let config: OrchestratorConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    provider = createMockProvider();
    registrar = createMockRegistrar();
    logger = createSilentLogger();
    config = createTestConfig();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. End-to-end session lifecycle
  // Validates: Requirements 12.3, 2.1
  // -----------------------------------------------------------------------

  describe('End-to-end session lifecycle', () => {
    it('creates a session through the full lifecycle: create → setup → monitor → teardown', async () => {
      // Wire real components with mock externals
      const healthMonitor = new HealthMonitor(
        provider,
        registrar,
        logger,
        config.healthCheckIntervalMs,
        config.heartbeatThresholdSeconds,
      );
      const recoveryStrategy = new RecoveryStrategy();
      const manager = new SessionManager(
        provider,
        registrar,
        healthMonitor,
        recoveryStrategy,
        logger,
        config,
      );

      // Start session — advance timers for internal sleeps
      const sessionPromise = manager.startSession();
      await vi.advanceTimersByTimeAsync(60_000);
      const session = await sessionPromise;

      // Verify session was created
      expect(session.sessionId).toBe('int-sess-001');
      expect(session.status).toBe('connected');

      // Verify notebook generation → provider.createSession was called
      expect(provider.createSession).toHaveBeenCalledTimes(1);
      const createOpts = vi.mocked(provider.createSession).mock.calls[0][0];
      expect(createOpts.notebook.nbformat).toBe(4);
      expect(createOpts.notebook.cells).toHaveLength(5);
      expect(createOpts.models).toEqual(['llama3']);

      // Verify Ollama start was attempted (executeCommand with 'ollama serve &')
      const execCalls = vi.mocked(provider.executeCommand).mock.calls;
      const serveCalls = execCalls.filter(([, cmd]) => cmd === 'ollama serve &');
      expect(serveCalls.length).toBeGreaterThanOrEqual(1);

      // Verify model pull was attempted
      const pullCalls = execCalls.filter(([, cmd]) =>
        cmd.includes('ollama pull'),
      );
      expect(pullCalls.length).toBeGreaterThanOrEqual(1);

      // Verify heartbeat was polled
      expect(registrar.getWorkerHeartbeat).toHaveBeenCalled();

      // Verify orchestrator record was registered
      expect(registrar.registerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'int-sess-001',
          provider: 'local',
          models: ['llama3'],
        }),
      );

      // Now teardown
      await manager.stopSession();

      // Verify cleanup
      expect(registrar.removeSession).toHaveBeenCalledWith('int-sess-001');
      expect(provider.destroySession).toHaveBeenCalledWith('int-sess-001');
      expect(manager.currentSessionId).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Recovery from stale heartbeat → restart_worker
  // Validates: Requirements 8.5
  // -----------------------------------------------------------------------

  describe('Recovery from stale heartbeat', () => {
    it('triggers restart_worker when heartbeat is stale but session is healthy', async () => {
      const healthMonitor = new HealthMonitor(
        provider,
        registrar,
        logger,
        config.healthCheckIntervalMs,
        config.heartbeatThresholdSeconds,
      );
      const recoveryStrategy = new RecoveryStrategy({
        initialBackoffMs: 0, // no delay in tests
        maxBackoffMs: 0,
        maxConsecutiveFailures: 5,
        dormantRetryMs: 0,
      });
      const manager = new SessionManager(
        provider,
        registrar,
        healthMonitor,
        recoveryStrategy,
        logger,
        config,
      );

      // Start session
      const sessionPromise = manager.startSession();
      await vi.advanceTimersByTimeAsync(60_000);
      await sessionPromise;

      // Build a health result where session is healthy but heartbeat is stale
      const staleResult: HealthCheckResult = {
        timestamp: new Date().toISOString(),
        sessionId: 'int-sess-001',
        checks: {
          session: { healthy: true, latencyMs: 10, status: 'running' },
          workerHeartbeat: { healthy: false, latencyMs: 5, ageSeconds: 300 },
        },
        overall: false,
      };

      // Verify the recovery strategy determines restart_worker
      const action = recoveryStrategy.determineAction(staleResult, 0);
      expect(action.type).toBe('restart_worker');

      // Trigger the health failure through the manager
      const handlePromise = manager.handleHealthFailure(staleResult);
      await vi.advanceTimersByTimeAsync(10_000);
      await handlePromise;

      // Verify worker restart command was executed
      const execCalls = vi.mocked(provider.executeCommand).mock.calls;
      const workerRestartCall = execCalls.find(([, cmd]) =>
        cmd.includes('worker.py'),
      );
      expect(workerRestartCall).toBeDefined();
      expect(manager.currentConsecutiveFailures).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Recovery from terminated session → recreate_session
  // Validates: Requirements 8.5
  // -----------------------------------------------------------------------

  describe('Recovery from terminated session', () => {
    it('triggers recreate_session when session is unhealthy', async () => {
      const healthMonitor = new HealthMonitor(
        provider,
        registrar,
        logger,
        config.healthCheckIntervalMs,
        config.heartbeatThresholdSeconds,
      );
      const recoveryStrategy = new RecoveryStrategy({
        initialBackoffMs: 0,
        maxBackoffMs: 0,
        maxConsecutiveFailures: 5,
        dormantRetryMs: 0,
      });
      const manager = new SessionManager(
        provider,
        registrar,
        healthMonitor,
        recoveryStrategy,
        logger,
        config,
      );

      // Start session
      const sessionPromise = manager.startSession();
      await vi.advanceTimersByTimeAsync(60_000);
      await sessionPromise;

      // Build a health result where session is terminated
      const terminatedResult: HealthCheckResult = {
        timestamp: new Date().toISOString(),
        sessionId: 'int-sess-001',
        checks: {
          session: { healthy: false, latencyMs: 10, status: 'terminated' },
          workerHeartbeat: { healthy: false, latencyMs: 5 },
        },
        overall: false,
      };

      // Verify the recovery strategy determines recreate_session
      const action = recoveryStrategy.determineAction(terminatedResult, 0);
      expect(action.type).toBe('recreate_session');

      // Trigger the health failure — this will stop + start a new session
      const handlePromise = manager.handleHealthFailure(terminatedResult);
      await vi.advanceTimersByTimeAsync(120_000);
      await handlePromise;

      // Verify the old session was destroyed and a new one was created
      expect(provider.destroySession).toHaveBeenCalledWith('int-sess-001');
      // createSession called twice: initial + recreation
      expect(provider.createSession).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Health HTTP endpoint returns correct JSON
  // Validates: Requirements 8.7
  // -----------------------------------------------------------------------

  describe('Health endpoint returns correct JSON', () => {
    it('returns status=ok with health data when session is healthy', async () => {
      // Use real timers for HTTP server
      vi.useRealTimers();

      const healthResult: HealthCheckResult = {
        timestamp: '2025-01-01T00:00:00.000Z',
        sessionId: 'int-sess-001',
        checks: {
          session: { healthy: true, latencyMs: 5, status: 'running' },
          workerHeartbeat: {
            healthy: true,
            latencyMs: 3,
            lastHeartbeatAt: '2025-01-01T00:00:00.000Z',
            ageSeconds: 30,
          },
        },
        overall: true,
      };

      const endpoint = new HealthEndpoint({
        port: 0, // OS-assigned port
        getHealthResult: () => healthResult,
        getMetadata: () => ({
          sessionId: 'int-sess-001',
          provider: 'local',
          startedAt: '2025-01-01T00:00:00.000Z',
          uptimeSeconds: 3600,
        }),
        logger,
      });

      await endpoint.start();

      try {
        // Get the actual port from the server
        const server = (endpoint as unknown as { server: { address: () => { port: number } } }).server;
        const port = server.address().port;

        const response = await fetch(`http://127.0.0.1:${port}/health`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/json');

        const body = await response.json();

        // Verify JSON structure
        expect(body.status).toBe('ok');
        expect(body.metadata).toEqual({
          sessionId: 'int-sess-001',
          provider: 'local',
          startedAt: '2025-01-01T00:00:00.000Z',
          uptimeSeconds: 3600,
        });
        expect(body.health.overall).toBe(true);
        expect(body.health.checks.session.healthy).toBe(true);
        expect(body.health.checks.workerHeartbeat.healthy).toBe(true);
      } finally {
        await endpoint.stop();
      }
    });

    it('returns status=no_data when no health result is available', async () => {
      vi.useRealTimers();

      const endpoint = new HealthEndpoint({
        port: 0,
        getHealthResult: () => null,
        getMetadata: () => null,
        logger,
      });

      await endpoint.start();

      try {
        const server = (endpoint as unknown as { server: { address: () => { port: number } } }).server;
        const port = server.address().port;

        const response = await fetch(`http://127.0.0.1:${port}/health`);
        const body = await response.json();

        expect(body.status).toBe('no_data');
        expect(body.metadata).toBeNull();
        expect(body.health).toBeNull();
      } finally {
        await endpoint.stop();
      }
    });

    it('returns status=unhealthy when health check reports failure', async () => {
      vi.useRealTimers();

      const unhealthyResult: HealthCheckResult = {
        timestamp: '2025-01-01T00:00:00.000Z',
        sessionId: 'int-sess-001',
        checks: {
          session: { healthy: false, latencyMs: 5, status: 'error' },
          workerHeartbeat: { healthy: false, latencyMs: 3 },
        },
        overall: false,
      };

      const endpoint = new HealthEndpoint({
        port: 0,
        getHealthResult: () => unhealthyResult,
        getMetadata: () => ({
          sessionId: 'int-sess-001',
          provider: 'local',
          startedAt: '2025-01-01T00:00:00.000Z',
          uptimeSeconds: 100,
        }),
        logger,
      });

      await endpoint.start();

      try {
        const server = (endpoint as unknown as { server: { address: () => { port: number } } }).server;
        const port = server.address().port;

        const response = await fetch(`http://127.0.0.1:${port}/health`);
        const body = await response.json();

        expect(body.status).toBe('unhealthy');
        expect(body.health.overall).toBe(false);
      } finally {
        await endpoint.stop();
      }
    });

    it('returns 404 for non-health paths', async () => {
      vi.useRealTimers();

      const endpoint = new HealthEndpoint({
        port: 0,
        getHealthResult: () => null,
        getMetadata: () => null,
        logger,
      });

      await endpoint.start();

      try {
        const server = (endpoint as unknown as { server: { address: () => { port: number } } }).server;
        const port = server.address().port;

        const response = await fetch(`http://127.0.0.1:${port}/other`);
        expect(response.status).toBe(404);
      } finally {
        await endpoint.stop();
      }
    });
  });

  // -----------------------------------------------------------------------
  // 5. Graceful shutdown cleans up resources
  // Validates: Requirements 10.5
  // -----------------------------------------------------------------------

  describe('Graceful shutdown cleans up resources', () => {
    it('stops health monitoring, removes orchestrator record, and destroys session on stopSession', async () => {
      const healthMonitor = new HealthMonitor(
        provider,
        registrar,
        logger,
        config.healthCheckIntervalMs,
        config.heartbeatThresholdSeconds,
      );
      const recoveryStrategy = new RecoveryStrategy();
      const manager = new SessionManager(
        provider,
        registrar,
        healthMonitor,
        recoveryStrategy,
        logger,
        config,
      );

      // Spy on the real HealthMonitor.stop
      const stopSpy = vi.spyOn(healthMonitor, 'stop');

      // Start session
      const sessionPromise = manager.startSession();
      await vi.advanceTimersByTimeAsync(60_000);
      await sessionPromise;

      expect(manager.currentSessionId).toBe('int-sess-001');

      // Perform graceful shutdown
      await manager.stopSession();

      // Verify health monitoring was stopped
      expect(stopSpy).toHaveBeenCalled();

      // Verify orchestrator record was removed from DynamoDB
      expect(registrar.removeSession).toHaveBeenCalledWith('int-sess-001');

      // Verify session was destroyed via provider
      expect(provider.destroySession).toHaveBeenCalledWith('int-sess-001');

      // Verify manager state is cleared
      expect(manager.currentSessionId).toBeNull();
    });

    it('cleans up even when DynamoDB removal fails', async () => {
      const healthMonitor = new HealthMonitor(
        provider,
        registrar,
        logger,
        config.healthCheckIntervalMs,
        config.heartbeatThresholdSeconds,
      );
      const recoveryStrategy = new RecoveryStrategy();
      const manager = new SessionManager(
        provider,
        registrar,
        healthMonitor,
        recoveryStrategy,
        logger,
        config,
      );

      // Start session
      const sessionPromise = manager.startSession();
      await vi.advanceTimersByTimeAsync(60_000);
      await sessionPromise;

      // Make DynamoDB removal fail
      vi.mocked(registrar.removeSession).mockRejectedValueOnce(
        new Error('DynamoDB unavailable'),
      );

      // Shutdown should not throw
      await expect(manager.stopSession()).resolves.toBeUndefined();

      // Provider destroy should still be called despite DynamoDB failure
      expect(provider.destroySession).toHaveBeenCalledWith('int-sess-001');
      expect(manager.currentSessionId).toBeNull();
    });

    it('cleans up even when provider destroy fails', async () => {
      const healthMonitor = new HealthMonitor(
        provider,
        registrar,
        logger,
        config.healthCheckIntervalMs,
        config.heartbeatThresholdSeconds,
      );
      const recoveryStrategy = new RecoveryStrategy();
      const manager = new SessionManager(
        provider,
        registrar,
        healthMonitor,
        recoveryStrategy,
        logger,
        config,
      );

      // Start session
      const sessionPromise = manager.startSession();
      await vi.advanceTimersByTimeAsync(60_000);
      await sessionPromise;

      // Make provider destroy fail
      vi.mocked(provider.destroySession).mockRejectedValueOnce(
        new Error('Provider unavailable'),
      );

      // Shutdown should not throw
      await expect(manager.stopSession()).resolves.toBeUndefined();

      // DynamoDB removal should still have been called
      expect(registrar.removeSession).toHaveBeenCalledWith('int-sess-001');
      expect(manager.currentSessionId).toBeNull();
    });
  });
});
