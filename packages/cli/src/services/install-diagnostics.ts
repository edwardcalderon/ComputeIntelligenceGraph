import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const DIAGNOSTICS_FILE_NAME = 'install-failure.log';
const DOCKER_COMPOSE_LOG_TAIL = '100';
const DOCKER_COMMAND_TIMEOUT_MS = 15_000;

function captureDockerComposeOutput(installDir: string, args: string[]): string {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: installDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: DOCKER_COMMAND_TIMEOUT_MS,
  });

  const sections: string[] = [];
  const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';

  if (stdout) {
    sections.push(stdout);
  }

  if (stderr) {
    sections.push(stderr);
  }

  if (result.status !== 0) {
    sections.push(
      `Exit code: ${result.status ?? 'unknown'}${result.signal ? `, signal ${result.signal}` : ''}`
    );
  }

  if (result.error) {
    sections.push(`Spawn error: ${result.error.message}`);
  }

  return sections.length > 0 ? sections.join('\n') : 'No output captured.';
}

export function collectDockerComposeDiagnostics(installDir: string): string {
  const collectedAt = new Date().toISOString();
  const sections = [
    `=== docker compose ps ===\n${captureDockerComposeOutput(installDir, ['ps'])}`,
    `=== docker compose logs --no-color --tail ${DOCKER_COMPOSE_LOG_TAIL} ===\n${captureDockerComposeOutput(
      installDir,
      ['logs', '--no-color', '--tail', DOCKER_COMPOSE_LOG_TAIL]
    )}`,
  ];

  return [
    'CIG install diagnostics',
    `Generated at: ${collectedAt}`,
    `Install directory: ${installDir}`,
    '',
    sections.join('\n\n'),
    '',
  ].join('\n');
}

export function persistDockerComposeDiagnostics(installDir: string, diagnostics: string): string {
  const diagnosticsPath = path.join(installDir, DIAGNOSTICS_FILE_NAME);
  const content = diagnostics.trim() || 'No Docker Compose diagnostics were captured.';

  fs.writeFileSync(diagnosticsPath, `${content}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });

  return diagnosticsPath;
}

export function buildHealthTimeoutMessage(
  installDir: string,
  timeoutMs: number,
  diagnosticsPath?: string | null
): string {
  const timeoutMinutes = Math.max(1, Math.round(timeoutMs / 60_000));
  const timeoutLabel = `${timeoutMinutes} minute${timeoutMinutes === 1 ? '' : 's'}`;

  if (diagnosticsPath) {
    return (
      `Timed out waiting for CIG Node to become healthy after ${timeoutLabel}. ` +
      `Recent Docker Compose diagnostics were saved to ${diagnosticsPath}. ` +
      `The stack at ${installDir} was rolled back after the timeout, so inspect that file for the failure details.`
    );
  }

  return (
    `Timed out waiting for CIG Node to become healthy after ${timeoutLabel}. ` +
    `The stack at ${installDir} was rolled back after the timeout.`
  );
}
