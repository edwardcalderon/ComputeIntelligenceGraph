#!/usr/bin/env node

/**
 * CLI entry point for the GPU Orchestrator.
 *
 * Supports commands:
 *   - `start`    — load config, create provider, start session manager + health endpoint
 *   - `stop`     — graceful shutdown sequence
 *   - `status`   — query and display current session health
 *   - `--dry-run` — validate config and print resolved settings, then exit
 *
 * Registers SIGTERM / SIGINT handlers for graceful shutdown and a global
 * error boundary for unhandled exceptions / rejections.
 *
 * @module
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { loadConfig, redactConfig } from './config/loader.js';
import { createProvider } from './providers/factory.js';
import { SessionRegistrar } from './state/session-registrar.js';
import { HealthMonitor } from './health/monitor.js';
import { RecoveryStrategy } from './health/recovery.js';
import { SessionManager } from './session/manager.js';
import { HealthEndpoint } from './health/endpoint.js';
import { Logger } from './lib/logger.js';
import type { HealthCheckResult } from './health/recovery.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout for graceful cleanup during unhandled errors (ms). */
const ERROR_CLEANUP_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let logger: Logger | null = null;
let sessionManager: SessionManager | null = null;
let healthEndpoint: HealthEndpoint | null = null;
let healthMonitor: HealthMonitor | null = null;
let isShuttingDown = false;
let latestHealthResult: HealthCheckResult | null = null;

// ---------------------------------------------------------------------------
// Graceful shutdown (Task 10.2)
// ---------------------------------------------------------------------------

/**
 * Perform a graceful shutdown sequence:
 * 1. Stop health monitoring
 * 2. Stop health HTTP endpoint
 * 3. Mark sessions terminated in state store + destroy active sessions
 * 4. Flush logs
 */
