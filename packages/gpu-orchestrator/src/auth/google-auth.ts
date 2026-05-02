/**
 * Google authentication for the GPU Orchestrator.
 *
 * Supports two authentication modes:
 * 1. **Service Account** — reads a JSON key file and creates a JWT-based client
 * 2. **OAuth 2.0** — uses client ID, client secret, and refresh token flow
 *
 * Provides automatic token caching and refresh with retry logic (up to 3 attempts
 * with exponential backoff). Returns an authenticated Google Drive API v3 client
 * via {@link GoogleAuth.getDriveClient}.
 *
 * @module
 */

import { readFileSync, existsSync } from 'node:fs';
import { google, type drive_v3 } from 'googleapis';
import { AuthError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/** OAuth scopes required for Google Drive and Colab API access. */
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/colab',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the GoogleAuth class. */
export interface GoogleAuthConfig {
  /** Path to a Google Service Account JSON key file. */
  credentialsPath?: string;
  /** OAuth 2.0 client ID (used with refresh token flow). */
  clientId?: string;
  /** OAuth 2.0 client secret (used with refresh token flow). */
  clientSecret?: string;
  /** OAuth 2.0 refresh token (used with client ID / secret). */
  refreshToken?: string;
}

/** Minimum fields expected in a Service Account JSON key file. */
interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
}

