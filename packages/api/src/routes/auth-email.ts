/**
 * Custom endpoints for sending OTP-only and magic-link-only emails.
 *
 * POST /api/v1/auth/send-otp        — send OTP code email
 * POST /api/v1/auth/send-magic-link — send magic link email
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// import your mailer and template logic here

export async function authEmailRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/send-otp
  app.post('/api/v1/auth/send-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email?: string };
    if (!email || typeof email !== 'string') {
      return reply.status(400).send({ error: 'Missing or invalid email' });
    }
    // TODO: Generate OTP, store/associate with user, send OTP email
    // await sendOtpEmail(email, otpCode);
    return reply.send({ success: true, message: 'OTP email sent (stub)' });
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
