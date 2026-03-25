import { CLI_VERSION } from './version.js';
import { CONNECT_SUBCOMMANDS, COMMAND_REGISTRY } from './command-classes.js';

export interface CliCommandEntry {
  command: { run: (argv: string[]) => Promise<unknown> };
  description: string;
}

export type CliCommandRegistry = Record<string, CliCommandEntry>;

interface ParsedInvocation {
  commandPath?: string;
  args: string[];
  showHelp: boolean;
  showVersion: boolean;
}

function formatRootHelp(): string {
  const lines = [
    `CIG CLI v${CLI_VERSION}`,
    '',
    'Usage:',
    '  cig <command> [options]',
    '',
    'Commands:',
    '  login            Authenticate via device authorization flow',
    '  logout           Clear stored credentials and logout',
    '  doctor           Run prerequisite checks and display system readiness',
    '  setup            Run the guided onboarding wizard and install CIG',
    '  install          Install CIG in managed or self-hosted mode',
    '  enroll           Enroll a node against the current control plane',
    '  bootstrap-reset  Generate and display a new bootstrap token',
    '  connect          Configure discovery and API connection profiles',
    '    aws            Save the AWS AssumeRole ARN for discovery',
    '    gcp            Save the GCP service account JSON path for discovery',
    '    api            Save a direct API connection profile',
    '  permissions      Display the CIG permission tier model',
    '  status           Show installation and connection status',
    '  open             Print the dashboard URL for the active installation/profile',
    '  upgrade          Prepare the current installation for a bundle upgrade',
    '  uninstall        Remove installation metadata and optionally purge runtime files',
    '  scan             Discover and map local/cloud infrastructure',
    '',
    'Run `cig <command> --help` for command-specific options.',
  ];

  return lines.join('\n');
}

function parseInvocation(argv: string[]): ParsedInvocation {
  const args = argv.filter((value) => value.length > 0);

  if (args.length === 0) {
    return { showHelp: true, showVersion: false, args: [] };
  }

  if (args[0] === '--version' || args[0] === '-v') {
    return { showHelp: false, showVersion: true, args: [] };
  }

  if (args[0] === '--help' || args[0] === '-h') {
    return { showHelp: true, showVersion: false, args: [] };
  }

  if (args[0] === 'help') {
    if (args[1] === 'connect' && args[2] && CONNECT_SUBCOMMANDS.includes(args[2] as (typeof CONNECT_SUBCOMMANDS)[number])) {
      return {
        commandPath: `connect ${args[2]}`,
        args: ['--help'],
        showHelp: false,
        showVersion: false,
      };
    }

    if (args[1] === 'connect') {
      return {
        commandPath: 'connect',
        args: ['--help'],
        showHelp: false,
        showVersion: false,
      };
    }

    if (args[1]) {
      return {
        commandPath: args[1],
        args: ['--help'],
        showHelp: false,
        showVersion: false,
      };
    }

    return { showHelp: true, showVersion: false, args: [] };
  }

  if (args[0] === 'connect') {
    if (
      args[1] &&
      !args[1].startsWith('-') &&
      CONNECT_SUBCOMMANDS.includes(args[1] as (typeof CONNECT_SUBCOMMANDS)[number])
    ) {
      return {
        commandPath: `connect ${args[1]}`,
        args: args.slice(2),
        showHelp: false,
        showVersion: false,
      };
    }

    return {
      commandPath: 'connect',
      args: args.slice(1),
      showHelp: false,
      showVersion: false,
    };
  }

  return {
    commandPath: args[0],
    args: args.slice(1),
    showHelp: false,
    showVersion: false,
  };
}

export async function runCli(
  argv: string[],
  registry: CliCommandRegistry = COMMAND_REGISTRY
): Promise<void> {
  const invocation = parseInvocation(argv);

  if (invocation.showVersion) {
    console.log(CLI_VERSION);
    return;
  }

  if (invocation.showHelp || !invocation.commandPath) {
    console.log(formatRootHelp());
    return;
  }

  const entry = registry[invocation.commandPath];
  if (!entry) {
    console.error(`Unknown command: ${invocation.commandPath}`);
    console.log();
    console.log(formatRootHelp());
    process.exitCode = 1;
    return;
  }

  await entry.command.run(invocation.args);
}

export { formatRootHelp, parseInvocation };
