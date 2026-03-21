import * as fs from 'fs';
import * as path from 'path';

interface ResolveIacModulesPathOptions {
  cwd?: string;
  envPath?: string;
  providedPath?: string;
}

const DEFAULT_IAC_PATH = 'packages/iac';
const FALLBACK_CANDIDATES = [
  'packages/iac',
  'infra/terraform',
  'iac',
] as const;

export function resolveIacModulesPath(
  options: ResolveIacModulesPathOptions = {}
): string {
  const cwd = options.cwd ?? process.cwd();
  const providedPath = options.providedPath?.trim();
  if (providedPath) {
    return toAbsolutePath(providedPath, cwd);
  }

  const envPath = options.envPath ?? process.env.IAC_MODULES_PATH;
  if (envPath?.trim()) {
    return toAbsolutePath(envPath, cwd);
  }

  for (const candidate of FALLBACK_CANDIDATES) {
    const resolvedCandidate = path.resolve(cwd, candidate);
    if (hasExpectedModuleLayout(resolvedCandidate)) {
      return resolvedCandidate;
    }
  }

  return path.resolve(cwd, DEFAULT_IAC_PATH);
}

function toAbsolutePath(targetPath: string, cwd: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(cwd, targetPath);
}

function hasExpectedModuleLayout(targetPath: string): boolean {
  return (
    fs.existsSync(path.join(targetPath, 'modules', 'networking', 'main.tf')) &&
    fs.existsSync(path.join(targetPath, 'modules', 'compute', 'main.tf'))
  );
}
