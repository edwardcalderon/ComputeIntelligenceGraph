import type { Resource_Model } from '@cig/graph';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  answer: string;
  cypher?: string;
  needsClarification: boolean;
  clarifyingQuestion?: string;
  sessionId?: string;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const DEFAULT_CLARIFICATION =
  'Can you mention a provider, resource type, or resource name?';

function serializeResource(resource: Resource_Model): string {
  const region = resource.region ? `, ${resource.region}` : '';
  const state = resource.state ? `, ${resource.state}` : '';
  return `${resource.name || resource.id} (${resource.type}, ${resource.provider}${region}${state})`;
}

function serializeResources(resources: Resource_Model[]): string {
  return resources
    .slice(0, 6)
    .map((resource, index) => `${index + 1}. ${serializeResource(resource)}`)
    .join('\n');
}

function serializeHistory(history: ChatTurn[]): string {
  return history
    .slice(-6)
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
    .join('\n');
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '')
      .trim();
  }
  return trimmed;
}

function buildFallbackResponse(question: string, resources: Resource_Model[]): ChatResponse {
  if (resources.length === 0) {
    return {
      answer:
        `I could not find matching infrastructure yet for "${question}". ` +
        'Try asking about a provider, resource type, or resource name.',
      needsClarification: true,
      clarifyingQuestion: DEFAULT_CLARIFICATION,
    };
  }

  const firstBatch = serializeResources(resources);
  const needsClarification = resources.length > 3;
  return {
    answer: `I found ${resources.length} matching resource${resources.length === 1 ? '' : 's'}:\n${firstBatch}`,
    needsClarification,
    clarifyingQuestion: needsClarification
      ? 'Which resource should I expand on, or do you want a provider-specific summary?'
      : undefined,
  };
}

async function tryOpenAiResponse(
  question: string,
  resources: Resource_Model[],
  history: ChatTurn[]
): Promise<ChatResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o-mini';
  const payload = {
    model,
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are the CIG assistant. Answer only from the provided infrastructure context. ' +
          'Return strict JSON with keys: answer (string), needsClarification (boolean), ' +
          'clarifyingQuestion (string or null), cypher (string or null). ' +
          'If the context is insufficient, set needsClarification to true and ask one concise question.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          question,
          recentHistory: serializeHistory(history),
          infrastructureContext: serializeResources(resources),
          matchedResources: resources.map((resource) => ({
            id: resource.id,
            name: resource.name,
            type: resource.type,
            provider: resource.provider,
            region: resource.region ?? null,
            state: resource.state ?? null,
            tags: resource.tags,
          })),
        }),
      },
    ],
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OpenAiChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return null;
    }

    const normalized = stripJsonFence(content);

    try {
      const parsed = JSON.parse(normalized) as Partial<ChatResponse>;
      if (typeof parsed.answer !== 'string' || typeof parsed.needsClarification !== 'boolean') {
        return {
          answer: normalized,
          needsClarification: false,
        };
      }

      return {
        answer: parsed.answer,
        needsClarification: parsed.needsClarification,
        clarifyingQuestion:
          typeof parsed.clarifyingQuestion === 'string' && parsed.clarifyingQuestion.trim()
            ? parsed.clarifyingQuestion.trim()
            : undefined,
        cypher:
          typeof parsed.cypher === 'string' && parsed.cypher.trim()
            ? parsed.cypher.trim()
            : undefined,
      };
    } catch {
      return {
        answer: normalized,
        needsClarification: false,
      };
    }
  } catch {
    return null;
  }
}

export async function answerChatQuestion(
  question: string,
  resources: Resource_Model[],
  history: ChatTurn[] = []
): Promise<ChatResponse> {
  const fallback = buildFallbackResponse(question, resources);
  const aiResponse = await tryOpenAiResponse(question, resources, history);
  return aiResponse ?? fallback;
}
