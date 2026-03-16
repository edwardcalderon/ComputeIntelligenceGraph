#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const wizard_js_1 = require("./wizard.js");
const program = new commander_1.Command();
program
    .name('cig')
    .description('Compute Intelligence Graph CLI')
    .version('0.1.0');
function connectAws(roleArn) {
    console.log(`TODO: implement connectAws with role ${roleArn}`);
}
function connectGcp(serviceAccountPath) {
    console.log(`TODO: implement connectGcp with service account ${serviceAccountPath}`);
}
function deploy(target) {
    console.log(`TODO: implement deploy to ${target}`);
}
function startServices() {
    console.log('TODO: implement startServices');
}
function stopServices() {
    console.log('TODO: implement stopServices');
}
function getStatus() {
    console.log('TODO: implement getStatus');
}
function seedData(scenario) {
    console.log(`TODO: implement seedData with scenario ${scenario}`);
}
function reset() {
    console.log('TODO: implement reset');
}
// --- Commands ---
program
    .command('install')
    .description('Launch the CIG installation wizard')
    .action(() => {
    (0, wizard_js_1.runWizard)().catch((err) => {
        console.error('Error during install:', err);
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
        console.error('Error during reset:', err);
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=index.js.map