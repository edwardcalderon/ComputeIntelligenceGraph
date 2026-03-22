import { CliSecretStore } from '../stores/cli-secret-store.js';

export interface ApiClientOptions {
  baseUrl: string;
  secretStore?: CliSecretStore;
  accessToken?: string;
}

interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly secretStore?: CliSecretStore;
  private accessToken?: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.secretStore = options.secretStore;
    this.accessToken = options.accessToken;
  }

  setAccessToken(token: string | undefined): void {
    this.accessToken = token;
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.buildHeaders(options.headers),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.buildHeaders(options.headers),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.buildHeaders(options.headers),
    });

    return this.handleResponse<T>(response);
  }

  private buildHeaders(headers?: Record<string, string>): Record<string, string> {
    const resolvedToken =
      this.accessToken ??
      this.secretStore?.get<{ accessToken: string }>('auth.tokens')?.accessToken;

    return {
      'Content-Type': 'application/json',
      ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
      ...headers,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;

      try {
        const data = (await response.json()) as { error?: string };
        errorMessage = data.error ?? errorMessage;
      } catch {
        // Ignore JSON parse failures and keep the HTTP error text.
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
