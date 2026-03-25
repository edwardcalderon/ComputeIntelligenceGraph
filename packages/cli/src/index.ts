#!/usr/bin/env node
import { loadCliEnv } from './env.js';
import { runCli } from './cli.js';

loadCliEnv();

runCli(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
