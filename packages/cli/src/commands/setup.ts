import { cancel, intro, isCancel, outro, select, text } from '@clack/prompts';
import { install } from './install.js';
import { CLI_VERSION } from '../version.js';

export interface SetupCommandOptions {
  mode?: 'managed' | 'self-hosted';
  profile?: 'core' | 'full';
  apiUrl?: string;
}

function promptCancelled(message: string): never {
  cancel(message);
  throw new Error(message);
}

async function pauseBeforeExit(message = 'Press Enter to return to your shell.'): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  const result = await text({
    message,
    placeholder: 'Press Enter to continue',
    defaultValue: '',
  });

  if (isCancel(result)) {
    return;
  }
}

function formatChoiceLabel(value: string): string {
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

async function promptChoice(question: string, options: string[]): Promise<string> {
  const result = await select({
    message: question,
    options: options.map((option) => ({
      value: option,
      label: formatChoiceLabel(option),
    })),
  });

  if (isCancel(result)) {
    promptCancelled('Setup was cancelled.');
  }

  return String(result);
}

async function promptInput(question: string, defaultValue?: string): Promise<string> {
  const result = await text({
    message: question,
    placeholder: defaultValue,
    defaultValue,
  });

  if (isCancel(result)) {
    promptCancelled('Setup was cancelled.');
  }

  return String(result).trim() || (defaultValue ?? '');
}

export async function setup(options: SetupCommandOptions = {}): Promise<void> {
  let mode = options.mode;
  let profile = options.profile;
  let apiUrl = options.apiUrl;
  let wasCancelled = false;

  try {
    intro(`CIG Setup Wizard v${CLI_VERSION}`);
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

    await install(apiUrl, mode, profile);
    outro('Setup completed successfully.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== 'Setup was cancelled.' && message !== 'Installation was cancelled.') {
      console.error(`Setup did not complete: ${message}`);
    } else {
      wasCancelled = true;
      return;
    }
    throw error instanceof Error ? error : new Error(message);
  } finally {
    if (!wasCancelled) {
      await pauseBeforeExit();
    }
  }
}