async function gracefulShutdown(exitCode: number): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const log = logger ?? new Logger({ component: 'CLI', sessionId: 'shutdown' });
  log.info(`Graceful shutdown initiated (exit code: ${exitCode})`);

  try {
    // 1. Stop health monitoring
    if (healthMonitor) {
      healthMonitor.stop();
      log.info('Health monitoring stopped');
    }

    // 2. Stop health HTTP endpoint
    if (healthEndpoint) {
      await healthEndpoint.stop();
      log.info('Health endpoint stopped');
    }

    // 3. Stop session manager (marks terminated, removes records, destroys sessions)
    if (sessionManager) {
      await sessionManager.stopSession();
      log.info('Session manager stopped and resources cleaned up');
    }

    // 4. Flush logs (stdout is synchronous in Node.js, but be explicit)
    log.info('Shutdown complete');
  } catch (error) {
    log.error(
      'Error during graceful shutdown',
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Signal handlers (Task 10.2 — SIGTERM / SIGINT)
// ---------------------------------------------------------------------------

function registerSignalHandlers(): void {
  const handler = () => {
    void gracefulShutdown(0);
  };

  process.on('SIGTERM', handler);
  process.on('SIGINT', handler);
}

// ---------------------------------------------------------------------------
// Global error boundary (Task 10.2)
// ---------------------------------------------------------------------------

function registerGlobalErrorBoundary(): void {
  process.on('uncaughtException', (error: Error) => {
    const log = logger ?? new Logger({ component: 'CLI', sessionId: 'error-boundary' });
    log.critical('Uncaught exception — attempting graceful cleanup', error);

    // Attempt graceful cleanup with a 10s timeout
    const cleanupTimeout = setTimeout(() => {
      log.critical('Graceful cleanup timed out after 10s, forcing exit');
      process.exit(1);
    }, ERROR_CLEANUP_TIMEOUT_MS);

    // Prevent the timeout from keeping the process alive if cleanup finishes
    cleanupTimeout.unref();

    void gracefulShutdown(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const log = logger ?? new Logger({ component: 'CLI', sessionId: 'error-boundary' });
    const error = reason instanceof Error ? reason : new Error(String(reason));
    log.critical('Unhandled promise rejection — attempting graceful cleanup', error);

    const cleanupTimeout = setTimeout(() => {
      log.critical('Graceful cleanup timed out after 10s, forcing exit');
      process.exit(1);
    }, ERROR_CLEANUP_TIMEOUT_MS);

    cleanupTimeout.unref();

    void gracefulShutdown(1);
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * `start` command — full orchestrator startup.
 */
async function commandStart(): Promise<void> {
  // 1. Load and validate config
  const config = loadConfig();

  // 2. Create logger
  logger = new Logger({
    component: 'CLI',
    sessionId: 'init',
    minLevel: config.logLevel,
  });

  // 3. Log redacted config
  const redacted = redactConfig(config);
  logger.info(`Resolved configuration: ${JSON.stringify(redacted)}`);

  // 4. Create DynamoDB client (uses standard AWS credential chain)
  const dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: config.awsRegion }),
  );

  // 5. Create SessionRegistrar
  const registrar = new SessionRegistrar(dynamoClient, config.dynamoTableName);

  // 6. Create provider
  const provider = createProvider(config, logger.child('Provider'));

  // 7. Create HealthMonitor
  healthMonitor = new HealthMonitor(
    provider,
    registrar,
    logger.child('HealthMonitor'),
    config.healthCheckIntervalMs,
    config.heartbeatThresholdSeconds,
  );

  // 8. Create RecoveryStrategy
  const recoveryStrategy = new RecoveryStrategy();

  // 9. Create SessionManager
  sessionManager = new SessionManager(
    provider,
    registrar,
    healthMonitor,
    recoveryStrategy,
    logger.child('SessionManager'),
    config,
  );

  // 10. Create HealthEndpoint
  const sessionStartedAt = new Date().toISOString();
  healthEndpoint = new HealthEndpoint({
    port: config.healthEndpointPort,
    getHealthResult: () => latestHealthResult,
    getMetadata: () => {
      const sid = sessionManager?.currentSessionId;
      if (!sid) return null;
      return {
        sessionId: sid,
        provider: config.provider,
        startedAt: sessionStartedAt,
        uptimeSeconds: Math.floor((Date.now() - Date.parse(sessionStartedAt)) / 1000),
      };
    },
    logger: logger.child('HealthEndpoint'),
  });

  // 11. Register signal handlers
  registerSignalHandlers();

  // 12. Start health endpoint
  await healthEndpoint.start();
  logger.info(`Health endpoint started on port ${config.healthEndpointPort}`);

  // 13. Start session manager
  logger.info('Starting session manager...');
  const sessionInfo = await sessionManager.startSession();
  logger.info(
    `Session started: id=${sessionInfo.sessionId}, provider=${sessionInfo.provider}, status=${sessionInfo.status}`,
  );
}

/**
 * `--dry-run` — validate config and print resolved settings, then exit.
 */
function commandDryRun(): void {
  const config = loadConfig();

  logger = new Logger({
    component: 'CLI',
    sessionId: 'dry-run',
    minLevel: config.logLevel,
  });

  const redacted = redactConfig(config);
  logger.info('Configuration is valid. Resolved settings:');

  // Print each setting for readability
  for (const [key, value] of Object.entries(redacted)) {
    logger.info(`  ${key}: ${value}`);
  }

  logger.info('Dry run complete — no sessions created.');
  process.exit(0);
}

/**
 * `status` command — query and display current session health.
 */
function commandStatus(): void {
  logger = new Logger({ component: 'CLI', sessionId: 'status' });

  if (latestHealthResult) {
    logger.info(`Current health status: ${JSON.stringify(latestHealthResult)}`);
  } else {
    logger.info(
      'No health data available. The orchestrator may not be running, ' +
        'or no health checks have completed yet.',
    );
    logger.info(
      'To check a running instance, query the health endpoint: ' +
        'curl http://localhost:<port>/health',
    );
  }

  process.exit(0);
}

/**
 * `stop` command — trigger graceful shutdown.
 */
function commandStop(): void {
  logger = new Logger({ component: 'CLI', sessionId: 'stop' });
  logger.info(
    'Stop command received. To stop a running orchestrator, send SIGTERM to the process: ' +
      'kill <pid>',
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Argument parsing & main
// ---------------------------------------------------------------------------

function printUsage(): void {
  const usage = `
GPU Orchestrator CLI

Usage:
  gpu-orchestrator start       Start the orchestrator
  gpu-orchestrator stop        Show how to stop a running instance
  gpu-orchestrator status      Show current session health
  gpu-orchestrator --dry-run   Validate config and print settings

Options:
  --help       Show this help message
  --dry-run    Validate configuration without creating sessions
`.trim();

  console.log(usage);
}

async function main(): Promise<void> {
  // Register global error boundary early
  registerGlobalErrorBoundary();

  const args = process.argv.slice(2);

  // Check for --help
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Check for --dry-run (can appear anywhere in args)
  if (args.includes('--dry-run')) {
    commandDryRun();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'start':
      await commandStart();
      break;

    case 'stop':
      commandStop();
      break;

    case 'status':
      commandStatus();
      break;

    default:
      if (command) {
        console.error(`Unknown command: ${command}\n`);
      }
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

// Run
void main();
