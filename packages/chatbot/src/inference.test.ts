import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

beforeEach(() => {
  restoreEnv();
  vi.resetModules();
});

afterEach(() => {
  restoreEnv();
  vi.resetModules();
});

async function loadInference(): Promise<typeof import('./inference.js')> {
  return import('./inference.js');
}

describe('resolveInferenceProvider', () => {
  it('prefers the explicit provider when configured', async () => {
    process.env.CIG_INFERENCE_PROVIDER = 'ollama';

    const { resolveInferenceProvider } = await loadInference();

    expect(resolveInferenceProvider()).toBe('ollama');
  });

  it('treats self-hosted mode as ollama-backed by default', async () => {
    process.env.CIG_AUTH_MODE = 'self-hosted';

    const { resolveInferenceProvider } = await loadInference();

    expect(resolveInferenceProvider()).toBe('ollama');
  });

  it('does not force ollama just because demo mode is enabled', async () => {
    process.env.CIG_DEMO_MODE = 'true';

    const { resolveInferenceProvider } = await loadInference();

    expect(resolveInferenceProvider()).toBe('fallback');
  });
});
