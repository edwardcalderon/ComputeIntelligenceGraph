import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(scriptDir, '..');
const readmePath = resolve(pkgDir, 'README.md');
const before = readFileSync(readmePath, 'utf8');

execFileSync('node', [resolve(scriptDir, 'sync-readme.mjs')], {
  cwd: pkgDir,
  stdio: 'inherit',
});

const after = readFileSync(readmePath, 'utf8');

if (before !== after) {
  writeFileSync(readmePath, before);
  console.error('README.md is out of sync with CHANGELOG.md. Run `npm run version:update-readme`.');
  process.exit(1);
}

console.log('README.md is synchronized with CHANGELOG.md.');
