import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { ChatMessagePresentation, ChatTemplateSelection } from '@cig/sdk';
import { query, withTransaction } from './db/client';
import type { ChatContextItem, ChatTurn } from './chat-context';

export interface ChatSessionSummary {
  id: string;
  title: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedChatMessage extends ChatTurn {
  id: string;
  template?: ChatTemplateSelection;
  presentation?: ChatMessagePresentation;
}

interface ChatSessionRow extends QueryResultRow {
  id: string;
  title: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessageRow extends QueryResultRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata_json?: string | null;
}

interface ChatMessageMetadata {
  contextItems?: ChatContextItem[];
  template?: ChatTemplateSelection;
  presentation?: ChatMessagePresentation;
}

const DEFAULT_CHAT_TITLE = 'New chat';
const CHAT_HISTORY_LIMIT = 12;
const MAX_TITLE_LENGTH = 72;
const MAX_PREVIEW_LENGTH = 120;

let ensureTablesPromise: Promise<void> | null = null;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function deriveTitle(seed?: string | null): string {
  const normalized = normalizeWhitespace(seed ?? '');
  if (!normalized) {
    return DEFAULT_CHAT_TITLE;
  }

  return truncate(normalized, MAX_TITLE_LENGTH);
}

function sanitizeTitle(title: string): string {
  const normalized = normalizeWhitespace(title);
  if (!normalized) {
    throw new Error('Chat session title is required');
  }

  return truncate(normalized, MAX_TITLE_LENGTH);
}

function derivePreview(content: string): string {
  return truncate(normalizeWhitespace(content), MAX_PREVIEW_LENGTH);
}

function mapSession(row: ChatSessionRow): ChatSessionSummary {
  return {
    id: row.id,
    title: row.title,
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: ChatMessageRow): PersistedChatMessage {
  let contextItems: ChatContextItem[] | undefined;
  let template: ChatTemplateSelection | undefined;
  let presentation: ChatMessagePresentation | undefined;

  if (row.metadata_json) {
    try {
      const parsed = JSON.parse(row.metadata_json) as ChatMessageMetadata;
      if (Array.isArray(parsed.contextItems) && parsed.contextItems.length > 0) {
        contextItems = parsed.contextItems;
      }
      if (parsed.template && typeof parsed.template === 'object') {
        template = parsed.template;
      }
      if (parsed.presentation && typeof parsed.presentation === 'object') {
        presentation = parsed.presentation;
      }
    } catch {
      contextItems = undefined;
      template = undefined;
      presentation = undefined;
    }
  }

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    contextItems,
    template,
    presentation,
  };
}

async function ensureChatTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          last_message_preview TEXT,
          last_message_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
          ON chat_sessions (user_id, updated_at DESC)
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          metadata_json TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
          ON chat_messages (session_id, created_at ASC)
      `);

      try {
        await query(`ALTER TABLE chat_messages ADD COLUMN metadata_json TEXT`);
      } catch {
        // Column already exists.
      }
    })();
  }

  await ensureTablesPromise;
}

async function getSessionRow(userId: string, sessionId: string): Promise<ChatSessionRow | null> {
  await ensureChatTables();

  const result = await query<ChatSessionRow>(
    `SELECT id, title, last_message_preview, last_message_at, created_at, updated_at
       FROM chat_sessions
      WHERE user_id = ? AND id = ?
      LIMIT 1`,
    [userId, sessionId]
  );

  return result.rows[0] ?? null;
}

export async function listChatSessions(userId: string): Promise<ChatSessionSummary[]> {
  await ensureChatTables();

  const result = await query<ChatSessionRow>(
    `SELECT id, title, last_message_preview, last_message_at, created_at, updated_at
       FROM chat_sessions
      WHERE user_id = ?
      ORDER BY COALESCE(last_message_at, updated_at) DESC, created_at DESC`,
    [userId]
  );

  return result.rows.map(mapSession);
}

export async function getChatSessionMessages(
  userId: string,
  sessionId: string,
  limit?: number
): Promise<PersistedChatMessage[]> {
  await ensureChatTables();

  const hasLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0;
  const normalizedLimit = hasLimit ? Math.floor(limit!) : null;

  const sql = hasLimit
    ? `SELECT id, role, content, timestamp, metadata_json
         FROM (
           SELECT m.id,
                  m.role,
                  m.content,
                  m.metadata_json,
                  m.created_at AS timestamp
             FROM chat_messages m
             JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ? AND s.id = ?
            ORDER BY m.created_at DESC
            LIMIT ?
         ) recent
        ORDER BY timestamp ASC`
    : `SELECT m.id,
              m.role,
              m.content,
              m.metadata_json,
              m.created_at AS timestamp
         FROM chat_messages m
         JOIN chat_sessions s ON s.id = m.session_id
        WHERE s.user_id = ? AND s.id = ?
        ORDER BY m.created_at ASC`;

  const params = hasLimit ? [userId, sessionId, normalizedLimit] : [userId, sessionId];
  const result = await query<ChatMessageRow>(sql, params);
  return result.rows.map(mapMessage);
}

export async function ensureChatSession(
  userId: string,
  sessionId?: string,
  seedTitle?: string
): Promise<ChatSessionSummary> {
  await ensureChatTables();

  const normalizedSessionId = sessionId?.trim();
  if (normalizedSessionId) {
    const existing = await getSessionRow(userId, normalizedSessionId);
    if (existing) {
      return mapSession(existing);
    }
  }

  const now = new Date().toISOString();
  const nextSessionId = normalizedSessionId || randomUUID();

  await query(
    `INSERT INTO chat_sessions (
       id,
       user_id,
       title,
       last_message_preview,
       last_message_at,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      nextSessionId,
      userId,
      deriveTitle(seedTitle),
      null,
      null,
      now,
      now,
    ]
  );

  const created = await getSessionRow(userId, nextSessionId);
  if (!created) {
    throw new Error('Failed to create chat session');
  }

  return mapSession(created);
}

