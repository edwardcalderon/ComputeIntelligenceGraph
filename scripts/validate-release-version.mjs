#!/usr/bin/env node

import process from 'node:process';
import { normalizeReleaseTag, validateReleaseTagFloor, validateReleaseTagVersion } from './release-version.mjs';

function parseArgs(argv) {
  let tag = null;
  let version = null;
  let floorTag = null;
  let tagPrefix = 'v';

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

    if (arg === '--floor-tag') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--floor-tag requires a value');
      }
      floorTag = argv[index];
      continue;
    }

    if (arg === '--tag-prefix') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--tag-prefix requires a value');
      }
      tagPrefix = argv[index];
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      return { help: true, tag, version, floorTag };
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, tag, version, floorTag, tagPrefix };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/validate-release-version.mjs --tag <tag> --version <version> [--floor-tag <tag>] [--tag-prefix <prefix>]

Examples:
  node scripts/validate-release-version.mjs --tag v0.1.115 --version 0.1.115
  node scripts/validate-release-version.mjs --tag v0.1.115+build.2 --version 0.1.115
  node scripts/validate-release-version.mjs --tag v0.1.115 --version 0.1.115 --floor-tag v0.1.114
  node scripts/validate-release-version.mjs --tag cli-v0.1.115 --version 0.1.115 --tag-prefix cli-v
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

  if (typeof args.floorTag === 'string' && args.floorTag.trim() !== '') {
    const floorResult = validateReleaseTagFloor(args.tag, args.floorTag, args.tagPrefix);
    if (!floorResult.ok) {
      throw new Error(floorResult.error);
    }
  }

  const normalizedTag = normalizeReleaseTag(args.tag, args.tagPrefix);
  if (!normalizedTag) {
    throw new Error(`Tag ${args.tag} is not a release tag.`);
  }

  const result = validateReleaseTagVersion(args.tag, args.version, args.tagPrefix);
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
