/**
 * Type definitions for AWS-Native LLM Proxy
 * Validates: Requirements 1.1, 2.1, 3.1
 */

/**
 * Represents a single message in a chat conversation
 * Validates: Requirement 2.1
 */
export interface ChatMessage {
  /** The role of the message sender: 'system', 'user', or 'assistant' */
  role: 'system' | 'user' | 'assistant';
  /** The content of the message */
  content: string;
}

/**
 * Represents an inference request sent to the Colab Worker
 * Validates: Requirements 1.1, 2.1
 */
export interface InferenceRequest {
  /** Unique identifier for correlating request with response (UUIDv4) */
  correlationId: string;
  /** Model name (e.g., 'llama3.2') */
  model: string;
  /** Chat messages for /v1/chat/completions endpoint (optional) */
  messages?: ChatMessage[];
  /** Prompt text for /v1/completions endpoint (optional) */
  prompt?: string;
  /** Sampling temperature, range [0, 2] */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Whether to stream the response (Phase 1: false only) */
  stream?: boolean;
  /** ISO 8601 timestamp when request was created */
  timestamp: string;
  /** Request status (for tracking) */
  status?: string;
}

/**
 * Represents an inference response returned from the Colab Worker
 * Validates: Requirements 2.1
 */
export interface InferenceResponse {
  /** Unique identifier matching the original request's Correlation_ID */
  correlationId: string;
  /** Response status: 'success' or 'error' */
  status: 'success' | 'error';
  /** OpenAI-compatible response body (present on success) */
  body?: OpenAICompletionResponse;
  /** Error details (present on error) */
  error?: {
    code: string;
    message: string;
  };
  /** Time taken to process the inference in milliseconds */
  processingTimeMs: number;
  /** ISO 8601 timestamp when response was created */
  timestamp: string;
}

/**
 * Represents a Colab Worker session in the State Store
 * Validates: Requirement 3.1
 */
export interface WorkerSession {
  /** Unique session identifier (UUIDv4) */
  sessionId: string;
  /** Record type for DynamoDB sort key: 'SESSION' or 'HEARTBEAT' */
  recordType: string;
  /** ISO 8601 timestamp when the session started */
  startedAt: string;
  /** ISO 8601 timestamp of the most recent heartbeat */
  lastHeartbeatAt: string;
  /** Session status: 'active' or 'terminated' */
  status: 'active' | 'terminated';
  /** List of available Ollama model names */
  ollamaModels: string[];
  /** DynamoDB TTL value (Unix epoch seconds) */
  ttl: number;
}

/**
 * Represents an OpenAI-compatible completion response
 * Validates: Requirements 2.4, 5.5
 */
export interface OpenAICompletionResponse {
  /** Unique identifier for the completion */
  id: string;
  /** Object type: 'text_completion' or 'chat.completion' */
  object: string;
  /** Unix timestamp when the completion was created */
  created: number;
  /** Model name used for the completion */
  model: string;
  /** Array of completion choices */
  choices: Array<{
    /** Index of the choice in the choices array */
    index: number;
    /** The completion message (for chat completions) */
    message?: ChatMessage;
    /** The completion text (for text completions) */
    text?: string;
    /** Reason the model stopped generating tokens */
    finish_reason: string;
  }>;
  /** Token usage statistics */
  usage: {
    /** Number of tokens in the prompt */
    prompt_tokens: number;
    /** Number of tokens in the completion */
    completion_tokens: number;
    /** Total number of tokens used */
    total_tokens: number;
  };
}
