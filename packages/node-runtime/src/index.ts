#!/usr/bin/env node
export * from './config-store.js';
export * from './heartbeat-client.js';
export * from './command-poller.js';
export * from './runtime.js';
export * from './systemd.js';

import * as path from 'node:path';
import { NodeConfigStore } from './config-store.js';
import { CIGNodeRuntime } from './runtime.js';

function resolveRuntimePaths(): { configFile: string; identityFile: string; statusFile: string } {
  const configDir = process.env['CIG_NODE_CONFIG_DIR'] ?? '/etc/cig-node';
  const stateDir = process.env['CIG_NODE_STATE_DIR'] ?? '/var/lib/cig-node';

  return {
    configFile: path.join(configDir, 'config.json'),
    identityFile: path.join(stateDir, 'identity.json'),
    statusFile: path.join(stateDir, 'status.json'),
  };
}

async function main(): Promise<void> {
  const runtime = new CIGNodeRuntime({
    configStore: new NodeConfigStore(resolveRuntimePaths()),
  });

  await runtime.start();

  const shutdown = () => {
    runtime.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start cig-node:', error);
    process.exit(1);
  });
}
