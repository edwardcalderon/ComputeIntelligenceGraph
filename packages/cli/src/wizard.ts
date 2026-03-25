import { cancel, intro, isCancel, outro, select, spinner, text } from '@clack/prompts';
import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import { CredentialManager } from './credentials.js';

export interface WizardConfig {
  target: 'local' | 'aws' | 'gcp' | 'hybrid';
  awsRoleArn?: string;
  gcpServiceAccount?: string;
  dashboardPort: number;
}

export function detectOS(): 'linux' | 'macos' | 'windows' {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
}

export function checkDockerInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('docker --version', (error) => {
      resolve(error === null);
    });
  });
}

export function validateAwsRoleArn(arn: string): boolean {
  return /^arn:aws:iam::\d*:role\/.+$/.test(arn);
}

export function validateGcpServiceAccount(filePath: string): boolean {
  return filePath.endsWith('.json') && fs.existsSync(filePath);
}

export async function provision(config: WizardConfig): Promise<void> {
  console.log('TODO: implement provisioning', config.target);
}

export async function rollback(): Promise<void> {
  console.log('TODO: implement rollback');
}

function promptCancelled(message: string): never {
  cancel(message);
  throw new Error(message);
}

export async function runWizard(): Promise<void> {
  intro('CIG setup wizard');

  const os = detectOS();
  console.log(`Detected OS: ${os}`);

  const dockerInstalled = await checkDockerInstalled();
  if (!dockerInstalled) {
    promptCancelled('Docker is not installed or not running. Please install Docker and try again.');
  }

  const targetResult = await select({
    message: 'Select deployment target:',
    options: [
      { value: 'local', label: 'Local' },
      { value: 'aws', label: 'AWS' },
      { value: 'gcp', label: 'GCP' },
      { value: 'hybrid', label: 'Hybrid (AWS + GCP)' },
    ],
  });

  if (isCancel(targetResult)) {
    promptCancelled('Setup was cancelled.');
  }

  let config: WizardConfig = {
    target: targetResult as WizardConfig['target'],
    dashboardPort: 3000,
  };

  const credManager = new CredentialManager();

  if (config.target === 'aws' || config.target === 'hybrid') {
    const awsResult = await text({
      message: 'Enter AWS IAM Role ARN:',
      placeholder: 'arn:aws:iam::123456789012:role/CIGRole',
    });

    if (isCancel(awsResult)) {
      promptCancelled('Setup was cancelled.');
    }

    const awsRoleArn = String(awsResult).trim();
    if (!validateAwsRoleArn(awsRoleArn)) {
      promptCancelled('Invalid ARN format. Expected: arn:aws:iam::<account>:role/<name>');
    }

    config.awsRoleArn = awsRoleArn;
    credManager.save('aws', awsRoleArn);
  }

  if (config.target === 'gcp' || config.target === 'hybrid') {
    const gcpResult = await text({
      message: 'Enter path to GCP service account JSON file:',
      placeholder: '/path/to/service-account.json',
    });

    if (isCancel(gcpResult)) {
      promptCancelled('Setup was cancelled.');
    }

    const gcpServiceAccount = String(gcpResult).trim();
    if (!validateGcpServiceAccount(gcpServiceAccount)) {
      promptCancelled('File not found or not a .json file.');
    }

    config.gcpServiceAccount = gcpServiceAccount;
    credManager.save('gcp', gcpServiceAccount);
  }

  const portResult = await text({
    message: 'Dashboard port:',
    placeholder: '3000',
    defaultValue: '3000',
  });

  if (isCancel(portResult)) {
    promptCancelled('Setup was cancelled.');
  }

  config.dashboardPort = Number.parseInt(String(portResult), 10) || 3000;

  const progress = spinner();
  progress.start('Provisioning CIG infrastructure...');
  try {
    await provision(config);
    progress.stop('Provisioning step completed.');
    outro(`CIG installed successfully! Dashboard: http://localhost:${config.dashboardPort}`);
  } catch (error) {
    progress.stop('Provisioning failed.');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.log('Rolling back...');
    await rollback();
    promptCancelled('The setup wizard did not complete.');
  }
}
