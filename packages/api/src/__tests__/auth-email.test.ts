import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.hoisted(() => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-auth-email-tests-at-least-32!!';
  process.env['SMTP_HOST'] = 'mail.example.com';
  process.env['SMTP_PORT'] = '587';
  process.env['SMTP_SECURE'] = 'true';
  process.env['SMTP_FROM_EMAIL'] = 'notifications@example.com';
  process.env['SMTP_AUTH_ENABLED'] = 'true';
  process.env['SMTP_PASSWORD'] = 'smtp-password';
  process.env['SMTP_OTP_SUBJECT'] = 'Your one-time code';
});

const mailerMocks = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  const createTransport = vi.fn().mockReturnValue({ sendMail });
  return { sendMail, createTransport };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mailerMocks.createTransport,
  },
  createTransport: mailerMocks.createTransport,
}));

import { createServer } from '../index.js';
import { query } from '../db/client.js';

describe('auth email routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();

    await query(`
      CREATE TABLE IF NOT EXISTS email_otp_challenges (
        email       TEXT PRIMARY KEY,
        code_hash   TEXT NOT NULL,
        attempts    INTEGER NOT NULL DEFAULT 0,
        expires_at  TEXT NOT NULL,
        consumed_at TEXT,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends an OTP email when SMTP is configured', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/send-otp',
      payload: { email: 'person@example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      message: 'OTP email sent',
    });
    expect(mailerMocks.createTransport).toHaveBeenCalledWith({
      host: 'mail.example.com',
      port: 587,
      secure: true,
      auth: {
        user: 'notifications@example.com',
        pass: 'smtp-password',
      },
    });
    expect(mailerMocks.sendMail).toHaveBeenCalledTimes(1);
  });
});
