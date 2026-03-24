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

export function loadCliEnv(): void {
  loadFirstExistingEnvFile([
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ]);
}

export function resolveAwsRegion(): string | undefined {
  return process.env['AWS_REGION'] ?? process.env['API_REGION'];
}
