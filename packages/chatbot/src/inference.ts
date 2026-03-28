export type InferenceProvider = 'openai' | 'ollama' | 'fallback';

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export interface ChatCompletionRequest {
  messages: ChatCompletionMessage[];
  temperature?: number;
  jsonMode?: boolean;
  model?: string;
  provider?: InferenceProvider;
}

export interface EmbeddingRequest {
  input: string;
  model?: string;
  provider?: InferenceProvider;
}

export interface InferenceHealthStatus {
  provider: InferenceProvider;
  model: string;
  configured: boolean;
  reachable: boolean;
  providerReachable: boolean;
  checkedAt: string;
  latencyMs: number | null;
}

const OPENAI_CHAT_MODEL_DEFAULT = 'gpt-4o-mini';
const OPENAI_EMBEDDING_MODEL_DEFAULT = 'text-embedding-3-small';
const OPENAI_BASE_URL_DEFAULT = 'https://api.openai.com/v1';
const OLLAMA_CHAT_MODEL_DEFAULT = 'llama3.2:3b';
const OLLAMA_EMBEDDING_MODEL_DEFAULT = 'nomic-embed-text-v2-moe';
const OLLAMA_VISION_MODEL_DEFAULT = 'llama3.2-vision';
const OLLAMA_BASE_URL_DEFAULT = 'http://localhost:11434/v1';
const HEALTH_TIMEOUT_MS = 2_500;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function ensureHttpProtocol(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `http://${value}`;
}

function resolveExplicitProvider(): InferenceProvider | undefined {
  const provider = process.env.CIG_INFERENCE_PROVIDER?.trim().toLowerCase();
  if (provider === 'openai' || provider === 'ollama' || provider === 'fallback') {
    return provider;
  }

  return undefined;
}

export function resolveInferenceProvider(): InferenceProvider {
  const explicit = resolveExplicitProvider();
  if (explicit) {
    return explicit;
  }

  if (process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_HOST?.trim()) {
    return 'ollama';
  }

  if (process.env.CIG_AUTH_MODE === 'self-hosted') {
    return 'ollama';
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return 'openai';
  }

  return 'fallback';
}

function resolveOpenAiBaseUrl(): string {
  const configured = process.env.OPENAI_BASE_URL?.trim();
  return normalizeBaseUrl(configured || OPENAI_BASE_URL_DEFAULT);
}

