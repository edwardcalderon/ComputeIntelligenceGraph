export interface SystemdUnitOptions {
  user?: string;
  execStart: string;
  workingDirectory: string;
  description?: string;
}

export function renderSystemdUnit(options: SystemdUnitOptions): string {
  const description = options.description ?? 'CIG Node Runtime';
  const user = options.user ?? 'cig';

  return `[Unit]
Description=${description}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${options.workingDirectory}
ExecStart=${options.execStart}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;
}
