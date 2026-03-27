import type { ChatTemplateSelection, GraphSource } from '@cig/sdk';

export type ChatContextItem =
  | ChatResourceLinkContextItem
  | ChatAttachmentContextItem
  | ChatCodeSnippetContextItem
  | ChatTranscriptContextItem;

export interface ChatResourceLinkContextItem {
  type: 'resource_link';
  resourceId: string;
  title: string;
  href: string;
  provider?: string;
  resourceType?: string;
}

export interface ChatAttachmentContextItem {
  type: 'attachment';
  kind: 'image' | 'document';
  name: string;
  mimeType: string;
  extractedText?: string;
  summary?: string;
}

export interface ChatCodeSnippetContextItem {
  type: 'code_snippet';
  language: 'sql' | 'search' | 'cypher';
  title: string;
  content: string;
}

export interface ChatTranscriptContextItem {
  type: 'transcript';
  text: string;
  durationMs: number;
  mode: 'review' | 'auto-send';
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  contextItems?: ChatContextItem[];
}

export interface ChatTemplateContextSelection extends ChatTemplateSelection {
  lane?: string;
  source?: GraphSource;
}

const MAX_CONTEXT_ITEMS = 5;
const MAX_LINK_FIELD_LENGTH = 200;
const MAX_ATTACHMENT_FIELD_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 400;
const MAX_TEXT_LENGTH = 4_000;
const MAX_EXTRACTED_TEXT_LENGTH = 8_000;
const MAX_CODE_LENGTH = 4_000;
const MAX_TEMPLATE_FIELD_LENGTH = 160;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function sanitizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return undefined;
  }

  return truncate(normalized, maxLength);
}

function sanitizeLongText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return truncate(normalized, maxLength);
}

function normalizeTemplateSelectionField(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return undefined;
  }

  return truncate(normalized, maxLength);
}

function normalizeTemplateSelectionSource(value: unknown): GraphSource | undefined {
  if (value === 'live' || value === 'demo') {
    return value;
  }

  return undefined;
}

function normalizeResourceLinkContextItem(value: unknown): ChatResourceLinkContextItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  const resourceId = sanitizeText(item['resourceId'], MAX_LINK_FIELD_LENGTH);
  const title = sanitizeText(item['title'], MAX_LINK_FIELD_LENGTH);
  const href = sanitizeText(item['href'], MAX_LINK_FIELD_LENGTH);

  if (!resourceId || !title || !href) {
    return null;
  }

  return {
    type: 'resource_link',
    resourceId,
    title,
    href,
    provider: sanitizeText(item['provider'], 40),
    resourceType: sanitizeText(item['resourceType'], 80),
  };
}

function normalizeAttachmentContextItem(value: unknown): ChatAttachmentContextItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  const kind = item['kind'] === 'image' ? 'image' : item['kind'] === 'document' ? 'document' : null;
  const name = sanitizeText(item['name'], MAX_ATTACHMENT_FIELD_LENGTH);
  const mimeType = sanitizeText(item['mimeType'], 120);

  if (!kind || !name || !mimeType) {
    return null;
  }

  return {
    type: 'attachment',
    kind,
    name,
    mimeType,
    extractedText: sanitizeLongText(item['extractedText'], MAX_EXTRACTED_TEXT_LENGTH),
    summary: sanitizeText(item['summary'], MAX_SUMMARY_LENGTH),
  };
}

function normalizeCodeSnippetContextItem(value: unknown): ChatCodeSnippetContextItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  const language =
    item['language'] === 'sql' || item['language'] === 'search' || item['language'] === 'cypher'
      ? item['language']
      : null;
  const title = sanitizeText(item['title'], 80);
  const content = sanitizeLongText(item['content'], MAX_CODE_LENGTH);

  if (!language || !title || !content) {
    return null;
  }

  return {
    type: 'code_snippet',
    language,
    title,
    content,
  };
}

