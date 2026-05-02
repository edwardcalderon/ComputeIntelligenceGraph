/**
 * LLM Proxy deployment types and interfaces.
 * @packageDocumentation
 */

export interface LlmProxyDeploymentConfig {
  appName?: string;
  stage?: string;
  region: string;
  domain: string;
  imageRepository: string;
  imageUri: string;
  lambdaMemoryMb?: number;
  lambdaTimeoutSeconds?: number;
  bootstrapOnly?: boolean;
  createPipeline?: boolean;
  hostedZoneDomain?: string;
  certificateArn?: string;
  projectTag?: string;
  pipelineRepo?: string;
  pipelinePrefix?: string;
  pipelinePermissionsMode?: 'admin' | 'least-privilege';
  pipelineBranchProduction?: string;
}

export interface LlmProxyRuntimeConfig {
  domain: string;
  region: string;
  imageRepository: string;
  imageUri: string;
  lambdaMemoryMb: number;
  lambdaTimeoutSeconds: number;
  hostedZoneDomain?: string;
  certificateArn?: string;
}

export interface LlmProxyDeploymentResult {
  success: boolean;
  resourceId: string;
  url: string;
  connectionDetails: {
    apiUrl: string;
    healthUrl: string;
    modelsUrl: string;
    repositoryName: string;
  };
}

export interface InferenceRequest {
  correlationId: string;
  model: string;
  messages?: Array<{ role: string; content: string }>;
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  timestamp: number;
}

export interface InferenceResponse {
  correlationId: string;
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: { role: string; content: string };
    text?: string;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  processingTimeMs: number;
}

export interface WorkerSession {
  sessionId: string;
  recordType: string;
  startedAt: string;
  lastHeartbeatAt: string;
  status: 'active' | 'terminated';
  ollamaModels: string[];
  ttl: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: ChatMessage;
    text?: string;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
