/**
 * SSH target support for CIG CLI
 *
 * Provides functions to connect to a remote host via SSH, upload files via
 * SFTP, run remote commands, and perform a full CIG Node installation over SSH.
 *
 * Requirements: 5.4, 5.5
 */

import fs from 'node:fs';
import { Client, type ConnectConfig, type SFTPWrapper } from 'ssh2';
import { password as promptPassword } from '@clack/prompts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SSHTarget {
  host: string;
  user: string;
  keyPath?: string;
  password?: string;
  port: number; // default 22
}

export interface RemoteCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// connectSSH
// ---------------------------------------------------------------------------

/**
 * Establish an SSH connection to the given target.
 *
 * Auth priority:
 *   1. Key-based auth when `keyPath` is provided.
 *   2. Password auth when `password` is provided.
 *   3. Prompt the operator for a password via @clack/prompts when neither is set.
 *
 * Returns the connected `Client` instance.
 */
export async function connectSSH(target: SSHTarget): Promise<Client> {
  const config: ConnectConfig = {
    host: target.host,
    port: target.port,
    username: target.user,
  };

  if (target.keyPath) {
    // Key-based authentication (Requirement 5.5)
    config.privateKey = fs.readFileSync(target.keyPath);
  } else {
    // Password authentication — prompt if not supplied (Requirement 5.5)
    let pwd = target.password;
    if (!pwd) {
      const result = await promptPassword({
        message: `SSH password for ${target.user}@${target.host}:`,
      });
      if (typeof result !== 'string' || result.length === 0) {
        throw new Error('SSH password is required but was not provided.');
      }
      pwd = result;
    }
    config.password = pwd;
  }

  return new Promise<Client>((resolve, reject) => {
    const client = new Client();

    client.on('ready', () => resolve(client));
    client.on('error', (err) => reject(err));

    client.connect(config);
  });
}

// ---------------------------------------------------------------------------
// uploadFiles
// ---------------------------------------------------------------------------

/**
 * Upload one or more local files to the remote host via SFTP.
 */
export async function uploadFiles(
  client: Client,
  files: Array<{ localPath: string; remotePath: string }>,
): Promise<void> {
  const sftp = await getSftp(client);

  for (const { localPath, remotePath } of files) {
    await uploadFile(sftp, localPath, remotePath);
  }

  sftp.end();
}

function getSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

function uploadFile(sftp: SFTPWrapper, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const localContent = fs.readFileSync(localPath);
    const writeStream = sftp.createWriteStream(remotePath);

    writeStream.on('close', resolve);
    writeStream.on('error', reject);

    writeStream.end(localContent);
  });
}

// ---------------------------------------------------------------------------
// runRemoteCommand
// ---------------------------------------------------------------------------

/**
 * Execute a shell command on the remote host and return stdout, stderr, and
 * the exit code.
 */
export async function runRemoteCommand(
  client: Client,
  command: string,
): Promise<RemoteCommandResult> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      stream.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      stream.on('close', (code: number | null) => {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });

      stream.on('error', reject);
    });
  });
}

// ---------------------------------------------------------------------------
// installViaSSH
// ---------------------------------------------------------------------------

/**
 * High-level function that:
 *   1. Connects to the remote host via SSH.
 *   2. Creates the install directory.
 *   3. Uploads the compose file and env file.
 *   4. Runs `docker compose up -d` in the install directory.
 *   5. Closes the connection.
 *
 * Requirements: 5.4, 5.5
 */
export async function installViaSSH(
  target: SSHTarget,
  composeFilePath: string,
  envFilePath: string,
  installDir: string,
  postStartCommands: string[] = [],
): Promise<void> {
  const client = await connectSSH(target);
  const postStartRetryLimit = 20;
  const postStartRetryDelayMs = 5_000;

  try {
    // Create install directory on remote host
    const mkdirResult = await runRemoteCommand(client, `mkdir -p ${installDir}`);
    if (mkdirResult.exitCode !== 0) {
      throw new Error(
        `Failed to create install directory "${installDir}" on ${target.host}: ${mkdirResult.stderr}`,
      );
    }

    // Upload compose and env files
    await uploadFiles(client, [
      { localPath: composeFilePath, remotePath: `${installDir}/docker-compose.yml` },
      { localPath: envFilePath, remotePath: `${installDir}/.env` },
    ]);

    // Start the CIG Node runtime
    const upResult = await runRemoteCommand(
      client,
      `cd ${installDir} && docker compose up -d`,
    );
    if (upResult.exitCode !== 0) {
      throw new Error(
        `docker compose up -d failed on ${target.host}: ${upResult.stderr}`,
      );
    }

    for (const command of postStartCommands) {
      let lastError = '';
      let succeeded = false;

      for (let attempt = 1; attempt <= postStartRetryLimit; attempt += 1) {
        const commandResult = await runRemoteCommand(
          client,
          `cd ${installDir} && ${command}`,
        );
        if (commandResult.exitCode === 0) {
          succeeded = true;
          break;
        }

        lastError = commandResult.stderr || commandResult.stdout || `exit code ${commandResult.exitCode}`;
        if (attempt < postStartRetryLimit) {
          await new Promise((resolve) => setTimeout(resolve, postStartRetryDelayMs));
        }
      }

      if (!succeeded) {
        throw new Error(
          `Failed to run post-start command on ${target.host}: ${lastError}`,
        );
      }
    }
  } finally {
    client.end();
  }
}
