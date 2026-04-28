/**
 * Correlation ID generation and SQS message building for request/response matching
 * Validates: Requirements 1.1, 2.1, 2.6
 */

import { v4 as uuidv4 } from 'uuid';
import { InferenceRequest, InferenceResponse } from '../types.js';

/**
 * Generates a unique Correlation ID using UUIDv4
 * Validates: Requirements 1.1, 2.1, 2.6
 *
 * @returns A UUIDv4 string to be used as the Correlation_ID for request/response matching
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Builds an SQS message for the Request_Queue with proper message attributes
 * Validates: Requirements 1.1, 2.1
 *
 * @param correlationId - The unique Correlation_ID for this request
 * @param payload - The inference request payload to be sent to the Colab_Worker
 * @returns An object containing the message body and MessageAttributes for SQS SendMessage
 */
export function buildRequestMessage(
  correlationId: string,
  payload: InferenceRequest
): {
  body: string;
  messageAttributes: Record<
    string,
    {
      DataType: string;
      StringValue?: string;
    }
  >;
} {
  return {
    body: JSON.stringify(payload),
    messageAttributes: {
      correlation_id: {
        DataType: 'String',
        StringValue: correlationId,
      },
      request_timestamp: {
        DataType: 'String',
        StringValue: new Date().toISOString(),
      },
    },
  };
}

/**
 * Builds an SQS message for the Response_Queue with proper message attributes
 * Validates: Requirements 2.1, 2.6
 *
 * @param correlationId - The Correlation_ID from the original request
 * @param response - The inference response body (OpenAI-compatible format)
 * @param status - The response status: 'success' or 'error'
 * @param processingTimeMs - The time taken to process the inference in milliseconds
 * @returns An object containing the message body and MessageAttributes for SQS SendMessage
 */
export function buildResponseMessage(
  correlationId: string,
  response: unknown,
  status: 'success' | 'error',
  processingTimeMs: number
): {
  body: string;
  messageAttributes: Record<
    string,
    {
      DataType: string;
      StringValue?: string;
    }
  >;
} {
  return {
    body: JSON.stringify(response),
    messageAttributes: {
      correlation_id: {
        DataType: 'String',
        StringValue: correlationId,
      },
      status: {
        DataType: 'String',
        StringValue: status,
      },
      processing_time_ms: {
        DataType: 'Number',
        StringValue: processingTimeMs.toString(),
      },
    },
  };
}

/**
 * Extracts the Correlation_ID from an SQS message's MessageAttributes
 * Validates: Requirements 1.1, 2.1, 2.6
 *
 * @param message - The SQS message object containing MessageAttributes
 * @returns The Correlation_ID string, or undefined if not found
 */
export function extractCorrelationId(message: {
  MessageAttributes?: Record<
    string,
    {
      DataType?: string;
      StringValue?: string;
    }
  >;
}): string | undefined {
  return message.MessageAttributes?.correlation_id?.StringValue;
}
