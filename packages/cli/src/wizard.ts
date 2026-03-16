import { exec } from 'child_process';
import * as fs from 'fs';
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

export async function runWizard(): Promise<void> {
  // Dynamic import for ESM inquirer
  const inquirer = await import('inquirer');
  const prompt = inquirer.default.createPromptModule();

  // Step 1: Detect OS
  const os = detectOS();
  console.log(`Detected OS: ${os}`);

  // Step 2: Check Docker
  const dockerInstalled = await checkDockerInstalled();
  if (!dockerInstalled) {
    console.error('Docker is not installed or not running. Please install Docker and try again.');
    process.exit(1);
  }

  let config: WizardConfig = { target: 'local', dashboardPort: 3000 };

  try {
    // Step 3: Deployment target
    const { target } = await prompt([
      {
        type: 'list',
        name: 'target',
        message: 'Select deployment target:',
        choices: [
          { name: 'Local', value: 'local' },
          { name: 'AWS', value: 'aws' },
          { name: 'GCP', value: 'gcp' },
          { name: 'Hybrid (AWS + GCP)', value: 'hybrid' },
        ],
      },
    ]) as { target: WizardConfig['target'] };
    config.target = target;

    const credManager = new CredentialManager();

    // Step 4: AWS credentials
    if (target === 'aws' || target === 'hybrid') {
      const { awsRoleArn } = await prompt([
        {
          type: 'input',
          name: 'awsRoleArn',
          message: 'Enter AWS IAM Role ARN:',
          validate: (val: string) =>
            validateAwsRoleArn(val) || 'Invalid ARN format. Expected: arn:aws:iam::<account>:role/<name>',
        },
      ]) as { awsRoleArn: string };
      config.awsRoleArn = awsRoleArn;
      credManager.save('aws', awsRoleArn);
    }

    // Step 5: GCP credentials
    if (target === 'gcp' || target === 'hybrid') {
      const { gcpServiceAccount } = await prompt([
        {
          type: 'input',
          name: 'gcpServiceAccount',
          message: 'Enter path to GCP service account JSON file:',
          validate: (val: string) =>
            validateGcpServiceAccount(val) || 'File not found or not a .json file.',
        },
      ]) as { gcpServiceAccount: string };
      config.gcpServiceAccount = gcpServiceAccount;
      credManager.save('gcp', gcpServiceAccount);
    }

    // Step 6: Dashboard port
    const { dashboardPort } = await prompt([
      {
        type: 'number',
        name: 'dashboardPort',
        message: 'Dashboard port:',
        default: 3000,
      },
    ]) as { dashboardPort: number };
    config.dashboardPort = dashboardPort ?? 3000;

    // Step 7: Provision
    console.log('Provisioning CIG infrastructure...');
    await provision(config);

    // Step 8: Success
    console.log(`CIG installed successfully! Dashboard: http://localhost:${config.dashboardPort}`);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    console.log('Rolling back...');
    await rollback();
  }
}
