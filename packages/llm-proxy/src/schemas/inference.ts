/**
 * Zod schemas for OpenAI-compatible inference request validation
 * Validates: Requirements 5.1, 5.2
 */

import { z } from 'zod';

/**
 * Schema for a single chat message
 * Validates: Requirement 5.1
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1, 'Content must not be empty'),
});

/**
 * Schema for chat completion requests (POST /v1/chat/completions)
 * Validates: Requirements 5.1, 5.2
 */
export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1, 'Model must not be empty'),
  messages: z.array(ChatMessageSchema).min(1, 'Messages array must not be empty'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().positive('max_tokens must be a positive integer').optional().default(512),
  stream: z.literal(false).optional().default(false),
});

/**
 * Schema for text completion requests (POST /v1/completions)
 * Validates: Requirements 5.1, 5.2
 */
export const CompletionRequestSchema = z.object({
  model: z.string().min(1, 'Model must not be empty'),
  prompt: z.string().min(1, 'Prompt must not be empty'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().positive('max_tokens must be a positive integer').optional().default(512),
  stream: z.literal(false).optional().default(false),
});

/**
 * Type exports for TypeScript usage
 */
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
export type CompletionRequest = z.infer<typeof CompletionRequestSchema>;
