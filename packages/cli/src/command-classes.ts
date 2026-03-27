import { Command, Flags } from '@oclif/core';
import { bootstrapReset } from './commands/bootstrap-reset.js';
import { connectApi, connectAws, connectGcp } from './commands/connect.js';
import { doctor } from './commands/doctor.js';
import { enroll } from './commands/enroll.js';
import { install } from './commands/install.js';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { openDashboard } from './commands/open.js';
import { permissions } from './commands/permissions.js';
import { scan } from './commands/scan.js';
import { setup } from './commands/setup.js';
import { status } from './commands/status.js';
import { uninstall } from './commands/uninstall.js';
import { upgrade } from './commands/upgrade.js';

export type OclifCommandClass = typeof Command;

abstract class CigCommand extends Command {
  protected async runSafely(task: () => Promise<void> | void): Promise<void> {
    try {
      await Promise.resolve(task());
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}

export class LoginCommand extends CigCommand {
  static override description = 'Authenticate via device authorization flow';
  static override flags = {
    'api-url': Flags.string({ description: 'API URL', default: 'http://localhost:3003' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LoginCommand);
    await this.runSafely(() => login(flags['api-url']));
  }
}

export class LogoutCommand extends CigCommand {
  static override description = 'Clear stored credentials and logout';
  static override flags = {
    'api-url': Flags.string({ description: 'API URL', default: 'http://localhost:3003' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LogoutCommand);
    await this.runSafely(() => logout(flags['api-url']));
  }
}

export class DoctorCommand extends CigCommand {
  static override description = 'Run prerequisite checks and display system readiness';

  async run(): Promise<void> {
    await this.runSafely(() => doctor());
  }
}

export class SetupCommand extends CigCommand {
  static override description = 'Run the guided onboarding wizard and install CIG';
  static override flags = {
    mode: Flags.string({
      description: 'Installation mode: managed or self-hosted',
      options: ['managed', 'self-hosted'] as const,
    }),
    profile: Flags.string({
      description: 'Installation profile: discovery or full (core is accepted as a legacy alias)',
      options: ['core', 'discovery', 'full'] as const,
    }),
    'api-url': Flags.string({ description: 'API URL' }),
    demo: Flags.boolean({ description: 'Include demo/mock data in the installation' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SetupCommand);
    const demo = this.argv.includes('--demo') ? Boolean(flags.demo) : undefined;
    await this.runSafely(() =>
      setup({
        mode: flags.mode as 'managed' | 'self-hosted' | undefined,
        profile: flags.profile as 'core' | 'discovery' | 'full' | undefined,
        apiUrl: flags['api-url'],
        demo,
      })
    );
  }
}

export class InstallCommand extends CigCommand {
  static override description = 'Install CIG in managed or self-hosted mode';
  static override flags = {
    mode: Flags.string({
      description: 'Installation mode: managed or self-hosted',
      options: ['managed', 'self-hosted'] as const,
    }),
    profile: Flags.string({
      description: 'Installation profile: discovery or full (core is accepted as a legacy alias)',
      options: ['core', 'discovery', 'full'] as const,
    }),
    'api-url': Flags.string({ description: 'API URL', default: 'http://localhost:3003' }),
    demo: Flags.boolean({ description: 'Include demo/mock data in the installation' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InstallCommand);
    const demo = this.argv.includes('--demo') ? Boolean(flags.demo) : undefined;
    await this.runSafely(() =>
        install(
          flags['api-url'],
          flags.mode as 'managed' | 'self-hosted' | undefined,
          flags.profile as 'core' | 'discovery' | 'full' | undefined,
          demo
        )
      );
  }
}

export class EnrollCommand extends CigCommand {
  static override description = 'Enroll a node against the current control plane';
  static override flags = {
    'api-url': Flags.string({ description: 'API URL', default: 'http://localhost:3003' }),
    profile: Flags.string({
      description: 'Install profile: discovery or full (core is accepted as a legacy alias)',
      options: ['core', 'discovery', 'full'] as const,
      default: 'discovery',
    }),
    token: Flags.string({ description: 'Pre-issued enrollment token' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EnrollCommand);
    await this.runSafely(() =>
      enroll({
        apiUrl: flags['api-url'],
        profile: flags.profile as 'core' | 'discovery' | 'full' | undefined,
        token: flags.token,
      })
    );
  }
}

export class BootstrapResetCommand extends CigCommand {
  static override description = 'Generate and display a new bootstrap token for self-hosted mode';

  async run(): Promise<void> {
    await this.runSafely(() => bootstrapReset());
  }
}

export class ConnectCommand extends CigCommand {
  static override description = 'Configure discovery and API connection profiles';

  async run(): Promise<void> {
    this.log('Connect subcommands:');
    this.log('  cig connect aws --role-arn <arn>');
    this.log('  cig connect gcp --service-account <path>');
    this.log('  cig connect api --url <url> [--auth-mode managed|self-hosted|none]');
  }
}

export class ConnectAwsCommand extends CigCommand {
  static override description = 'Save the AWS AssumeRole ARN for discovery';
  static override flags = {
    'role-arn': Flags.string({ description: 'AWS IAM role ARN', required: true }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConnectAwsCommand);
    await this.runSafely(() => connectAws(flags['role-arn']));
  }
}

export class ConnectGcpCommand extends CigCommand {
  static override description = 'Save the GCP service account JSON path for discovery';
  static override flags = {
    'service-account': Flags.string({
      description: 'Path to the GCP service account JSON file',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConnectGcpCommand);
    await this.runSafely(() => connectGcp(flags['service-account']));
  }
}

export class ConnectApiCommand extends CigCommand {
  static override description = 'Save a direct API connection profile';
  static override flags = {
    url: Flags.string({ description: 'API base URL', required: true }),
    'auth-mode': Flags.string({
      description: 'managed, self-hosted, or none',
      options: ['managed', 'self-hosted', 'none'] as const,
      default: 'none',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConnectApiCommand);
    await this.runSafely(() => connectApi(flags.url, flags['auth-mode'] as 'managed' | 'self-hosted' | 'none'));
  }
}

export class PermissionsCommand extends CigCommand {
  static override description = 'Display the CIG permission tier model';

  async run(): Promise<void> {
    await this.runSafely(() => permissions());
  }
}

export class StatusCommand extends CigCommand {
  static override description = 'Show installation and connection status';
  static override flags = {
    json: Flags.boolean({ description: 'Output status as JSON', default: false }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StatusCommand);
    await this.runSafely(() => status(Boolean(flags.json)));
  }
}

export class OpenCommand extends CigCommand {
  static override description = 'Print the dashboard URL for the active installation/profile';

  async run(): Promise<void> {
    await this.runSafely(() => openDashboard());
  }
}

export class UpgradeCommand extends CigCommand {
  static override description = 'Prepare the current installation for a bundle upgrade';

  async run(): Promise<void> {
    await this.runSafely(() => upgrade());
  }
}

export class UninstallCommand extends CigCommand {
  static override description = 'Remove installation metadata and optionally purge runtime files';
  static override flags = {
    'purge-data': Flags.boolean({ description: 'Delete the installation directory as well', default: false }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(UninstallCommand);
    await this.runSafely(() => uninstall(Boolean(flags['purge-data'])));
  }
}

export class ScanCommand extends CigCommand {
  static override description = 'Discover and map local/cloud infrastructure';
  static override flags = {
    type: Flags.string({
      description: 'Scan type: local, cloud, or all',
      options: ['local', 'cloud', 'all'] as const,
      default: 'local',
    }),
    provider: Flags.string({
      description: 'Cloud provider: aws, gcp, k8s',
      options: ['aws', 'gcp', 'k8s'] as const,
    }),
    upload: Flags.boolean({ description: 'Upload results to the API', default: false }),
    json: Flags.boolean({ description: 'Output results as JSON', default: false }),
    'api-url': Flags.string({ description: 'API URL', default: 'http://localhost:3003' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ScanCommand);
    await this.runSafely(() =>
      scan({
        type: flags.type as 'local' | 'cloud' | 'all',
        provider: flags.provider as 'aws' | 'gcp' | 'k8s' | undefined,
        upload: Boolean(flags.upload),
        json: Boolean(flags.json),
        apiUrl: flags['api-url'],
      })
    );
  }
}

export const COMMAND_REGISTRY: Record<string, { command: OclifCommandClass; description: string }> = {
  login: { command: LoginCommand, description: LoginCommand.description ?? '' },
  logout: { command: LogoutCommand, description: LogoutCommand.description ?? '' },
  doctor: { command: DoctorCommand, description: DoctorCommand.description ?? '' },
  setup: { command: SetupCommand, description: SetupCommand.description ?? '' },
  install: { command: InstallCommand, description: InstallCommand.description ?? '' },
  enroll: { command: EnrollCommand, description: EnrollCommand.description ?? '' },
  'bootstrap-reset': {
    command: BootstrapResetCommand,
    description: BootstrapResetCommand.description ?? '',
  },
  connect: { command: ConnectCommand, description: ConnectCommand.description ?? '' },
  'connect aws': { command: ConnectAwsCommand, description: ConnectAwsCommand.description ?? '' },
  'connect gcp': { command: ConnectGcpCommand, description: ConnectGcpCommand.description ?? '' },
  'connect api': { command: ConnectApiCommand, description: ConnectApiCommand.description ?? '' },
  permissions: { command: PermissionsCommand, description: PermissionsCommand.description ?? '' },
  status: { command: StatusCommand, description: StatusCommand.description ?? '' },
  open: { command: OpenCommand, description: OpenCommand.description ?? '' },
  upgrade: { command: UpgradeCommand, description: UpgradeCommand.description ?? '' },
  uninstall: { command: UninstallCommand, description: UninstallCommand.description ?? '' },
  scan: { command: ScanCommand, description: ScanCommand.description ?? '' },
};

export const CONNECT_SUBCOMMANDS = ['aws', 'gcp', 'api'] as const;
