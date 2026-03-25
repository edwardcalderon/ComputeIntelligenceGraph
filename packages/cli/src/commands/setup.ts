import * as readline from 'node:readline';
import { install } from './install.js';
import { CLI_VERSION } from '../version.js';

export interface SetupCommandOptions {
  mode?: 'managed' | 'self-hosted';
  profile?: 'core' | 'full';
  apiUrl?: string;
}

async function promptChoice(question: string, options: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      console.log(`\n${question}`);
      options.forEach((option, index) => {
        console.log(`  ${index + 1}. ${option}`);
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(`Enter your choice (1-${options.length}): `, resolve);
      });

      const selectedIndex = Number.parseInt(answer, 10) - 1;
      if (selectedIndex >= 0 && selectedIndex < options.length) {
        return options[selectedIndex]!;
      }

      console.error(`Invalid selection. Choose a number from 1 to ${options.length}.`);
    }
  } finally {
    rl.close();
  }
}

async function promptInput(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `, (answer) => {
      rl.close();
      resolve((answer.trim() || defaultValue || '').trim());
    });
  });
}

async function waitForEnter(message: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n${message}`, () => {
      rl.close();
      resolve();
    });
  });
}

export async function setup(options: SetupCommandOptions = {}): Promise<void> {
  let mode = options.mode;
  let profile = options.profile;
  let apiUrl = options.apiUrl;

  console.log(`\n=== CIG Setup Wizard (v${CLI_VERSION}) ===`);
  console.log('A guided installation flow for local and managed CIG setups.');

  if (!mode) {
    mode = (await promptChoice('Select installation mode:', ['self-hosted', 'managed'])) as
      | 'managed'
      | 'self-hosted';
  }

  if (!profile) {
    profile = (await promptChoice('Select installation profile:', ['core', 'full'])) as
      | 'core'
      | 'full';
  }

  if (mode === 'managed' && !apiUrl) {
    apiUrl = await promptInput('Enter the control plane API URL', 'https://api.cig.technology');
  }

  try {
    await install(apiUrl, mode, profile);
    console.log('\n✓ Setup completed successfully.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\n✗ Setup did not complete.');
    console.error(message);
    if (process.stdin.isTTY && process.stdout.isTTY) {
      await waitForEnter('Press Enter to exit the wizard...');
    }
    process.exit(1);
  }
}
