/**
 * SQS client wrapper with retry logic and response polling
 * Validates: Requirements 1.1, 2.2, 9.3
 */

import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommandInput,
  ReceiveMessageCommandInput,
  Message,
} from '@aws-sdk/client-sqs';

/**
 * Configuration for exponential backoff retry strategy
 */
interface RetryConfig {
  baseDelayMs: number;
  multiplier: number;
  maxRetries: number;
}

/**
 * Default retry configuration: base=500ms, multiplier=3, max_retries=2
 * Attempt 1: immediate
 * Attempt 2: wait 500ms
 * Attempt 3: wait 1500ms (500ms × 3)
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelayMs: 500,
  multiplier: 3,
  maxRetries: 2,
};

/**
 * Options for receiving messages from SQS
 */
export interface ReceiveMessagesOptions {
  /** Maximum number of messages to receive (1-10) */
  maxMessages?: number;
  /** Wait time in seconds for long polling (0-20) */
  waitTimeSeconds?: number;
  /** Message attribute names to retrieve */
  messageAttributeNames?: string[];
}

/**
 * Sleeps for the specified number of milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates the delay for a given retry attempt using exponential backoff
 * @param attempt - The retry attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  if (attempt === 0) return 0; // First attempt is immediate
  return config.baseDelayMs * Math.pow(config.multiplier, attempt - 1);
}

/**
 * Sends a message to an SQS queue with exponential backoff retry logic
 * Validates: Requirements 1.1, 9.3
 *
 * @param queueUrl - The URL of the SQS queue
 * @param body - The message body (will be JSON stringified if not a string)
 * @param attributes - Optional message attributes
 * @param retryConfig - Optional retry configuration (defaults to exponential backoff)
 * @returns The message ID if successful
 * @throws Error if all retry attempts fail
 */
export async function sendMessage(
  queueUrl: string,
  body: string | Record<string, unknown>,
  attributes?: Record<
    string,
    {
      DataType: string;
      StringValue?: string;
      NumberValue?: string;
    }
  >,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<string> {
  const messageBody = typeof body === 'string' ? body : JSON.stringify(body);

  let lastError: Error | null = null;

  // Attempt 1 initial + up to maxRetries retries = total of (maxRetries + 1) attempts
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Calculate and apply backoff delay
      const delayMs = calculateBackoffDelay(attempt, retryConfig);
      if (delayMs > 0) {
        await sleep(delayMs);
      }

      const client = new SQSClient({});
      const input: SendMessageCommandInput = {
        QueueUrl: queueUrl,
        MessageBody: messageBody,
      };

      if (attributes) {
        input.MessageAttributes = attributes;
      }

      const command = new SendMessageCommand(input);
      const response = await client.send(command);

      if (!response.MessageId) {
        throw new Error('No MessageId returned from SQS SendMessage');
      }

      return response.MessageId;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw the error
      if (attempt === retryConfig.maxRetries) {
        throw lastError;
      }
      // Otherwise, continue to next attempt
    }
  }

  // This should never be reached, but throw just in case
  throw lastError || new Error('SendMessage failed after all retry attempts');
}

/**
 * Receives messages from an SQS queue
 * Validates: Requirements 1.2, 2.2
 *
 * @param queueUrl - The URL of the SQS queue
 * @param options - Options for receiving messages
 * @returns Array of received messages
 */
export async function receiveMessages(
  queueUrl: string,
  options: ReceiveMessagesOptions = {}
): Promise<Message[]> {
  const client = new SQSClient({});

  const input: ReceiveMessageCommandInput = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: options.maxMessages || 1,
    WaitTimeSeconds: options.waitTimeSeconds || 0,
  };

  if (options.messageAttributeNames && options.messageAttributeNames.length > 0) {
    input.MessageAttributeNames = options.messageAttributeNames;
  }

  const command = new ReceiveMessageCommand(input);
  const response = await client.send(command);

  return response.Messages || [];
}

/**
 * Deletes a message from an SQS queue
 * Validates: Requirements 1.3
 *
 * @param queueUrl - The URL of the SQS queue
 * @param receiptHandle - The receipt handle of the message to delete
 */
export async function deleteMessage(
  queueUrl: string,
  receiptHandle: string
): Promise<void> {
  const client = new SQSClient({});

  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  });

  await client.send(command);
}

/**
 * Polls the Response_Queue for a message matching a specific Correlation_ID
 * Validates: Requirements 2.2, 2.3
 *
 * @param queueUrl - The URL of the Response_Queue
 * @param correlationId - The Correlation_ID to match
 * @param timeoutMs - Maximum time to poll in milliseconds (default: 90000ms = 90s)
 * @returns The matching message, or null if timeout is reached
 */
export async function pollForCorrelatedResponse(
  queueUrl: string,
  correlationId: string,
  timeoutMs: number = 90000
): Promise<Message | null> {
  const startTime = Date.now();
  const pollIntervalMs = 1000; // Poll every 1 second

  while (Date.now() - startTime < timeoutMs) {
    try {
      const messages = await receiveMessages(queueUrl, {
        maxMessages: 10,
        waitTimeSeconds: 1,
        messageAttributeNames: ['correlation_id', 'status'],
      });

      // Search for a message with matching correlation_id
      for (const message of messages) {
        const messageCorrelationId =
          message.MessageAttributes?.correlation_id?.StringValue;

        if (messageCorrelationId === correlationId) {
          return message;
        }

        // If this message doesn't match, put it back by not deleting it
        // (it will become visible again after VisibilityTimeout)
      }

      // No matching message found, wait before next poll
      const elapsedMs = Date.now() - startTime;
      const remainingMs = timeoutMs - elapsedMs;

      if (remainingMs > 0) {
        const waitMs = Math.min(pollIntervalMs, remainingMs);
        await sleep(waitMs);
      }
    } catch (error) {
      // Log error but continue polling
      console.error('Error polling for correlated response:', error);

      const elapsedMs = Date.now() - startTime;
      const remainingMs = timeoutMs - elapsedMs;

      if (remainingMs > 0) {
        const waitMs = Math.min(pollIntervalMs, remainingMs);
        await sleep(waitMs);
      }
    }
  }

  // Timeout reached without finding matching message
  return null;
}