function normalizeTranscriptContextItem(value: unknown): ChatTranscriptContextItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  const text = sanitizeLongText(item['text'], MAX_TEXT_LENGTH);
  const durationMs = Number(item['durationMs']);
  const mode = item['mode'] === 'auto-send' ? 'auto-send' : item['mode'] === 'review' ? 'review' : null;

  if (!text || !Number.isFinite(durationMs) || durationMs < 0 || !mode) {
    return null;
  }

  return {
    type: 'transcript',
    text,
    durationMs: Math.round(durationMs),
    mode,
  };
}

export function normalizeChatContextItems(input: unknown): ChatContextItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .slice(0, MAX_CONTEXT_ITEMS)
    .map((value) => {
      if (!value || typeof value !== 'object') {
        return null;
      }

      const item = value as Record<string, unknown>;
      switch (item['type']) {
        case 'resource_link':
          return normalizeResourceLinkContextItem(item);
        case 'attachment':
          return normalizeAttachmentContextItem(item);
        case 'code_snippet':
          return normalizeCodeSnippetContextItem(item);
        case 'transcript':
          return normalizeTranscriptContextItem(item);
        default:
          return null;
      }
    })
    .filter((item): item is ChatContextItem => item !== null);
}

export function normalizeChatTemplateSelection(
  input: unknown
): ChatTemplateContextSelection | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const item = input as Record<string, unknown>;
  const id = normalizeTemplateSelectionField(item['id'], MAX_TEMPLATE_FIELD_LENGTH);
  const title = normalizeTemplateSelectionField(item['title'], MAX_TEMPLATE_FIELD_LENGTH);
  const prompt = normalizeTemplateSelectionField(item['prompt'], MAX_TEXT_LENGTH);

  if (!id || !title || !prompt) {
    return null;
  }

  return {
    id,
    title,
    prompt,
    lane: normalizeTemplateSelectionField(item['lane'], MAX_TEMPLATE_FIELD_LENGTH),
    source: normalizeTemplateSelectionSource(item['source']),
  };
}

export function summarizeChatContextItems(items: ChatContextItem[]): string {
  if (items.length === 0) {
    return '';
  }

  return items
    .map((item) => {
      switch (item.type) {
        case 'resource_link':
          return `Linked resource: ${item.title}${item.resourceType ? ` (${item.resourceType})` : ''}${item.provider ? ` on ${item.provider}` : ''}`;
        case 'attachment':
          return `Attachment ${item.kind}: ${item.name}${item.summary ? ` — ${item.summary}` : ''}${item.extractedText ? `\n${truncate(item.extractedText, 1_200)}` : ''}`;
        case 'code_snippet':
          return `Code snippet [${item.language}] ${item.title}:\n${truncate(item.content, 1_600)}`;
        case 'transcript':
          return `Voice transcript (${item.mode}, ${item.durationMs} ms): ${truncate(item.text, 1_200)}`;
      }
    })
    .join('\n\n');
}

export function deriveChatSeedFromContextItems(items: ChatContextItem[]): string | undefined {
  const first = items[0];
  if (!first) {
    return undefined;
  }

  switch (first.type) {
    case 'resource_link':
      return first.title;
    case 'attachment':
      return first.name;
    case 'code_snippet':
      return first.title;
    case 'transcript':
      return first.text;
  }
}

export function deriveImplicitQuestionFromContextItems(items: ChatContextItem[]): string {
  const hasResourceLink = items.some((item) => item.type === 'resource_link');
  const hasAttachment = items.some((item) => item.type === 'attachment');
  const hasCodeSnippet = items.some((item) => item.type === 'code_snippet');
  const hasTranscript = items.some((item) => item.type === 'transcript');

  if (hasResourceLink && hasCodeSnippet) {
    return 'Review the linked infrastructure resources and attached query snippet.';
  }

  if (hasResourceLink) {
    return 'Review the linked infrastructure resources.';
  }

  if (hasAttachment) {
    return 'Review the attached files and answer from them.';
  }

  if (hasCodeSnippet) {
    return 'Review the attached query or search snippet.';
  }

  if (hasTranscript) {
    return 'Review the voice transcript and respond to it.';
  }

  return 'Review the provided chat context.';
}
