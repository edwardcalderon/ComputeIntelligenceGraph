import { cp, mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(packageRoot, '../..');

// DB migrations → dist/db/migrations
const migrationsSource = path.join(packageRoot, 'src', 'db', 'migrations');
const migrationsDestination = path.join(packageRoot, 'dist', 'db', 'migrations');

// OTP email template → dist/emails/
const emailTemplateSource = path.join(monorepoRoot, 'packages', 'emails', 'src', 'templates', 'otp-only.html');
const emailTemplateDestination = path.join(packageRoot, 'dist', 'emails', 'otp-only.html');

async function main() {
  // Copy DB migrations
  await access(migrationsSource);
  await rm(migrationsDestination, { recursive: true, force: true });
  await mkdir(path.dirname(migrationsDestination), { recursive: true });
  await cp(migrationsSource, migrationsDestination, { recursive: true });

  // Copy OTP email template
  await access(emailTemplateSource);
  await mkdir(path.dirname(emailTemplateDestination), { recursive: true });
  await cp(emailTemplateSource, emailTemplateDestination);
}

main().catch((error) => {
  console.error(
    'Failed to copy API migration assets:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