export async function appendChatExchange(
  userId: string,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  options: {
    userContextItems?: ChatContextItem[];
    userTemplate?: ChatTemplateSelection;
    assistantContextItems?: ChatContextItem[];
    assistantPresentation?: ChatMessagePresentation;
  } = {}
): Promise<ChatSessionSummary> {
  await ensureChatTables();

  const now = new Date().toISOString();
  const nextTitle = deriveTitle(userMessage);
  const nextPreview = derivePreview(assistantMessage);
  const userMetadataJson =
    options.userContextItems && options.userContextItems.length > 0
      ? JSON.stringify({
          contextItems: options.userContextItems,
          template: options.userTemplate,
        })
      : options.userTemplate
        ? JSON.stringify({ template: options.userTemplate })
        : null;
  const assistantMetadataJson =
    options.assistantContextItems && options.assistantContextItems.length > 0
      ? JSON.stringify({
          contextItems: options.assistantContextItems,
          presentation: options.assistantPresentation,
        })
      : options.assistantPresentation
        ? JSON.stringify({ presentation: options.assistantPresentation })
        : null;

  await withTransaction(async (txQuery) => {
    const sessionResult = await txQuery<ChatSessionRow>(
      `SELECT id, title, last_message_preview, last_message_at, created_at, updated_at
         FROM chat_sessions
        WHERE user_id = ? AND id = ?
        LIMIT 1`,
      [userId, sessionId]
    );

    const session = sessionResult.rows[0];
    if (!session) {
      throw new Error('Chat session not found');
    }

    const effectiveTitle =
      session.title === DEFAULT_CHAT_TITLE && userMessage.trim().length > 0
        ? nextTitle
        : session.title;

    await txQuery(
      `INSERT INTO chat_messages (id, session_id, role, content, metadata_json, created_at)
       VALUES (?, ?, 'user', ?, ?, ?)`,
      [randomUUID(), sessionId, userMessage, userMetadataJson, now]
    );

    await txQuery(
      `INSERT INTO chat_messages (id, session_id, role, content, metadata_json, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?)`,
      [randomUUID(), sessionId, assistantMessage, assistantMetadataJson, now]
    );

    await txQuery(
      `UPDATE chat_sessions
          SET title = ?,
              last_message_preview = ?,
              last_message_at = ?,
              updated_at = ?
        WHERE user_id = ? AND id = ?`,
      [effectiveTitle, nextPreview, now, now, userId, sessionId]
    );
  });

  const updated = await getSessionRow(userId, sessionId);
  if (!updated) {
    throw new Error('Chat session was updated but could not be reloaded');
  }

  return mapSession(updated);
}

export async function renameChatSession(
  userId: string,
  sessionId: string,
  title: string
): Promise<ChatSessionSummary | null> {
  await ensureChatTables();

  const existing = await getSessionRow(userId, sessionId);
  if (!existing) {
    return null;
  }

  const nextTitle = sanitizeTitle(title);
  const now = new Date().toISOString();

  await query(
    `UPDATE chat_sessions
        SET title = ?,
            updated_at = ?
      WHERE user_id = ? AND id = ?`,
    [nextTitle, now, userId, sessionId]
  );

  const updated = await getSessionRow(userId, sessionId);
  if (!updated) {
    throw new Error('Chat session was renamed but could not be reloaded');
  }

  return mapSession(updated);
}

export async function deleteChatSession(userId: string, sessionId: string): Promise<boolean> {
  await ensureChatTables();

  const existing = await getSessionRow(userId, sessionId);
  if (!existing) {
    return false;
  }

  await withTransaction(async (txQuery) => {
    await txQuery(`DELETE FROM chat_messages WHERE session_id = ?`, [sessionId]);
    await txQuery(`DELETE FROM chat_sessions WHERE user_id = ? AND id = ?`, [userId, sessionId]);
  });

  return true;
}

export async function clearPersistedChatSessionsForTests(): Promise<void> {
  await ensureChatTables();
  await query(`DELETE FROM chat_messages`);
  await query(`DELETE FROM chat_sessions`);
}

export async function getChatHistory(userId: string, sessionId: string): Promise<ChatTurn[]> {
  const messages = await getChatSessionMessages(userId, sessionId, CHAT_HISTORY_LIMIT);
  return messages.map(({ role, content, timestamp, contextItems }) => ({
    role,
    content,
    timestamp,
    contextItems,
  }));
}
