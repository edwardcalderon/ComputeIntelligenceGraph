/// <reference path="./sst-env.d.ts" />

function loadFirstExistingEnvFile(candidates: string[]): void {
  for (const candidate of candidates) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // Keep trying fallback paths until one exists.
    }
  }
}

function loadInfraEnv(): void {
  const cwd = process.cwd();
  loadFirstExistingEnvFile([
    `${cwd}/.env.local`,
    `${cwd}/.env`,
    `${cwd}/../../.env.local`,
    `${cwd}/../../.env`,
  ]);
}

function resolveAwsRegion(): string {
  const region = process.env.AWS_REGION ?? process.env.API_REGION;
  if (!region || region.trim() === '') {
    throw new Error('AWS_REGION is required');
  }
  return region;
}

loadInfraEnv();

export default $config({
  app(input: { stage?: string }) {
    return {
      name: 'llm-proxy',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage ?? ''),
      home: 'aws',
      providers: {
        aws: {
          region: resolveAwsRegion(),
        },
      },
    };
  },
  async run() {
    const { createInfrastructure } = await import('./infra/index.js');
    return createInfrastructure();
  },
});
