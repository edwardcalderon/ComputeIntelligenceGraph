import type {
  CartographyRunResponse,
  CartographyStatus,
  CartographyRecentRuns,
} from './types.js';

export class CartographyClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.CARTOGRAPHY_URL ?? 'http://cartography:8001') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async triggerRun(): Promise<CartographyRunResponse> {
    const res = await fetch(`${this.baseUrl}/run`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Cartography /run failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<CartographyRunResponse>;
  }

  async getStatus(): Promise<CartographyStatus> {
    const res = await fetch(`${this.baseUrl}/status`);
    if (!res.ok) {
      throw new Error(`Cartography /status failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<CartographyStatus>;
  }

  async getRecentRuns(): Promise<CartographyRecentRuns> {
    const res = await fetch(`${this.baseUrl}/runs`);
    if (!res.ok) {
      throw new Error(`Cartography /runs failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<CartographyRecentRuns>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
