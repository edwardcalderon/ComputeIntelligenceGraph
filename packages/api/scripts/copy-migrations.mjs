import { cp, mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const sourceDir = path.join(packageRoot, 'src', 'db', 'migrations');
const destinationDir = path.join(packageRoot, 'dist', 'db', 'migrations');

async function main() {
  await access(sourceDir);

  await rm(destinationDir, { recursive: true, force: true });
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });
}

main().catch((error) => {
  console.error(
    'Failed to copy API migration assets:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
