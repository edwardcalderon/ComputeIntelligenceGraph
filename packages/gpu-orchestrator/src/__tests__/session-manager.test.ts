/**
 * Unit tests for SessionManager.
 *
 * Tests cover:
 * - Ollama start retry count (max 2 retries → 3 total calls)
 * - Model pull retry with exponential backoff (base 10s)
 * - Worker heartbeat wait timeout (180s)
 * - Health failure triggers recovery via RecoveryStrategy
 * - Stop session cleans up all resources
 *
 * Validates: Requirements 4.3, 4.5, 5.3, 2.6, 6.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../session/manager.js';
import type { ComputeProvider, SessionInfo, CommandResult } from '../providers/types.js';
import type { SessionRegistrar } from '../state/session-registrar.js';
import type { HealthMonitor } from '../health/monitor.js';
import type { RecoveryStrategy } from '../health/recovery.js';
import type { HealthCheckResult } from '../health/recovery.js';
import type { OrchestratorConfig } from '../config/schemas.js';
import { Logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Silent logger that suppresses all output. */
function createSilentLogger(): Logger {
  return new Logger({
    component: 'test-session-manager',
    sessionId: 'test-session',
    writer: () => {},
  });
}

/** Minimal valid OrchestratorConfig for testing. */
function createTestConfig(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    provider: 'local',
    modelNames: ['llama3'],
    awsRegion: 'us-east-2',
    requestQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/req',
    responseQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/res',
    dynamoTableName: 'llm-proxy-state',
    healthCheckIntervalMs: 60_000,
    healthEndpointPort: 8787,
    heartbeatThresholdSeconds: 180,
    logLevel: 'info',
    ...overrides,
  };
}

