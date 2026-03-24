#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_js_1 = require("./env.js");
const commander_1 = require("commander");
const login_js_1 = require("./commands/login.js");
const logout_js_1 = require("./commands/logout.js");
const doctor_js_1 = require("./commands/doctor.js");
const install_js_1 = require("./commands/install.js");
const bootstrap_reset_js_1 = require("./commands/bootstrap-reset.js");
const connect_js_1 = require("./commands/connect.js");
const enroll_js_1 = require("./commands/enroll.js");
const permissions_js_1 = require("./commands/permissions.js");
const status_js_1 = require("./commands/status.js");
const open_js_1 = require("./commands/open.js");
const upgrade_js_1 = require("./commands/upgrade.js");
const uninstall_js_1 = require("./commands/uninstall.js");
const scan_js_1 = require("./commands/scan.js");
const version_js_1 = require("./version.js");
(0, env_js_1.loadCliEnv)();
const program = new commander_1.Command();
program.name('cig').description('Compute Intelligence Graph CLI').version(version_js_1.CLI_VERSION);
program
    .command('login')
    .description('Authenticate via device authorization flow')
    .option('--api-url <url>', 'API URL', 'http://localhost:8000')
    .action((opts) => {
    (0, login_js_1.login)(opts.apiUrl).catch((err) => {
        console.error('Error during login:', err);
        process.exit(1);
    });
});
program
    .command('logout')
    .description('Clear stored credentials and logout')
    .option('--api-url <url>', 'API URL', 'http://localhost:8000')
    .action((opts) => {
    (0, logout_js_1.logout)(opts.apiUrl).catch((err) => {
        console.error('Error during logout:', err);
        process.exit(1);
    });
});
program
    .command('doctor')
    .description('Run prerequisite checks and display system readiness')
    .action(() => {
    (0, doctor_js_1.doctor)().catch((err) => {
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
    (0, install_js_1.install)(opts.apiUrl, opts.mode, opts.profile).catch((err) => {
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
    (0, enroll_js_1.enroll)({
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
    (0, bootstrap_reset_js_1.bootstrapReset)().catch((err) => {
        console.error('Error during bootstrap reset:', err);
        process.exit(1);
    });
});
const connect = program.command('connect').description('Configure discovery and API connection profiles');
connect
    .command('aws')
    .description('Save the AWS AssumeRole ARN for discovery')
    .requiredOption('--role-arn <arn>', 'AWS IAM role ARN')
    .action((opts) => (0, connect_js_1.connectAws)(opts.roleArn));
connect
    .command('gcp')
    .description('Save the GCP service account JSON path for discovery')
    .requiredOption('--service-account <path>', 'Path to the GCP service account JSON file')
    .action((opts) => (0, connect_js_1.connectGcp)(opts.serviceAccount));
connect
    .command('api')
    .description('Save a direct API connection profile')
    .requiredOption('--url <url>', 'API base URL')
    .option('--auth-mode <mode>', 'managed, self-hosted, or none', 'none')
    .action((opts) => (0, connect_js_1.connectApi)(opts.url, opts.authMode));
program
    .command('permissions')
    .description('Display the CIG permission tier model')
    .action(() => {
    (0, permissions_js_1.permissions)().catch((err) => {
        console.error('Error during permissions command:', err);
        process.exit(1);
    });
});
program
    .command('status')
    .description('Show installation and connection status')
    .option('--json', 'Output status as JSON')
    .action((opts) => {
    (0, status_js_1.status)(Boolean(opts.json)).catch((err) => {
        console.error('Error during status command:', err);
        process.exit(1);
    });
});
program
    .command('open')
    .description('Print the dashboard URL for the active installation/profile')
    .action(() => {
    (0, open_js_1.openDashboard)().catch((err) => {
        console.error('Error during open command:', err);
        process.exit(1);
    });
});
program
    .command('upgrade')
    .description('Prepare the current installation for a bundle upgrade')
    .action(() => {
    (0, upgrade_js_1.upgrade)().catch((err) => {
        console.error('Error during upgrade:', err);
        process.exit(1);
    });
});
program
    .command('uninstall')
    .description('Remove installation metadata and optionally purge runtime files')
    .option('--purge-data', 'Delete the installation directory as well')
    .action((opts) => {
    (0, uninstall_js_1.uninstall)(Boolean(opts.purgeData)).catch((err) => {
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
    (0, scan_js_1.scan)({
        type: opts.type,
        provider: opts.provider,
        upload: Boolean(opts.upload),
        json: Boolean(opts.json),
        apiUrl: opts.apiUrl,
    }).catch((err) => {
        console.error('Error during scan:', err);
        process.exit(1);
    });
});
program.parse();
//# sourceMappingURL=index.js.map