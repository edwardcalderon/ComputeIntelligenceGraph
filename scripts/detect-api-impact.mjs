#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { detectApiImpact, defaultReadTextAtRef } from './api-impact.mjs';

function writeGithubOutput(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return Promise.resolve();
  }

  const lines = Object.entries(outputs).map(([key, value]) => {
    if (typeof value === 'string') {
      return `${key}=${value}`;
    }

    return `${key}=${JSON.stringify(value)}`;
  });

  return appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
    },
  });

  const result = await detectApiImpact({
    baseRef: values.base,
    headRef: values.head ?? 'HEAD',
    readTextAtRef: defaultReadTextAtRef,
  });

  await writeGithubOutput({
    api_source_changed: String(result.apiSourceChanged),
    api_runtime_changed: String(result.apiRuntimeChanged),
    release_metadata_only: String(result.releaseMetadataOnly),
    has_relevant_changes: String(result.hasRelevantChanges),
    api_source_fingerprint: result.apiSourceFingerprint,
    api_source_tag: result.apiSourceTag,
  });

  if (!process.env.GITHUB_OUTPUT) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(
    'Failed to detect API impact:',
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exit(1);
});

