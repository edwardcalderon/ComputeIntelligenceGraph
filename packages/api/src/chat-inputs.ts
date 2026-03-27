import path from 'node:path';
import type { MultipartFile } from '@fastify/multipart';
import { PDFParse } from 'pdf-parse';
import type {
  ChatAttachmentContextItem,
  ChatTranscriptContextItem,
} from './chat-context';

const DEFAULT_CHAT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_CHAT_AUDIO_MAX_SECONDS = 120;
const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1';
const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';
const MAX_EXTRACTED_TEXT_LENGTH = 8_000;
const MAX_SUMMARY_LENGTH = 400;

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/x-sql',
  'application/sql',
  'application/x-sql',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
]);
const AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/ogg',
  'audio/oga',
]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.sql': 'text/x-sql',
  '.webm': 'audio/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

export interface ParsedMultipartFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function sanitizeFilename(filename: string | undefined): string {
  const normalized = normalizeWhitespace(filename ?? '');
  return normalized || 'attachment';
}

function resolveMimeType(filename: string, mimeType: string | undefined): string {
  const normalized = normalizeWhitespace(mimeType ?? '').toLowerCase();
  if (normalized && normalized !== 'application/octet-stream') {
    return normalized;
  }

  const extension = path.extname(filename).toLowerCase();
  return EXTENSION_MIME_MAP[extension] ?? normalized ?? 'application/octet-stream';
}

function isDocumentMimeType(mimeType: string): boolean {
  return DOCUMENT_MIME_TYPES.has(mimeType);
}

function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

function isAudioMimeType(mimeType: string): boolean {
  return AUDIO_MIME_TYPES.has(mimeType);
}

export function resolveChatUploadMaxBytes(): number {
  const parsed = Number.parseInt(process.env.CHAT_UPLOAD_MAX_BYTES ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAT_UPLOAD_MAX_BYTES;
}

export function resolveChatAudioMaxSeconds(): number {
  const parsed = Number.parseInt(process.env.CHAT_AUDIO_MAX_SECONDS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAT_AUDIO_MAX_SECONDS;
}

export async function readMultipartFile(file: MultipartFile): Promise<ParsedMultipartFile> {
  const filename = sanitizeFilename(file.filename);
  const mimeType = resolveMimeType(filename, file.mimetype);
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of file.file) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > resolveChatUploadMaxBytes()) {
      throw new Error(`File exceeds the ${resolveChatUploadMaxBytes()} byte limit.`);
    }
    chunks.push(buffer);
  }

  return {
    buffer: Buffer.concat(chunks),
    filename,
    mimeType,
    size,
  };
}

export function assertSupportedAttachmentType(mimeType: string): void {
  if (!isImageMimeType(mimeType) && !isDocumentMimeType(mimeType)) {
    throw new Error(`Unsupported attachment type: ${mimeType}`);
  }
}

export function assertSupportedAudioType(mimeType: string): void {
  if (!isAudioMimeType(mimeType)) {
    throw new Error(`Unsupported audio type: ${mimeType}`);
  }
}

function summarizeFallbackAttachment(
  kind: 'image' | 'document',
  filename: string,
  mimeType: string
): string {
  const label = kind === 'image' ? 'Image' : 'Document';
  return `${label} attachment "${filename}" (${mimeType}).`;
}

async function extractPdfText(buffer: Buffer): Promise<string | undefined> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    const text = normalizeWhitespace(result.text ?? '');
    return text ? truncate(text, MAX_EXTRACTED_TEXT_LENGTH) : undefined;
  } finally {
    await parser.destroy();
  }
}

async function summarizeImageWithOpenAi(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | undefined> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return undefined;
  }

  const base64 = buffer.toString('base64');
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You summarize uploaded images for an infrastructure assistant. Write one short sentence about what the image likely contains. Mention dashboards, diagrams, alerts, terminals, or code only if visible.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Summarize this uploaded image named "${filename}".`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = normalizeWhitespace(payload.choices?.[0]?.message?.content ?? '');
    return content ? truncate(content, MAX_SUMMARY_LENGTH) : undefined;
  } catch {
    return undefined;
  }
}

export async function buildAttachmentContextItem(
  file: ParsedMultipartFile
): Promise<ChatAttachmentContextItem> {
  assertSupportedAttachmentType(file.mimeType);

  if (isImageMimeType(file.mimeType)) {
    const summary =
      (await summarizeImageWithOpenAi(file.buffer, file.filename, file.mimeType)) ??
      summarizeFallbackAttachment('image', file.filename, file.mimeType);

    return {
      type: 'attachment',
      kind: 'image',
      name: file.filename,
      mimeType: file.mimeType,
      summary,
    };
  }

  let extractedText: string | undefined;
  if (file.mimeType === 'application/pdf') {
    extractedText = await extractPdfText(file.buffer);
  } else {
    extractedText = truncate(file.buffer.toString('utf8').trim(), MAX_EXTRACTED_TEXT_LENGTH);
  }

  return {
    type: 'attachment',
    kind: 'document',
    name: file.filename,
    mimeType: file.mimeType,
    extractedText: extractedText ? normalizeWhitespace(extractedText) : undefined,
    summary: summarizeFallbackAttachment('document', file.filename, file.mimeType),
  };
}

export async function transcribeAudioFile(params: {
  file: ParsedMultipartFile;
  durationMs: number;
  mode: 'review' | 'auto-send';
}): Promise<{ text: string; item: ChatTranscriptContextItem }> {
  const { file, durationMs, mode } = params;
  assertSupportedAudioType(file.mimeType);

  if (durationMs > resolveChatAudioMaxSeconds() * 1000) {
    throw new Error(`Audio exceeds the ${resolveChatAudioMaxSeconds()} second limit.`);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OpenAI transcription is not configured.');
  }

  const model = process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
  const formData = new FormData();
  formData.append('model', model);
  formData.append(
    'file',
    new File([new Uint8Array(file.buffer)], file.filename, {
      type: file.mimeType,
    })
  );

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Transcription failed.');
  }

  const payload = (await response.json()) as { text?: string };
  const text = normalizeWhitespace(payload.text ?? '');
  if (!text) {
    throw new Error('Transcription returned no text.');
  }

  return {
    text,
    item: {
      type: 'transcript',
      text: truncate(text, 4_000),
      durationMs: Math.round(durationMs),
      mode,
    },
  };
}
