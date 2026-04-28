/**
 * DynamoDB state store for worker session management and heartbeats
 * Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6, 4.2, 4.3, 4.5
 */

import {
  DynamoDBClient,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { WorkerSession } from '../types.js';

/**
 * Initialize DynamoDB Document Client
 * Uses AWS SDK v3 with lib-dynamodb for simplified document operations
 */
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Table name for the state store
 * Validates: Requirement 4.5
 */
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'llm-proxy-state';

/**
 * TTL duration in seconds (24 hours)
 * Validates: Requirement 3.6
 */
const TTL_SECONDS = 86400;

/**
 * Heartbeat freshness threshold in seconds (120 seconds)
 * Validates: Requirement 3.3
 */
const HEARTBEAT_THRESHOLD_SECONDS = 120;

/**
 * Retrieves the latest active worker session from the State Store
 * Reads PK=SESSION#LATEST, SK=META to get the current worker session
 * Validates: Requirements 3.1, 3.3
 *
 * @returns The latest WorkerSession if found, or null if no session exists
 * @throws Error if DynamoDB operation fails
 */
export async function getLatestSession(): Promise<WorkerSession | null> {
  try {
    const input: GetCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        PK: 'SESSION#LATEST',
        SK: 'META',
      },
    };

    const command = new GetCommand(input);
    const response = await docClient.send(command);

    if (!response.Item) {
      return null;
    }

    return response.Item as WorkerSession;
  } catch (error) {
    console.error('Error retrieving latest session:', error);
    throw error;
  }
}

/**
 * Checks if the current worker is healthy based on heartbeat freshness
 * A worker is considered healthy if the last heartbeat is within 120 seconds of now
 * Validates: Requirements 3.3, 3.4
 *
 * @returns true if worker is healthy (heartbeat within 120s), false otherwise
 * @throws Error if DynamoDB operation fails or session retrieval fails
 */
export async function isWorkerHealthy(): Promise<boolean> {
  try {
    const session = await getLatestSession();

    if (!session) {
      return false;
    }

    const lastHeartbeatTime = new Date(session.lastHeartbeatAt).getTime();
    const nowTime = Date.now();
    const diffSeconds = (nowTime - lastHeartbeatTime) / 1000;

    return diffSeconds <= HEARTBEAT_THRESHOLD_SECONDS;
  } catch (error) {
    console.error('Error checking worker health:', error);
    return false;
  }
}

/**
 * Registers a new worker session in the State Store
 * Writes session record with conditional check to prevent concurrent registration conflicts
 * Updates the LATEST pointer to reference this new session
 * Validates: Requirements 3.1, 4.2, 4.3, 4.5
 *
 * @param sessionId - Unique session identifier (UUIDv4)
 * @param models - Array of available Ollama model names
 * @param startedAt - ISO 8601 timestamp when the session started
 * @returns The registered WorkerSession object
 * @throws Error if conditional write fails or DynamoDB operation fails
 */
export async function registerSession(
  sessionId: string,
  models: string[],
  startedAt: string
): Promise<WorkerSession> {
  try {
    // Calculate TTL: current time + 24 hours in Unix epoch seconds
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

    // Create the session record
    const session: WorkerSession = {
      sessionId,
      recordType: 'SESSION',
      startedAt,
      lastHeartbeatAt: startedAt,
      status: 'active',
      ollamaModels: models,
      ttl,
    };

    // Write the session record with PK=SESSION#{sessionId}, SK=META
    const putSessionInput: PutCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: 'META',
        ...session,
      },
      // Conditional check: only write if this is a new session (no existing item)
      ConditionExpression: 'attribute_not_exists(PK)',
    };

    const putSessionCommand = new PutCommand(putSessionInput);
    await docClient.send(putSessionCommand);

    // Update the LATEST pointer to reference this new session
    const putLatestInput: PutCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        PK: 'SESSION#LATEST',
        SK: 'META',
        sessionId,
        recordType: 'SESSION',
        startedAt,
        lastHeartbeatAt: startedAt,
        status: 'active',
        ollamaModels: models,
        ttl,
      },
    };

    const putLatestCommand = new PutCommand(putLatestInput);
    await docClient.send(putLatestCommand);

    console.log(`Session registered: ${sessionId}`);
    return session;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      console.error(
        `Conditional check failed for session registration: ${sessionId}`,
        error
      );
      throw new Error(
        `Session ${sessionId} already exists or concurrent registration detected`
      );
    }
    console.error('Error registering session:', error);
    throw error;
  }
}

/**
 * Updates the heartbeat timestamp for an active session
 * Also updates the TTL to extend the session lifetime by 24 hours
 * Validates: Requirements 3.2, 3.6
 *
 * @param sessionId - The session ID to update
 * @returns The updated WorkerSession object
 * @throws Error if DynamoDB operation fails
 */
export async function updateHeartbeat(sessionId: string): Promise<WorkerSession> {
  try {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

    const input: UpdateCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SESSION#${sessionId}`,
        SK: 'META',
      },
      UpdateExpression:
        'SET lastHeartbeatAt = :now, ttl = :ttl, #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':now': now,
        ':ttl': ttl,
        ':status': 'active',
      },
      ReturnValues: 'ALL_NEW',
    };

    const command = new UpdateCommand(input);
    const response = await docClient.send(command);

    if (!response.Attributes) {
      throw new Error(`Failed to update heartbeat for session ${sessionId}`);
    }

    return response.Attributes as WorkerSession;
  } catch (error) {
    console.error(`Error updating heartbeat for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Terminates a worker session by marking its status as terminated
 * The session record remains in DynamoDB until TTL expiration
 * Validates: Requirements 3.5
 *
 * @param sessionId - The session ID to terminate
 * @returns The updated WorkerSession object with status set to 'terminated'
 * @throws Error if DynamoDB operation fails
 */
export async function terminateSession(sessionId: string): Promise<WorkerSession> {
  try {
    const input: UpdateCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SESSION#${sessionId}`,
        SK: 'META',
      },
      UpdateExpression: 'SET #status = :terminated',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':terminated': 'terminated',
      },
      ReturnValues: 'ALL_NEW',
    };

    const command = new UpdateCommand(input);
    const response = await docClient.send(command);

    if (!response.Attributes) {
      throw new Error(`Failed to terminate session ${sessionId}`);
    }

    console.log(`Session terminated: ${sessionId}`);
    return response.Attributes as WorkerSession;
  } catch (error) {
    console.error(`Error terminating session ${sessionId}:`, error);
    throw error;
  }
}