/** Required fields for Service Account key validation. */
const REQUIRED_SA_FIELDS: ReadonlyArray<keyof ServiceAccountKey> = [
  'type',
  'project_id',
  'private_key',
  'client_email',
  'token_uri',
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of token refresh retry attempts. */
const MAX_REFRESH_RETRIES = 3;

/** Base delay in ms for exponential backoff on token refresh. */
const REFRESH_BACKOFF_BASE_MS = 1_000;

/** Safety margin (in ms) before actual expiry to trigger a refresh. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

// ---------------------------------------------------------------------------
// GoogleAuth class
// ---------------------------------------------------------------------------

/**
 * Manages Google API authentication for the GPU Orchestrator.
 *
 * Instantiate with either a `credentialsPath` (service account) or
 * `clientId` + `clientSecret` + `refreshToken` (OAuth 2.0).
 *
 * Call {@link getAccessToken} to obtain a valid access token (automatically
 * refreshed when expired). Call {@link getDriveClient} to get an authenticated
 * Google Drive API v3 client.
 */
export class GoogleAuth {
  private readonly config: GoogleAuthConfig;
  private authClient:
    | InstanceType<typeof google.auth.JWT>
    | InstanceType<typeof google.auth.OAuth2>
    | null = null;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: GoogleAuthConfig) {
    this.config = config;
    this.validateConfig();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Return a valid access token, refreshing automatically if expired.
   *
   * Retries up to {@link MAX_REFRESH_RETRIES} times with exponential backoff
   * on transient failures. Throws {@link AuthError} if all retries are
   * exhausted.
   */
  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) {
      return this.cachedToken;
    }
    return this.refreshWithRetry();
  }

  /**
   * Alias kept for API symmetry with the design document.
   * Checks expiry and refreshes if needed.
   */
  async refreshIfExpired(): Promise<string> {
    return this.getAccessToken();
  }

  /**
   * Return an authenticated Google Drive API v3 client.
   *
   * The underlying auth client is lazily initialised on first call and
   * reused for subsequent calls.
   */
  getDriveClient(): drive_v3.Drive {
    const client = this.getOrCreateAuthClient();
    return google.drive({ version: 'v3', auth: client });
  }

  // -----------------------------------------------------------------------
  // Internal — config validation
  // -----------------------------------------------------------------------

  /**
   * Validate the provided configuration at construction time.
   *
   * - For service account mode: the credentials file must exist and contain
   *   all required fields.
   * - For OAuth mode: clientId and clientSecret must both be provided.
   * - At least one authentication mode must be configured.
   */
  private validateConfig(): void {
    const { credentialsPath, clientId, clientSecret } = this.config;

    if (credentialsPath) {
      this.validateServiceAccountFile(credentialsPath);
      return;
    }

    if (clientId || clientSecret) {
      if (!clientId) {
        throw new AuthError('OAuth clientId is required when clientSecret is provided', {
          component: 'GoogleAuth',
          operation: 'validateConfig',
        });
      }
      if (!clientSecret) {
        throw new AuthError('OAuth clientSecret is required when clientId is provided', {
          component: 'GoogleAuth',
          operation: 'validateConfig',
        });
      }
      return;
    }

    throw new AuthError(
      'No Google credentials configured. Provide either credentialsPath (service account) or clientId + clientSecret (OAuth 2.0)',
      { component: 'GoogleAuth', operation: 'validateConfig' },
    );
  }

  /**
   * Validate that a service account JSON key file exists and contains all
   * required fields.
   */
  private validateServiceAccountFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new AuthError(`Credentials file not found: ${filePath}`, {
        component: 'GoogleAuth',
        operation: 'validateConfig',
      });
    }

    let parsed: Record<string, unknown>;
    try {
      const raw = readFileSync(filePath, 'utf-8');
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      throw new AuthError(
        `Failed to parse credentials file: ${filePath} — ${err instanceof Error ? err.message : String(err)}`,
        { component: 'GoogleAuth', operation: 'validateConfig' },
      );
    }

    const missing = REQUIRED_SA_FIELDS.filter((f) => !(f in parsed) || !parsed[f]);
    if (missing.length > 0) {
      throw new AuthError(
        `Credentials file is missing required fields: ${missing.join(', ')}`,
        { component: 'GoogleAuth', operation: 'validateConfig' },
      );
    }
  }

  // -----------------------------------------------------------------------
  // Internal — auth client creation
  // -----------------------------------------------------------------------

  /**
   * Lazily create and return the underlying Google auth client.
   */
  private getOrCreateAuthClient():
    | InstanceType<typeof google.auth.JWT>
    | InstanceType<typeof google.auth.OAuth2> {
    if (this.authClient) {
      return this.authClient;
    }

    if (this.config.credentialsPath) {
      this.authClient = this.createServiceAccountClient(this.config.credentialsPath);
    } else {
      this.authClient = this.createOAuthClient();
    }

    return this.authClient;
  }

  /**
   * Create a JWT auth client from a service account JSON key file.
   */
  private createServiceAccountClient(
    filePath: string,
  ): InstanceType<typeof google.auth.JWT> {
    const raw = readFileSync(filePath, 'utf-8');
    const key = JSON.parse(raw) as ServiceAccountKey;

    return new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: GOOGLE_SCOPES,
    });
  }

  /**
   * Create an OAuth2 client using client ID, client secret, and optional
   * refresh token.
   */
  private createOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    const client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
    );

    if (this.config.refreshToken) {
      client.setCredentials({ refresh_token: this.config.refreshToken });
    }

    return client;
  }

  // -----------------------------------------------------------------------
  // Internal — token refresh with retry
  // -----------------------------------------------------------------------

  /**
   * Refresh the access token with up to {@link MAX_REFRESH_RETRIES} attempts
   * and exponential backoff (1 s, 2 s, 4 s).
   */
  private async refreshWithRetry(): Promise<string> {
    const client = this.getOrCreateAuthClient();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
      try {
        const tokenResponse = await client.getAccessToken();
        const token =
          typeof tokenResponse === 'string'
            ? tokenResponse
            : tokenResponse?.token;

        if (!token) {
          throw new Error('Token response did not contain an access token');
        }

        // Cache the token and compute expiry.
        this.cachedToken = token;

        // Try to read expiry from the client credentials.
        const credentials = 'credentials' in client ? client.credentials : undefined;
        const expiryDate =
          credentials && typeof credentials === 'object' && 'expiry_date' in credentials
            ? (credentials as { expiry_date?: number }).expiry_date
            : undefined;

        this.tokenExpiresAt = expiryDate ?? Date.now() + 3_600_000; // default 1 h

        return token;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't sleep after the last attempt.
        if (attempt < MAX_REFRESH_RETRIES - 1) {
          const delayMs = REFRESH_BACKOFF_BASE_MS * Math.pow(2, attempt);
          await this.sleep(delayMs);
        }
      }
    }

    throw new AuthError(
      `Failed to refresh Google access token after ${MAX_REFRESH_RETRIES} attempts: ${lastError?.message ?? 'unknown error'}`,
      {
        component: 'GoogleAuth',
        operation: 'refreshToken',
      },
    );
  }

  /**
   * Sleep for the given number of milliseconds.
   * Extracted as a method so tests can override it.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
