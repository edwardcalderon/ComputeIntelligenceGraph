import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptsDir, '..');
const entryFile = path.join(packageDir, 'dist', 'index.js');
const envFile = path.resolve(packageDir, '../../.env');

let child = null;
let shuttingDown = false;
let waitingForBuild = false;

function log(message) {
  process.stdout.write(`[api-dev] ${message}\n`);
}

async function waitForEntryFile() {
  if (existsSync(entryFile)) {
    waitingForBuild = false;
    return;
  }

  if (!waitingForBuild) {
    waitingForBuild = true;
    log('Waiting for dist/index.js to be rebuilt...');
  }

  while (!shuttingDown && !existsSync(entryFile)) {
    await delay(300);
  }

  waitingForBuild = false;
}

function stopChild(signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill(signal);
}

async function launchRuntime() {
  await waitForEntryFile();
  if (shuttingDown) {
    return;
  }

  child = spawn(
    process.execPath,
    ['--watch', `--env-file=${envFile}`, entryFile],
    {
      cwd: packageDir,
      stdio: 'inherit',
    }
  );

  child.on('exit', async (code, signal) => {
    if (shuttingDown) {
      return;
    }

    child = null;

    if (!existsSync(entryFile)) {
      await waitForEntryFile();
      if (!shuttingDown) {
        await launchRuntime();
      }
      return;
    }

    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      return;
    }

    if (code !== 0) {
      log(`Runtime exited with code ${code}. Restarting...`);
      await delay(300);
      if (!shuttingDown) {
        await launchRuntime();
      }
    }
  });
}

function handleShutdown(signal) {
  shuttingDown = true;
  stopChild(signal);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

await launchRuntime();
