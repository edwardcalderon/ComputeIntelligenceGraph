import type { FastifyRequest } from 'fastify';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.split(',')[0]?.trim();
  }

  return value?.split(',')[0]?.trim();
}

function normalizeHostname(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  try {
    const candidate = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    return new URL(candidate).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    if (trimmed.startsWith('[')) {
      const closingIndex = trimmed.indexOf(']');
      if (closingIndex > 1) {
        return trimmed.slice(1, closingIndex);
      }
    }

    const colonCount = trimmed.split(':').length - 1;
    if (colonCount <= 1) {
      return trimmed.split(':')[0] ?? trimmed;
    }

    return trimmed;
  }
}

function isLocalhostHostname(value: string): boolean {
  return LOCALHOST_HOSTNAMES.has(normalizeHostname(value));
}

function isLoopbackIp(value: string): boolean {
  return (
    value === '127.0.0.1' ||
    value === '::1' ||
    value === '::ffff:127.0.0.1'
  );
}

/** Return the client IP from the Fastify request. */
export function getClientIp(request: FastifyRequest): string {
  const forwarded = readHeaderValue(request.headers['x-forwarded-for']);
  if (forwarded) {
    return forwarded;
  }

  return request.ip;
}

/**
 * Returns true when the request is local enough for localhost-only browser
 * flows.
 *
 * Docker port mapping can make `request.ip` look non-local even when the
 * browser is on localhost, so we also accept a localhost origin or referer.
 */
export function isLocalBrowserRequest(request: FastifyRequest): boolean {
  const ip = getClientIp(request);
  if (isLoopbackIp(ip)) {
    return true;
  }

  const originCandidates = [
    readHeaderValue(request.headers['origin']),
    readHeaderValue(request.headers['referer']),
  ].filter(Boolean) as string[];

  return originCandidates.some(isLocalhostHostname);
}

/**
 * Backwards-compatible alias for bootstrap routes.
 */
export function isLocalBootstrapRequest(request: FastifyRequest): boolean {
  return isLocalBrowserRequest(request);
}
