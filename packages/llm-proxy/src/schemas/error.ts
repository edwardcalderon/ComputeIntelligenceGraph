/**
 * Zod schema for consistent error response formatting
 * Validates: Requirements 9.1, 9.4
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Schema for error responses
 * Ensures all error responses contain required fields: error, message, code, requestId
 * Validates: Requirement 9.4
 */
export const ErrorResponseSchema = z.object({
  error: z.string().min(1, 'Error must not be empty'),
  message: z.string().min(1, 'Message must not be empty'),
  code: z.string().min(1, 'Code must not be empty'),
  requestId: z.string(),
});

/**
 * Type export for TypeScript usage
 */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Helper function to build a conformant error response object
 * Ensures all error responses follow the consistent schema
 * Validates: Requirements 9.1, 9.4
 *
 * @param error - The error type/category (e.g., "queue_unavailable", "worker_offline")
 * @param message - Human-readable error message
 * @param code - Machine-readable error code (e.g., "QUEUE_UNAVAILABLE", "WORKER_OFFLINE")
 * @param requestId - Optional request ID for traceability; generates UUIDv4 if not provided
 * @returns A properly formatted error response object
 */
export function formatErrorResponse(
  error: string,
  message: string,
  code: string,
  requestId?: string,
): ErrorResponse {
  const response: ErrorResponse = {
    error,
    message,
    code,
    requestId: requestId || uuidv4(),
  };

  // Validate against schema to ensure conformance
  return ErrorResponseSchema.parse(response);
}
