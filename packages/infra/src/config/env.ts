import * as fs from 'node:fs';
import * as path from 'node:path';

function loadFirstExistingEnvFile(candidates: string[]): void {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

export function loadInfraEnv(): void {
  loadFirstExistingEnvFile([
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env.local'),
    path.resolve(process.cwd(), '../../.env'),
  ]);
}

export function resolveAwsRegion(): string {
  const region = process.env.AWS_REGION ?? process.env.API_REGION;
  if (!region || region.trim() === '') {
    throw new Error('AWS_REGION is required');
  }
  return region;
}
