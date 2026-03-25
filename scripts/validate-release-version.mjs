#!/usr/bin/env node

import process from 'node:process';
import { normalizeReleaseTag, validateReleaseTagVersion } from './release-version.mjs';

function parseArgs(argv) {
  let tag = null;
  let version = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--tag') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--tag requires a value');
      }
      tag = argv[index];
      continue;
    }

    if (arg === '--version') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--version requires a value');
      }
      version = argv[index];
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      return { help: true, tag, version };
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, tag, version };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/validate-release-version.mjs --tag <tag> --version <version>

Examples:
  node scripts/validate-release-version.mjs --tag v0.1.115 --version 0.1.115
  node scripts/validate-release-version.mjs --tag v0.1.115+build.2 --version 0.1.115
`.trim());
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (typeof args.tag !== 'string' || args.tag.trim() === '') {
    throw new Error('--tag is required');
  }

  if (typeof args.version !== 'string' || args.version.trim() === '') {
    throw new Error('--version is required');
  }

  const normalizedTag = normalizeReleaseTag(args.tag);
  if (!normalizedTag) {
    throw new Error(`Tag ${args.tag} is not a release tag.`);
  }

  const result = validateReleaseTagVersion(args.tag, args.version);
  if (!result.ok) {
    throw new Error(result.error);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
