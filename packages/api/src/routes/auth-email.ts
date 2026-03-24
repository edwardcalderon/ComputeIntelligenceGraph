/**
 * Custom endpoints for sending OTP-only and magic-link-only emails.
 *
 * POST /api/v1/auth/send-otp        — send OTP code email
 * POST /api/v1/auth/send-magic-link — send magic link email
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

function getEmailRedirectTo(): string {
  const configured = process.env.SUPABASE_EMAIL_REDIRECT_TO ?? process.env.NEXT_PUBLIC_SUPABASE_EMAIL_REDIRECT_TO;
  if (configured) {
    return configured;
  }

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3001';
  return new URL('/auth/callback', dashboardUrl).toString();
}

export async function authEmailRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/send-otp
  app.post('/api/v1/auth/send-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email?: string };
    if (!email || typeof email !== 'string') {
      return reply.status(400).send({ error: 'Missing or invalid email' });
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return reply.status(400).send({ error: 'Missing or invalid email' });
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: getEmailRedirectTo(),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return reply.send({ success: true, message: 'OTP email sent' });
    } catch (err) {
      app.log.error({ err, email: normalizedEmail }, 'Failed to send OTP email');
      return reply.status(502).send({
        error: 'Failed to send OTP email',
        code: 'otp_send_failed',
        statusCode: 502,
      });
    }
  });

  // POST /api/v1/auth/send-magic-link
  app.post('/api/v1/auth/send-magic-link', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email?: string };
    if (!email || typeof email !== 'string') {
      return reply.status(400).send({ error: 'Missing or invalid email' });
    }
    // TODO: Generate magic link, store/associate with user, send magic link email
    // await sendMagicLinkEmail(email, magicLink);
    return reply.send({ success: true, message: 'Magic link email sent (stub)' });
  });
}
