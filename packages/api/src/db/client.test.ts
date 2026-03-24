import { describe, expect, it } from 'vitest';
import { translatePlaceholdersForPostgres } from './client.js';

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
