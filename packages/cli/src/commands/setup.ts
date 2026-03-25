import * as readline from 'node:readline';
import { install } from './install.js';

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

  return new Promise((resolve) => {
    console.log(`\n${question}`);
    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option}`);
    });

    rl.question(`Enter your choice (1-${options.length}): `, (answer) => {
      rl.close();
      const selectedIndex = Number.parseInt(answer, 10) - 1;
      if (selectedIndex < 0 || selectedIndex >= options.length) {
        console.error('Invalid selection');
        process.exit(1);
      }

      resolve(options[selectedIndex]);
    });
  });
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

export async function setup(options: SetupCommandOptions = {}): Promise<void> {
  let mode = options.mode;
  let profile = options.profile;
  let apiUrl = options.apiUrl;

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

  await install(apiUrl, mode, profile);
}