function resolveOllamaBaseUrl(): string {
  const configured = process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_HOST?.trim();
  const base = normalizeBaseUrl(ensureHttpProtocol(configured || OLLAMA_BASE_URL_DEFAULT));
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

function resolveProviderBaseUrl(provider: InferenceProvider): string {
  return provider === 'ollama' ? resolveOllamaBaseUrl() : resolveOpenAiBaseUrl();
}

function resolveProviderApiKey(provider: InferenceProvider): string | undefined {
  if (provider === 'ollama') {
    return process.env.OLLAMA_API_KEY?.trim() || undefined;
  }

  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

export function resolveChatModel(provider?: InferenceProvider): string {
  const resolvedProvider = provider ?? resolveInferenceProvider();

  if (resolvedProvider === 'ollama') {
    return process.env.OLLAMA_CHAT_MODEL?.trim() || OLLAMA_CHAT_MODEL_DEFAULT;
  }

  return process.env.OPENAI_CHAT_MODEL?.trim() || OPENAI_CHAT_MODEL_DEFAULT;
}

export function resolveEmbeddingModel(provider?: InferenceProvider): string {
  const resolvedProvider = provider ?? resolveInferenceProvider();

  if (resolvedProvider === 'ollama') {
    return process.env.OLLAMA_EMBEDDING_MODEL?.trim() || OLLAMA_EMBEDDING_MODEL_DEFAULT;
  }

  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || OPENAI_EMBEDDING_MODEL_DEFAULT;
}

export function resolveVisionModel(provider?: InferenceProvider): string {
  const resolvedProvider = provider ?? resolveInferenceProvider();

  if (resolvedProvider === 'ollama') {
    return process.env.OLLAMA_VISION_MODEL?.trim() || OLLAMA_VISION_MODEL_DEFAULT;
  }

  return process.env.OPENAI_VISION_MODEL?.trim() || resolveChatModel('openai');
}

function extractChatContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const choices = Array.isArray(record['choices']) ? (record['choices'] as unknown[]) : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.['message'] as Record<string, unknown> | undefined;

  const candidate = message?.['content'] ?? record['output_text'] ?? record['response'] ?? record['message'];
  if (typeof candidate === 'string') {
    return candidate;
  }

  if (candidate && typeof candidate === 'object' && Array.isArray((candidate as { content?: unknown[] }).content)) {
    return (candidate as { content?: unknown[] }).content!
      .map((part) => {
        if (!part || typeof part !== 'object') {
          return '';
        }

        const item = part as Record<string, unknown>;
        return typeof item['text'] === 'string' ? item['text'] : '';
      })
      .join('');
  }

  return null;
}

function extractEmbeddingVector(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record['data'])) {
    const first = record['data'][0] as Record<string, unknown> | undefined;
    const embedding = first?.['embedding'];
    if (Array.isArray(embedding)) {
      return embedding
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    }
  }

  if (Array.isArray(record['embeddings'])) {
    const first = record['embeddings'][0];
    if (Array.isArray(first)) {
      return first.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
  }

  const directEmbedding = record['embedding'];
  if (Array.isArray(directEmbedding)) {
    return directEmbedding
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }

  return null;
}

export async function runChatCompletion(request: ChatCompletionRequest): Promise<string | null> {
  const provider = request.provider ?? resolveInferenceProvider();
  if (provider === 'fallback') {
    return null;
  }

  const model = request.model?.trim() || resolveChatModel(provider);
  if (!model) {
    return null;
  }

  const baseUrl = resolveProviderBaseUrl(provider);
  const apiKey = resolveProviderApiKey(provider);
  const body: Record<string, unknown> = {
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0.2,
    stream: false,
  };

  if (request.jsonMode && provider === 'openai') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const content = extractChatContent(payload);
  return typeof content === 'string' ? content.trim() : null;
}

export async function runEmbedding(request: EmbeddingRequest): Promise<number[] | null> {
  const provider = request.provider ?? resolveInferenceProvider();
  if (provider === 'fallback') {
    return null;
  }

  const model = request.model?.trim() || resolveEmbeddingModel(provider);
  if (!model) {
    return null;
  }

  const baseUrl = resolveProviderBaseUrl(provider);
  const apiKey = resolveProviderApiKey(provider);
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      input: request.input,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const embedding = extractEmbeddingVector(payload);
  return embedding && embedding.length > 0 ? embedding : null;
}

export async function probeInferenceHealth(endpointReady: boolean): Promise<InferenceHealthStatus> {
  const provider = resolveInferenceProvider();
  const model = resolveChatModel(provider);
  const checkedAt = new Date().toISOString();

  if (provider === 'fallback') {
    return {
      provider,
      model,
      configured: false,
      reachable: endpointReady,
      providerReachable: false,
      checkedAt,
      latencyMs: null,
    };
  }

  const apiKey = resolveProviderApiKey(provider);
  if (provider === 'openai' && !apiKey) {
    return {
      provider,
      model,
      configured: false,
      reachable: endpointReady,
      providerReachable: false,
      checkedAt,
      latencyMs: null,
    };
  }

  const baseUrl = resolveProviderBaseUrl(provider);
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}`, {
      method: 'GET',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });

    return {
      provider,
      model,
      configured: true,
      reachable: endpointReady,
      providerReachable: response.ok,
      checkedAt,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      provider,
      model,
      configured: true,
      reachable: endpointReady,
      providerReachable: false,
      checkedAt,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
