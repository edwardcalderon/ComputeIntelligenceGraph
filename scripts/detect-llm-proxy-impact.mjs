#!/usr/bin/env node

/**
 * Detect changes relevant to LLM Proxy deployment
 * Outputs environment variables for GitHub Actions workflow
 */

import { execSync } from 'child_process';
import crypto from 'crypto';

const args = process.argv.slice(2);
let base = null;
let head = 'HEAD';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base') {
    base = args[i + 1];
    i++;
  } else if (args[i] === '--head') {
    head = args[i + 1];
    i++;
  }
}

function getChangedFiles(base, head) {
  try {
    if (base) {
      return execSync(`git diff --name-only ${base}..${head}`, { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(Boolean);
    } else {
      return execSync(`git diff-tree --no-commit-id --name-only -r ${head}`, { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(Boolean);
    }
  } catch (error) {
    console.error('Failed to get changed files:', error.message);
    process.exit(1);
  }
}

function getSourceFingerprint(base, head) {
  try {
    const files = getChangedFiles(base, head)
      .filter(
        (file) =>
          file.startsWith('packages/llm-proxy/src/') ||
          file.startsWith('packages/llm-proxy/package.json') ||
          file.startsWith('packages/llm-proxy/tsconfig.json')
      )
      .sort();

    if (files.length === 0) {
      return null;
    }

    const content = files.map((file) => {
      try {
        return execSync(`git show ${head}:${file}`, { encoding: 'utf-8' });
      } catch {
        return '';
      }
    }).join('\n');

    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  } catch (error) {
    console.error('Failed to compute source fingerprint:', error.message);
    return null;
  }
}

function getSourceTag(head) {
  try {
    const tag = execSync(`git describe --tags --exact-match ${head}`, { encoding: 'utf-8' }).trim();
    if (tag.startsWith('llm-proxy-')) {
      return tag;
    }
    return null;
  } catch {
    return null;
  }
}

function detectImpact(base, head) {
  const changedFiles = getChangedFiles(base, head);

  const llmProxySourceChanged = changedFiles.some(
    (file) =>
      file.startsWith('packages/llm-proxy/src/') ||
      file.startsWith('packages/llm-proxy/package.json') ||
      file.startsWith('packages/llm-proxy/tsconfig.json')
  );

  const llmProxyRuntimeChanged = changedFiles.some(
    (file) =>
      file.startsWith('packages/llm-proxy/infra/') ||
      file.startsWith('packages/llm-proxy/sst.config.ts') ||
      file.startsWith('packages/llm-proxy/sst-env.d.ts')
  );

  const hasRelevantChanges = llmProxySourceChanged || llmProxyRuntimeChanged;

  const sourceTag = getSourceTag(head);
  const sourceFingerprint = getSourceFingerprint(base, head);

  return {
    llm_proxy_source_changed: llmProxySourceChanged ? 'true' : 'false',
    llm_proxy_runtime_changed: llmProxyRuntimeChanged ? 'true' : 'false',
    has_relevant_changes: hasRelevantChanges ? 'true' : 'false',
    llm_proxy_source_tag: sourceTag || sourceFingerprint || 'latest',
  };
}

const impact = detectImpact(base, head);

for (const [key, value] of Object.entries(impact)) {
  console.log(`${key}=${value}`);
}