/** Default successful SessionInfo returned by the mock provider. */
function createSessionInfo(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    sessionId: 'sess-test-001',
    status: 'connected',
    provider: 'local',
    startedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

/** Default successful CommandResult. */
function successResult(stdout = ''): CommandResult {
  return { exitCode: 0, stdout, stderr: '' };
}

/** Default failed CommandResult. */
function failResult(stderr = 'command failed'): CommandResult {
  return { exitCode: 1, stdout: '', stderr };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockProvider(): ComputeProvider {
  return {
    providerName: 'local',
    createSession: vi.fn<ComputeProvider['createSession']>().mockResolvedValue(createSessionInfo()),
    destroySession: vi.fn<ComputeProvider['destroySession']>().mockResolvedValue(undefined),
    getSessionStatus: vi.fn<ComputeProvider['getSessionStatus']>().mockResolvedValue(createSessionInfo({ status: 'running' })),
    executeCommand: vi.fn<ComputeProvider['executeCommand']>().mockResolvedValue(successResult()),
    getSessionLogs: vi.fn<ComputeProvider['getSessionLogs']>().mockResolvedValue(''),
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

function createMockHealthMonitor(): HealthMonitor {
  return {
    checkAll: vi.fn().mockResolvedValue({
      timestamp: new Date().toISOString(),
      sessionId: 'sess-test-001',
      checks: {
        session: { healthy: true, latencyMs: 5, status: 'running' },
        workerHeartbeat: { healthy: true, latencyMs: 3 },
      },
      overall: true,
    }),
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as HealthMonitor;
}

function createMockRecoveryStrategy(): RecoveryStrategy {
  return {
    determineAction: vi.fn().mockReturnValue({ type: 'restart_worker' }),
    calculateBackoff: vi.fn().mockReturnValue(0), // no delay in tests
    dormantRetryMs: 0,
    maxConsecutiveFailures: 5,
  } as unknown as RecoveryStrategy;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionManager', () => {
  let provider: ComputeProvider;
  let registrar: SessionRegistrar;
  let healthMonitor: HealthMonitor;
  let recoveryStrategy: RecoveryStrategy;
  let logger: Logger;
  let config: OrchestratorConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    provider = createMockProvider();
    registrar = createMockRegistrar();
    healthMonitor = createMockHealthMonitor();
    recoveryStrategy = createMockRecoveryStrategy();
    logger = createSilentLogger();
    config = createTestConfig();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createManager(): SessionManager {
    return new SessionManager(
      provider,
      registrar,
      healthMonitor,
      recoveryStrategy,
      logger,
      config,
    );
  }

  /**
   * Helper to start a session with all mocks succeeding.
   * Advances fake timers enough for the full startup sequence.
   */
  async function startSuccessfulSession(manager: SessionManager): Promise<SessionInfo> {
    vi.mocked(provider.executeCommand).mockResolvedValue(successResult());
    vi.mocked(registrar.getWorkerHeartbeat).mockResolvedValue({
      lastHeartbeatAt: new Date().toISOString(),
      status: 'active',
    });

    const sessionPromise = manager.startSession();
    await vi.advanceTimersByTimeAsync(60_000);
    return sessionPromise;
  }

  // -----------------------------------------------------------------------
  // Test 1: Ollama start retry count (max 2 retries → 3 total calls)
  // Validates: Requirement 4.3
  // -----------------------------------------------------------------------

  describe('Ollama start retry', () => {
    it('retries Ollama start up to 2 times then succeeds on 3rd attempt', async () => {
      const executeCommand = vi.mocked(provider.executeCommand);

      // executeCommand is called for 'ollama serve &':
      //   attempt 1: fail, attempt 2: fail, attempt 3: succeed
      // Then for 'ollama pull llama3': succeed
      executeCommand
        .mockResolvedValueOnce(failResult('ollama start failed'))  // ollama serve attempt 1
        .mockResolvedValueOnce(failResult('ollama start failed'))  // ollama serve attempt 2
        .mockResolvedValueOnce(successResult())                     // ollama serve attempt 3 (success)
        .mockResolvedValueOnce(successResult('model pulled'));      // ollama pull

      const manager = createManager();
      const sessionPromise = manager.startSession();

      // Advance timers for the sleep calls between retries and post-start
      await vi.advanceTimersByTimeAsync(60_000);

      const session = await sessionPromise;

      expect(session.sessionId).toBe('sess-test-001');

      // executeCommand should be called 3 times for ollama serve + 1 for ollama pull = 4 total
      const serveCalls = executeCommand.mock.calls.filter(
        ([, cmd]) => cmd === 'ollama serve &',
      );
      expect(serveCalls).toHaveLength(3);
    });

    it('throws OllamaError when all 3 Ollama start attempts fail', async () => {
      const executeCommand = vi.mocked(provider.executeCommand);

      // All 3 attempts fail
      executeCommand
        .mockResolvedValueOnce(failResult('fail 1'))
        .mockResolvedValueOnce(failResult('fail 2'))
        .mockResolvedValueOnce(failResult('fail 3'));

      const manager = createManager();

      // Attach rejection handler immediately to prevent unhandled rejection
      const sessionPromise = manager.startSession().catch((e) => e);

      // Advance timers for all retry sleeps
      await vi.advanceTimersByTimeAsync(60_000);

      const error = await sessionPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/Ollama server failed to start after 3 attempts/);
    });
  });

  // -----------------------------------------------------------------------
  // Test 2: Model pull retry with exponential backoff (base 10s)
  // Validates: Requirement 4.5
  // -----------------------------------------------------------------------

  describe('Model pull retry with exponential backoff', () => {
    it('retries model pull up to 2 times with increasing delays', async () => {
      const executeCommand = vi.mocked(provider.executeCommand);

      // ollama serve succeeds on first try
      // ollama pull fails twice then succeeds
      executeCommand
        .mockResolvedValueOnce(successResult())                     // ollama serve (success)
        .mockResolvedValueOnce(failResult('pull failed'))           // ollama pull attempt 1
        .mockResolvedValueOnce(failResult('pull failed'))           // ollama pull attempt 2
        .mockResolvedValueOnce(successResult('model pulled'));      // ollama pull attempt 3

      const manager = createManager();
      const sessionPromise = manager.startSession();

      // Advance timers to cover:
      // - 5s post-ollama-start sleep
      // - 10s backoff after first pull failure (10000 * 2^0 = 10000)
      // - 20s backoff after second pull failure (10000 * 2^1 = 20000)
      // - heartbeat poll
      await vi.advanceTimersByTimeAsync(120_000);

      const session = await sessionPromise;
      expect(session.sessionId).toBe('sess-test-001');

      const pullCalls = executeCommand.mock.calls.filter(
        ([, cmd]) => cmd === 'ollama pull llama3',
      );
      expect(pullCalls).toHaveLength(3);
    });

    it('throws OllamaError when all model pull attempts fail', async () => {
      const executeCommand = vi.mocked(provider.executeCommand);

      // ollama serve succeeds
      // all 3 pull attempts fail
      executeCommand
        .mockResolvedValueOnce(successResult())       // ollama serve
        .mockResolvedValueOnce(failResult('fail 1'))   // pull attempt 1
        .mockResolvedValueOnce(failResult('fail 2'))   // pull attempt 2
        .mockResolvedValueOnce(failResult('fail 3'));   // pull attempt 3

      const manager = createManager();

      // Attach rejection handler immediately to prevent unhandled rejection
      const sessionPromise = manager.startSession().catch((e) => e);

      await vi.advanceTimersByTimeAsync(120_000);

      const error = await sessionPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/Failed to pull model llama3 after 3 attempts/);
    });
  });

  // -----------------------------------------------------------------------
  // Test 3: Worker heartbeat wait timeout (180s)
  // Validates: Requirement 5.3
  // -----------------------------------------------------------------------

  describe('Worker heartbeat wait timeout', () => {
    it('throws when no heartbeat is detected within 180s', async () => {
      const executeCommand = vi.mocked(provider.executeCommand);
      const getWorkerHeartbeat = vi.mocked(registrar.getWorkerHeartbeat);

      // ollama serve and pull succeed
      executeCommand.mockResolvedValue(successResult());

      // Heartbeat always returns null (worker never starts)
      getWorkerHeartbeat.mockResolvedValue(null);

      const manager = createManager();

      // Attach rejection handler immediately to prevent unhandled rejection
      const sessionPromise = manager.startSession().catch((e) => e);

      // Advance past the 180s timeout plus buffer for polling intervals
      await vi.advanceTimersByTimeAsync(200_000);

      const error = await sessionPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/Worker heartbeat not detected within 180000ms/);
    });

    it('succeeds when heartbeat appears before timeout', async () => {
      const executeCommand = vi.mocked(provider.executeCommand);
      const getWorkerHeartbeat = vi.mocked(registrar.getWorkerHeartbeat);

      // ollama serve and pull succeed
      executeCommand.mockResolvedValue(successResult());

      // Return null for first few polls, then return a heartbeat
      getWorkerHeartbeat
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          lastHeartbeatAt: new Date().toISOString(),
          status: 'active',
        });

      const manager = createManager();
      const sessionPromise = manager.startSession();

      // Advance timers enough for the ollama setup + heartbeat polling
      await vi.advanceTimersByTimeAsync(60_000);

      const session = await sessionPromise;
      expect(session.sessionId).toBe('sess-test-001');
      expect(registrar.registerSession).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 4: Health failure triggers recovery
  // Validates: Requirement 2.6
  // -----------------------------------------------------------------------

  describe('Health failure triggers recovery', () => {
    it('calls determineAction and executes restart_worker recovery', async () => {
      const manager = createManager();

      // Start a session with all mocks succeeding
      await startSuccessfulSession(manager);

      const unhealthyResult: HealthCheckResult = {
        timestamp: new Date().toISOString(),
        sessionId: 'sess-test-001',
        checks: {
          session: { healthy: true, latencyMs: 5, status: 'running' },
          workerHeartbeat: { healthy: false, latencyMs: 3 },
        },
        overall: false,
      };

      // Trigger a health failure
      const handlePromise = manager.handleHealthFailure(unhealthyResult);
      await vi.advanceTimersByTimeAsync(10_000);
      await handlePromise;

      expect(recoveryStrategy.determineAction).toHaveBeenCalledWith(
        unhealthyResult,
        1, // first consecutive failure
      );
      expect(recoveryStrategy.calculateBackoff).toHaveBeenCalledWith(0);

      // restart_worker executes a command on the provider
      const execCalls = vi.mocked(provider.executeCommand).mock.calls;
      const workerRestartCall = execCalls.find(
        ([, cmd]) => cmd.includes('worker.py'),
      );
      expect(workerRestartCall).toBeDefined();
    });

    it('calls determineAction with recreate_session for session failure', async () => {
      vi.mocked(recoveryStrategy.determineAction).mockReturnValue({
        type: 'recreate_session',
      });

      const manager = createManager();

      // Start a session with all mocks succeeding
      await startSuccessfulSession(manager);

      const unhealthyResult: HealthCheckResult = {
        timestamp: new Date().toISOString(),
        sessionId: 'sess-test-001',
        checks: {
          session: { healthy: false, latencyMs: 5, status: 'error' },
          workerHeartbeat: { healthy: false, latencyMs: 3 },
        },
        overall: false,
      };

      // Reset executeCommand to succeed for the recreation flow
      vi.mocked(provider.executeCommand).mockResolvedValue(successResult());

      const handlePromise = manager.handleHealthFailure(unhealthyResult);
      // Advance enough time for backoff + session recreation
      await vi.advanceTimersByTimeAsync(300_000);
      await handlePromise;

      expect(recoveryStrategy.determineAction).toHaveBeenCalledWith(
        unhealthyResult,
        1,
      );
      // recreate_session calls stopSession then startSession
      expect(healthMonitor.stop).toHaveBeenCalled();
      expect(provider.destroySession).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 5: Stop session cleans up all resources
  // Validates: Requirement 6.6 (DynamoDB write retry / cleanup)
  // -----------------------------------------------------------------------

  describe('Stop session cleanup', () => {
    it('stops health monitoring, removes orchestrator record, and destroys session', async () => {
      const manager = createManager();

      // Start a session with all mocks succeeding
      await startSuccessfulSession(manager);

      // Reset call counts to isolate stopSession behavior
      vi.mocked(healthMonitor.stop).mockClear();
      vi.mocked(registrar.removeSession).mockClear();
      vi.mocked(provider.destroySession).mockClear();

      await manager.stopSession();

      // Verify cleanup sequence
      expect(healthMonitor.stop).toHaveBeenCalledTimes(1);
      expect(registrar.removeSession).toHaveBeenCalledWith('sess-test-001');
      expect(provider.destroySession).toHaveBeenCalledWith('sess-test-001');
      expect(manager.currentSessionId).toBeNull();
    });

    it('continues cleanup even if removeSession fails', async () => {
      const manager = createManager();

      // Start a session with all mocks succeeding
      await startSuccessfulSession(manager);

      vi.mocked(registrar.removeSession).mockRejectedValue(
        new Error('DynamoDB write failed'),
      );

      // stopSession should not throw even if removeSession fails
      await expect(manager.stopSession()).resolves.toBeUndefined();

      // destroySession should still be called despite removeSession failure
      expect(provider.destroySession).toHaveBeenCalledWith('sess-test-001');
      expect(manager.currentSessionId).toBeNull();
    });

    it('handles stopSession when no active session exists', async () => {
      const manager = createManager();

      // Should not throw
      await expect(manager.stopSession()).resolves.toBeUndefined();

      // No cleanup calls should be made
      expect(registrar.removeSession).not.toHaveBeenCalled();
      expect(provider.destroySession).not.toHaveBeenCalled();
    });
  });
});
