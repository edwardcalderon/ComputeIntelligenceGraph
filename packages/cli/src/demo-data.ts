import { confirm, isCancel } from '@clack/prompts';

export interface DemoDataPreferenceOptions {
  explicitDemo?: boolean;
  defaultValue?: boolean;
  message?: string;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function resolveDemoDataPreference(
  options: DemoDataPreferenceOptions = {},
): Promise<boolean> {
  const {
    explicitDemo,
    defaultValue = false,
    message = 'Include demo data in this installation?',
  } = options;

  if (typeof explicitDemo === 'boolean') {
    return explicitDemo;
  }

  if (!isInteractiveTerminal()) {
    return defaultValue;
  }

  const result = await confirm({
    message,
    initialValue: defaultValue,
  });

  if (isCancel(result)) {
    throw new Error('Installation was cancelled.');
  }

  return Boolean(result);
}
