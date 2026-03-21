#!/usr/bin/env node
import { Command } from 'commander';
import { runWizard } from './wizard.js';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { doctor } from './commands/doctor.js';
import { install } from './commands/install.js';
import { bootstrapReset } from './commands/bootstrap-reset.js';

const program = new Command();

program
  .name('cig')
  .description('Compute Intelligence Graph CLI')
  .version('0.1.0');

function connectAws(roleArn: string): void {
  console.log(`TODO: implement connectAws with role ${roleArn}`);
}

function connectGcp(serviceAccountPath: string): void {
  console.log(`TODO: implement connectGcp with service account ${serviceAccountPath}`);
}

function deploy(target: string): void {
  console.log(`TODO: implement deploy to ${target}`);
}

function startServices(): void {
  console.log('TODO: implement startServices');
}

function stopServices(): void {
  console.log('TODO: implement stopServices');
}

function getStatus(): void {
  console.log('TODO: implement getStatus');
}

function seedData(scenario: string): void {
  console.log(`TODO: implement seedData with scenario ${scenario}`);
}

function reset(): void {
  console.log('TODO: implement reset');
}

// --- Commands ---

program
  .command('login')
  .description('Authenticate via device authorization flow')
  .option('--api-url <url>', 'API URL (default: http://localhost:8000)', 'http://localhost:8000')
  .action((opts) => {
    login(opts.apiUrl).catch((err) => {
      console.error('Error during login:', err);
      process.exit(1);
    });
  });

program
  .command('logout')
  .description('Clear stored credentials and logout')
  .option('--api-url <url>', 'API URL (default: http://localhost:8000)', 'http://localhost:8000')
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
  .description('Install CIG with optional mode and profile selection')
  .option('--mode <mode>', 'Installation mode: managed or self-hosted')
  .option('--profile <profile>', 'Installation profile: core or full')
  .option('--api-url <url>', 'API URL (default: http://localhost:8000)', 'http://localhost:8000')
  .action((opts) => {
    install(opts.apiUrl, opts.mode, opts.profile).catch((err) => {
      console.error('Error during install:', err);
      process.exit(1);
    });
  });

program
  .command('bootstrap-reset')
  .description('Generate and display a new bootstrap token (self-hosted mode)')
  .action(() => {
    bootstrapReset().catch((err) => {
      console.error('Error during bootstrap reset:', err);
      process.exit(1);
    });
  });

const connect = program
  .command('connect')
  .description('Connect CIG to a cloud provider');

connect
  .command('aws')
  .description('Connect to AWS using an IAM role ARN')
  .requiredOption('--role-arn <arn>', 'AWS IAM role ARN')
  .action((opts) => {
    try {
      console.log(`Connecting to AWS with role: ${opts.roleArn}`);
      connectAws(opts.roleArn);
    } catch (err) {
      console.error('Error connecting to AWS:', err);
      process.exit(1);
    }
  });

connect
  .command('gcp')
  .description('Connect to GCP using a service account key file')
  .requiredOption('--service-account <path>', 'Path to GCP service account JSON key file')
  .action((opts) => {
    try {
      console.log(`Connecting to GCP with service account: ${opts.serviceAccount}`);
      connectGcp(opts.serviceAccount);
    } catch (err) {
      console.error('Error connecting to GCP:', err);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Deploy CIG infrastructure to a target environment')
  .requiredOption('--target <target>', 'Deployment target: local, aws, or gcp', 'local')
  .action((opts) => {
    try {
      const validTargets = ['local', 'aws', 'gcp'];
      if (!validTargets.includes(opts.target)) {
        console.error(`Invalid target "${opts.target}". Must be one of: ${validTargets.join(', ')}`);
        process.exit(1);
      }
      console.log(`Deploying CIG to ${opts.target}...`);
      deploy(opts.target);
    } catch (err) {
      console.error('Error during deploy:', err);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start CIG services')
  .action(() => {
    try {
      console.log('Starting CIG services...');
      startServices();
    } catch (err) {
      console.error('Error starting services:', err);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop CIG services')
  .action(() => {
    try {
      console.log('Stopping CIG services...');
      stopServices();
    } catch (err) {
      console.error('Error stopping services:', err);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check CIG service status')
  .action(() => {
    try {
      console.log('Checking CIG status...');
      getStatus();
    } catch (err) {
      console.error('Error checking status:', err);
      process.exit(1);
    }
  });

program
  .command('seed')
  .description('Seed the graph with sample infrastructure data')
  .requiredOption('--scenario <scenario>', 'Seed scenario: small, medium, or large')
  .action((opts) => {
    try {
      const validScenarios = ['small', 'medium', 'large'];
      if (!validScenarios.includes(opts.scenario)) {
        console.error(`Invalid scenario "${opts.scenario}". Must be one of: ${validScenarios.join(', ')}`);
        process.exit(1);
      }
      console.log(`Seeding data with scenario: ${opts.scenario}`);
      seedData(opts.scenario);
    } catch (err) {
      console.error('Error during seed:', err);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset CIG to a clean state')
  .action(() => {
    try {
      console.log('Resetting CIG...');
      reset();
    } catch (err) {
      console.error('Error during reset:', err);
      process.exit(1);
    }
  });

program.parse();
