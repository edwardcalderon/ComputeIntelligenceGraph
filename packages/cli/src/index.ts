#!/usr/bin/env node
import { loadCliEnv } from './env.js';
import { Command } from 'commander';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { doctor } from './commands/doctor.js';
import { install } from './commands/install.js';
import { bootstrapReset } from './commands/bootstrap-reset.js';
import { connectApi, connectAws, connectGcp } from './commands/connect.js';
import { enroll } from './commands/enroll.js';
import { permissions } from './commands/permissions.js';
import { status } from './commands/status.js';
import { openDashboard } from './commands/open.js';
import { upgrade } from './commands/upgrade.js';
import { uninstall } from './commands/uninstall.js';
import { scan } from './commands/scan.js';
import { CLI_VERSION } from './version.js';

loadCliEnv();

const program = new Command();

program.name('cig').description('Compute Intelligence Graph CLI').version(CLI_VERSION);

program
  .command('login')
  .description('Authenticate via device authorization flow')
  .option('--api-url <url>', 'API URL', 'http://localhost:8000')
  .action((opts) => {
    login(opts.apiUrl).catch((err) => {
      console.error('Error during login:', err);
      process.exit(1);
    });
  });

program
  .command('logout')
  .description('Clear stored credentials and logout')
  .option('--api-url <url>', 'API URL', 'http://localhost:8000')
  .action((opts) => {
    logout(opts.apiUrl).catch((err) => {
      console.error('Error during logout:', err);
      process.exit(1);
    });
  });

program
  .command('doctor')
  .description('Run prerequisite checks and display system readiness')
  .action(() => {
    doctor().catch((err) => {
      console.error('Error during doctor check:', err);
      process.exit(1);
    });
  });

program
  .command('install')
  .description('Install CIG in managed or self-hosted mode')
  .option('--mode <mode>', 'Installation mode: managed or self-hosted')
  .option('--profile <profile>', 'Installation profile: core or full')
  .option('--api-url <url>', 'API URL', 'http://localhost:8000')
  .action((opts) => {
    install(opts.apiUrl, opts.mode, opts.profile).catch((err) => {
      console.error('Error during install:', err);
      process.exit(1);
    });
  });

program
  .command('enroll')
  .description('Enroll a node against the current control plane')
  .option('--api-url <url>', 'API URL', 'http://localhost:8000')
  .option('--profile <profile>', 'Install profile: core or full', 'core')
  .option('--token <token>', 'Pre-issued enrollment token')
  .action((opts) => {
    enroll({
      apiUrl: opts.apiUrl,
      profile: opts.profile,
      token: opts.token,
    }).catch((err) => {
      console.error('Error during enrollment:', err);
      process.exit(1);
    });
  });

program
  .command('bootstrap-reset')
  .description('Generate and display a new bootstrap token for self-hosted mode')
  .action(() => {
    bootstrapReset().catch((err) => {
      console.error('Error during bootstrap reset:', err);
      process.exit(1);
    });
  });

const connect = program.command('connect').description('Configure discovery and API connection profiles');

connect
  .command('aws')
  .description('Save the AWS AssumeRole ARN for discovery')
  .requiredOption('--role-arn <arn>', 'AWS IAM role ARN')
  .action((opts) => connectAws(opts.roleArn));

connect
  .command('gcp')
  .description('Save the GCP service account JSON path for discovery')
  .requiredOption('--service-account <path>', 'Path to the GCP service account JSON file')
  .action((opts) => connectGcp(opts.serviceAccount));

connect
  .command('api')
  .description('Save a direct API connection profile')
  .requiredOption('--url <url>', 'API base URL')
  .option('--auth-mode <mode>', 'managed, self-hosted, or none', 'none')
  .action((opts) => connectApi(opts.url, opts.authMode));

program
  .command('permissions')
  .description('Display the CIG permission tier model')
  .action(() => {
    permissions().catch((err) => {
      console.error('Error during permissions command:', err);
      process.exit(1);
    });
  });

program
  .command('status')
  .description('Show installation and connection status')
  .option('--json', 'Output status as JSON')
  .action((opts) => {
    status(Boolean(opts.json)).catch((err) => {
      console.error('Error during status command:', err);
      process.exit(1);
    });
  });

program
  .command('open')
  .description('Print the dashboard URL for the active installation/profile')
  .action(() => {
    openDashboard().catch((err) => {
      console.error('Error during open command:', err);
      process.exit(1);
    });
  });

program
  .command('upgrade')
  .description('Prepare the current installation for a bundle upgrade')
  .action(() => {
    upgrade().catch((err) => {
      console.error('Error during upgrade:', err);
      process.exit(1);
    });
  });

program
  .command('uninstall')
  .description('Remove installation metadata and optionally purge runtime files')
  .option('--purge-data', 'Delete the installation directory as well')
  .action((opts) => {
    uninstall(Boolean(opts.purgeData)).catch((err) => {
      console.error('Error during uninstall:', err);
      process.exit(1);
    });
  });

program
  .command('scan')
  .description('Discover and map local/cloud infrastructure')
  .option('--type <type>', 'Scan type: local, cloud, or all', 'local')
  .option('--provider <provider>', 'Cloud provider: aws, gcp, k8s')
  .option('--upload', 'Upload results to the API', false)
  .option('--json', 'Output results as JSON', false)
  .option('--api-url <url>', 'API URL', 'http://localhost:8000')
  .action((opts) => {
    scan({
      type: opts.type as 'local' | 'cloud' | 'all',
      provider: opts.provider as 'aws' | 'gcp' | 'k8s' | undefined,
      upload: Boolean(opts.upload),
      json: Boolean(opts.json),
      apiUrl: opts.apiUrl,
    }).catch((err) => {
      console.error('Error during scan:', err);
      process.exit(1);
    });
  });

program.parse();
