#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

function runGit(args) {
  return execFileSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

function main() {
  try {
    const insideWorkTree = runGit(['rev-parse', '--is-inside-work-tree']);
    if (insideWorkTree !== 'true') {
      return;
    }
  } catch {
    return;
  }

  const currentHooksPath = (() => {
    try {
      return runGit(['config', '--get', 'core.hooksPath']);
    } catch {
      return '';
    }
  })();

  if (currentHooksPath === '.husky') {
    console.log('Git hooks already configured to use .husky');
    return;
  }

  try {
    runGit(['config', 'core.hooksPath', '.husky']);
    console.log('Configured git hooks path: .husky');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Skipped git hooks path setup: ${message}`);
  }
}

main();
