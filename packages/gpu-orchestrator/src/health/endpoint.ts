/**
 * Local HTTP health endpoint that exposes the current health status of all
 * monitored dimensions as JSON.
 *
 * Uses `node:http` — no external dependencies. Responds to `GET /health`
 * with the latest {@link HealthCheckResult} plus session metadata (session
 * ID, provider, uptime). All other paths receive a 404.
 *
 * @module
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { HealthCheckResult } from './recovery.js';
import type { Logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata included alongside the health check result. */
export interface HealthEndpointMetadata {
  sessionId: string;
  provider: string;
  /** ISO 8601 timestamp of when the session started. */
  startedAt: string;
  /** Session uptime in seconds. */
  uptimeSeconds: number;
}

/** Shape of the JSON response returned by `GET /health`. */
export interface HealthEndpointResponse {
  status: 'ok' | 'unhealthy' | 'no_data';
  metadata: HealthEndpointMetadata | null;
  health: HealthCheckResult | null;
}

/** Function that returns the latest health check result (or `null` if none). */
export type HealthResultProvider = () => HealthCheckResult | null;

/** Function that returns the current endpoint metadata (or `null` if none). */
export type MetadataProvider = () => HealthEndpointMetadata | null;

// ---------------------------------------------------------------------------
// HealthEndpoint
// ---------------------------------------------------------------------------

/**
 * A lightweight HTTP server that serves the current health status on
 * `GET /health`.
 *
 * ```ts
 * const endpoint = new HealthEndpoint({
 *   port: 8787,
 *   getHealthResult: () => latestResult,
 *   getMetadata: () => ({ sessionId, provider, startedAt, uptimeSeconds }),
 *   logger,
 * });
 * await endpoint.start();
 * // …
 * await endpoint.stop();
 * ```
 */
export class HealthEndpoint {
  private readonly port: number;
  private readonly getHealthResult: HealthResultProvider;
  private readonly getMetadata: MetadataProvider;
  private readonly logger: Logger;
  private server: Server | null = null;

  constructor(options: {
    port: number;
    getHealthResult: HealthResultProvider;
    getMetadata: MetadataProvider;
    logger: Logger;
  }) {
    this.port = options.port;
    this.getHealthResult = options.getHealthResult;
    this.getMetadata = options.getMetadata;
    this.logger = options.logger;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Start the HTTP server. Resolves when the server is listening.
   */
  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    const server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server = server;

    return new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.port, () => {
        server.removeListener('error', reject);
        this.logger.info(`Health endpoint listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server. Resolves when the server is fully closed.
   */
  async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }

    this.server = null;

    return new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.logger.info('Health endpoint stopped');
          resolve();
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Request handling
  // -----------------------------------------------------------------------

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method === 'GET' && req.url === '/health') {
      this.handleHealthRequest(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  private handleHealthRequest(res: ServerResponse): void {
    const healthResult = this.getHealthResult();
    const metadata = this.getMetadata();

    let status: HealthEndpointResponse['status'];
    if (healthResult === null) {
      status = 'no_data';
    } else if (healthResult.overall) {
      status = 'ok';
    } else {
      status = 'unhealthy';
    }

    const body: HealthEndpointResponse = {
      status,
      metadata,
      health: healthResult,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }
}
