/**
 * manifest.ts — Manifest fetch, decode, and signature verification
 *
 * Requirements: 5.1, 5.2, 21.7
 *
 * Provides `resolveManifest` which accepts either a URL or inline base64,
 * fetches/decodes the manifest, verifies its HMAC signature, checks expiry,
 * and returns the verified SetupManifest — or throws with a clear error.
 *
 * This module never writes anything to disk.
 */

import { deserializeManifest, verifyManifestSignature } from './sdk.js';
import type { SetupManifest } from './sdk.js';

/**
 * Fetches the raw base64-encoded manifest string from a URL.
 * Sends an Authorization header when an access token is provided.
 *
 * Requirement 5.1 — manifest may be supplied as a URL
 */
export async function fetchManifestFromUrl(
  url: string,
  accessToken?: string
): Promise<string> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch manifest from ${url}: HTTP ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();
  if (!text || !text.trim()) {
    throw new Error(`Manifest URL returned an empty response: ${url}`);
  }

  return text.trim();
}

/**
 * Resolves, decodes, and verifies a SetupManifest from either a URL or
 * an inline base64 string.
 *
 * Steps:
 *  1. If `manifestArg` starts with http:// or https://, fetch via authenticated GET.
 *  2. Decode the base64 payload with `deserializeManifest`.
 *  3. If MANIFEST_SIGNING_KEY or CIG_MANIFEST_KEY is set, verify the HMAC signature.
 *  4. Check `expiresAt` — abort if the manifest has expired.
 *  5. Return the verified manifest.
 *
 * Requirements 5.1, 5.2, 21.7
 */
export async function resolveManifest(
  manifestArg: string,
  accessToken?: string
): Promise<SetupManifest> {
  // Step 1 — determine source and obtain the base64 payload
  let encoded: string;

  if (manifestArg.startsWith('http://') || manifestArg.startsWith('https://')) {
    encoded = await fetchManifestFromUrl(manifestArg, accessToken);
  } else {
    encoded = manifestArg;
  }

  // Step 2 — decode
  const manifest = deserializeManifest(encoded);

  // Step 3 — signature verification (Requirement 21.7)
  const signingKey =
    process.env['MANIFEST_SIGNING_KEY'] ?? process.env['CIG_MANIFEST_KEY'];

  if (signingKey) {
    const valid = verifyManifestSignature(manifest, signingKey);
    if (!valid) {
      throw new Error(
        'Manifest signature verification failed. The manifest may have been tampered with.'
      );
    }
  }

  // Step 4 — expiry check (Requirement 5.2)
  if (new Date(manifest.expiresAt) < new Date()) {
    throw new Error(
      'Manifest has expired. Please regenerate the manifest from the Dashboard.'
    );
  }

  // Step 5 — return verified manifest
  return manifest;
}
