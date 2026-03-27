import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertSupportedAttachmentType,
  buildAttachmentContextItem,
  resolveChatAudioMaxSeconds,
  transcribeAudioFile,
  type ParsedMultipartFile,
} from '../chat-inputs';

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: vi.fn().mockResolvedValue({ text: 'hello from pdf' }),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

function makeFile(overrides: Partial<ParsedMultipartFile> = {}): ParsedMultipartFile {
  return {
    buffer: Buffer.from('SELECT * FROM schema_migrations;'),
    filename: 'schema.sql',
    mimeType: 'text/x-sql',
    size: 31,
    ...overrides,
  };
}

describe('chat-inputs', () => {
  beforeEach(() => {
    process.env['OPENAI_API_KEY'] = '';
    process.env['CHAT_AUDIO_MAX_SECONDS'] = '120';
  });

  it('builds extracted text for plain-text document attachments', async () => {
    const item = await buildAttachmentContextItem(makeFile());

    expect(item).toEqual(
      expect.objectContaining({
        type: 'attachment',
        kind: 'document',
        name: 'schema.sql',
      })
    );
    expect(item.extractedText).toContain('SELECT * FROM schema_migrations;');
  });

  it('extracts text from PDF documents', async () => {
    const item = await buildAttachmentContextItem(
      makeFile({
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fake'),
      })
    );

    expect(item.kind).toBe('document');
    expect(item.extractedText).toContain('hello from pdf');
  });

  it('rejects unsupported attachment types', () => {
    expect(() => assertSupportedAttachmentType('application/zip')).toThrow(
      'Unsupported attachment type'
    );
  });

  it('rejects audio files that exceed the configured duration limit', async () => {
    process.env['OPENAI_API_KEY'] = 'test-openai-key';

    await expect(
      transcribeAudioFile({
        file: makeFile({
          filename: 'voice.webm',
          mimeType: 'audio/webm',
          buffer: Buffer.from('voice'),
        }),
        durationMs: (resolveChatAudioMaxSeconds() + 1) * 1000,
        mode: 'review',
      })
    ).rejects.toThrow('Audio exceeds');
  });
});
