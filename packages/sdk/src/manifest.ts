import { createHmac, timingSafeEqual } from 'crypto';
import type { SetupManifest } from './types';

const SUPPORTED_VERSIONS = ['1.0'];

/**
 * Serializes a SetupManifest to a base64url-encoded string.
 */
export function serializeManifest(manifest: SetupManifest): string {
  const json = JSON.stringify(manifest);
  return Buffer.from(json).toString('base64url');
}

/**
 * Deserializes a base64url-encoded string back to a SetupManifest.
 * Throws a descriptive error if the input is invalid or the version is unsupported.
 */
export function deserializeManifest(encoded: string): SetupManifest {
  if (!encoded || typeof encoded !== 'string') {
    throw new Error('deserializeManifest: input must be a non-empty string');
  }

  let json: string;
  try {
    json = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    throw new Error('deserializeManifest: failed to decode base64url input');
  }

  if (!json) {
    throw new Error('deserializeManifest: decoded payload is empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('deserializeManifest: decoded payload is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('deserializeManifest: decoded payload is not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  if (!('version' in obj) || typeof obj['version'] !== 'string') {
    throw new Error('deserializeManifest: manifest is missing required "version" field');
  }

  if (!SUPPORTED_VERSIONS.includes(obj['version'])) {
    throw new Error(
      `deserializeManifest: unsupported manifest version "${obj['version']}"; supported versions: ${SUPPORTED_VERSIONS.join(', ')}`
    );
  }

  return parsed as SetupManifest;
}

/**
 * Computes the HMAC-SHA256 signature over the manifest body (all fields except "signature").
 * Returns the manifest with the computed signature attached.
 */
export function signManifest(
  manifest: Omit<SetupManifest, 'signature'>,
  key: string
): SetupManifest {
  if (!key) {
    throw new Error('signManifest: signing key must be a non-empty string');
  }

  const body = JSON.stringify(manifest);
  const signature = createHmac('sha256', key).update(body).digest('hex');

  return { ...manifest, signature } as SetupManifest;
}

/**
 * Verifies the HMAC-SHA256 signature on a SetupManifest.
 * Re-computes the HMAC over the manifest body (excluding "signature") and compares
 * using a timing-safe comparison to prevent timing attacks.
 */
export function verifyManifestSignature(manifest: SetupManifest, key: string): boolean {
  if (!key) {
    throw new Error('verifyManifestSignature: verification key must be a non-empty string');
  }

  const { signature, ...body } = manifest;

  if (!signature) {
    return false;
  }

  const bodyJson = JSON.stringify(body);
  const expected = createHmac('sha256', key).update(bodyJson).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // Buffers of different lengths (e.g. malformed hex) — not equal
    return false;
  }
}
