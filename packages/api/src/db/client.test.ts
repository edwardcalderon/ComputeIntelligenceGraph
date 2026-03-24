import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translatePlaceholdersForPostgres } from './client.js';

const originalEnv = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

beforeEach(() => {
  restoreEnv();
  vi.resetModules();
});

afterEach(() => {
  restoreEnv();
  vi.resetModules();
});

async function loadClient(): Promise<typeof import('./client.js')> {
  return import('./client.js');
}

describe('translatePlaceholdersForPostgres', () => {
  it('translates positional placeholders in order', () => {
    expect(
      translatePlaceholdersForPostgres(
        'SELECT * FROM email_otp_challenges WHERE email = ? AND attempts < ?'
      )
    ).toBe('SELECT * FROM email_otp_challenges WHERE email = $1 AND attempts < $2');
  });

  it('preserves question marks inside quoted strings and comments', () => {
    expect(
      translatePlaceholdersForPostgres(
        "SELECT 'do not touch ?' AS literal, \"col?name\" AS identifier FROM audit_events -- ? comment\nWHERE id = ? /* ? block comment */"
      )
    ).toBe(
      "SELECT 'do not touch ?' AS literal, \"col?name\" AS identifier FROM audit_events -- ? comment\nWHERE id = $1 /* ? block comment */"
    );
  });

  it('keeps escaped quotes intact while still translating real placeholders', () => {
    expect(
      translatePlaceholdersForPostgres(
        "SELECT 'it''s ?' AS literal, \"col\"\"?name\" AS identifier WHERE status = ? AND note = ?"
      )
    ).toBe(
      "SELECT 'it''s ?' AS literal, \"col\"\"?name\" AS identifier WHERE status = $1 AND note = $2"
    );
  });
});

describe('database mode resolution', () => {
  it('recognizes an explicit postgres DATABASE_URL as the primary database', async () => {
    process.env['DATABASE_URL'] = 'postgresql://postgres:secret@localhost:5432/postgres';

    const { isPostgresDatabase } = await loadClient();

    expect(isPostgresDatabase()).toBe(true);
  });

  it('uses SUPABASE_DIRECT_URL in non-production when DATABASE_URL is not set', async () => {
    delete process.env['DATABASE_URL'];
    process.env['SUPABASE_DIRECT_URL'] =
      'postgresql://postgres:secret@localhost:5432/postgres';

    const { isPostgresDatabase } = await loadClient();

    expect(isPostgresDatabase()).toBe(true);
  });

  it('recognizes explicit sqlite URLs outside production', async () => {
    process.env['DATABASE_URL'] = 'sqlite://:memory:';

    const { isPostgresDatabase } = await loadClient();

    expect(isPostgresDatabase()).toBe(false);
  });

  it('rejects sqlite URLs in production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'sqlite://:memory:';

    const { query } = await loadClient();

    await expect(query('SELECT 1')).rejects.toThrow(
      /SQLite is not allowed in production/i
    );
  });

  it('requires DATABASE_URL in production even if SUPABASE_DIRECT_URL is set', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['DATABASE_URL'];
    process.env['SUPABASE_DIRECT_URL'] =
      'postgresql://postgres:secret@localhost:5432/postgres';

    const { isPostgresDatabase } = await loadClient();

    expect(() => isPostgresDatabase()).toThrow(/No database URL configured/i);
  });

  it('requires a configured database URL', async () => {
    delete process.env['DATABASE_URL'];
    delete process.env['SUPABASE_DIRECT_URL'];

    const { isPostgresDatabase } = await loadClient();

    expect(() => isPostgresDatabase()).toThrow(/No database URL configured/i);
  });
});
