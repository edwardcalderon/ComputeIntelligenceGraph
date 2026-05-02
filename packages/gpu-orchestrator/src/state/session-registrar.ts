/**
 * Session Registrar — manages orchestrator session records in the
 * existing `llm-proxy-state` DynamoDB table.
 *
 * Records use the single-table design:
 *   PK = `ORCHESTRATOR#{sessionId}`, SK = `META`
 *
 * The registrar also reads the worker heartbeat from the
 * `SESSION#LATEST` / `META` record written by the Colab worker.
 *
 * All write operations retry up to 3 times with exponential backoff
 * (500 ms → 1 s → 2 s) before throwing a {@link StateStoreError}.
 *
 * @module
 */

import {
  type DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

import { StateStoreError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields required to register an orchestrator session. */
export interface OrchestratorRecord {
  sessionId: string;
  provider: string;
  models: string[];
  createdAt: string;
  lastVerifiedAt: string;
  ttl: number;
}

/** Shape returned by {@link SessionRegistrar.getWorkerHeartbeat}. */
export interface WorkerHeartbeat {
  lastHeartbeatAt: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 24 hours expressed in seconds. */
const TTL_OFFSET_SECONDS = 86_400;

/** Maximum number of retry attempts for DynamoDB writes. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff (500 ms, 1 s, 2 s). */
const BASE_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with up to {@link MAX_RETRIES} attempts using exponential
 * backoff (500 ms × 2^attempt → 500 ms, 1 000 ms, 2 000 ms).
 *
 * On exhaustion the last error is wrapped in a {@link StateStoreError}.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  sessionId?: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt); // 500, 1000, 2000
        await sleep(delayMs);
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);

  throw new StateStoreError(
    `DynamoDB ${operation} failed after ${MAX_RETRIES} retries: ${message}`,
    {
      component: 'SessionRegistrar',
      sessionId,
      operation,
    },
  );
}

// ---------------------------------------------------------------------------
// SessionRegistrar
// ---------------------------------------------------------------------------

/**
 * Manages orchestrator session records in DynamoDB.
 *
 * - {@link registerSession} — PutItem a new orchestrator record
 * - {@link updateTimestamp} — UpdateItem to refresh `lastVerifiedAt` + TTL
 * - {@link removeSession} — DeleteItem for an orchestrator record
 * - {@link getWorkerHeartbeat} — GetItem on `SESSION#LATEST` / `META`
 */
export class SessionRegistrar {
  constructor(
    private readonly dynamoClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  // -----------------------------------------------------------------------
  // Public static helper
  // -----------------------------------------------------------------------

  /**
   * Build the full DynamoDB item for an orchestrator session record.
   *
   * This is intentionally a **public static** method so that property tests
   * can exercise it independently of a DynamoDB client.
   *
   * The `ttl` value is computed as:
   *   `floor(Date.parse(record.createdAt) / 1000) + 86 400`
   */
  static buildRecord(record: OrchestratorRecord): Record<string, unknown> {
    const createdAtEpochSeconds = Math.floor(
      Date.parse(record.createdAt) / 1000,
    );
    const ttl = createdAtEpochSeconds + TTL_OFFSET_SECONDS;

    return {
      PK: `ORCHESTRATOR#${record.sessionId}`,
      SK: 'META',
      sessionId: record.sessionId,
      provider: record.provider,
      models: record.models,
      createdAt: record.createdAt,
      lastVerifiedAt: record.lastVerifiedAt,
      ttl,
    };
  }

  // -----------------------------------------------------------------------
  // Write operations (retried)
  // -----------------------------------------------------------------------

  /**
   * Register a new orchestrator session in DynamoDB.
   *
   * PK = `ORCHESTRATOR#{sessionId}`, SK = `META`.
   * TTL = floor(createdAt epoch seconds) + 86 400.
   */
  async registerSession(record: OrchestratorRecord): Promise<void> {
    const item = SessionRegistrar.buildRecord(record);

    await withRetry(
      () =>
        this.dynamoClient.send(
          new PutCommand({
            TableName: this.tableName,
            Item: item,
          }),
        ),
      'registerSession',
      record.sessionId,
    );
  }

  /**
   * Refresh the `lastVerifiedAt` timestamp and extend the TTL for an
   * existing orchestrator record.
   */
  async updateTimestamp(sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    const newTtl = Math.floor(Date.now() / 1000) + TTL_OFFSET_SECONDS;

    await withRetry(
      () =>
        this.dynamoClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PK: `ORCHESTRATOR#${sessionId}`,
              SK: 'META',
            },
            UpdateExpression:
              'SET lastVerifiedAt = :lv, #ttlAttr = :ttl',
            ExpressionAttributeNames: {
              '#ttlAttr': 'ttl',
            },
            ExpressionAttributeValues: {
              ':lv': now,
              ':ttl': newTtl,
            },
          }),
        ),
      'updateTimestamp',
      sessionId,
    );
  }

  /**
   * Delete the orchestrator record for the given session.
   */
  async removeSession(sessionId: string): Promise<void> {
    await withRetry(
      () =>
        this.dynamoClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: {
              PK: `ORCHESTRATOR#${sessionId}`,
              SK: 'META',
            },
          }),
        ),
      'removeSession',
      sessionId,
    );
  }

  // -----------------------------------------------------------------------
  // Read operations (not retried — callers handle retry at a higher level)
  // -----------------------------------------------------------------------

  /**
   * Read the worker heartbeat from the `SESSION#LATEST` / `META` record.
   *
   * Returns `null` when the record does not exist.
   */
  async getWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: 'SESSION#LATEST',
            SK: 'META',
          },
        }),
      );

      if (!result.Item) {
        return null;
      }

      return {
        lastHeartbeatAt: result.Item['lastHeartbeatAt'] as string,
        status: result.Item['status'] as string,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new StateStoreError(
        `Failed to read worker heartbeat: ${message}`,
        {
          component: 'SessionRegistrar',
          operation: 'getWorkerHeartbeat',
        },
      );
    }
  }
}
