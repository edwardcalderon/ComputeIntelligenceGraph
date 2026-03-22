export class RemoteExecutor {
  buildCopyCommand(sourcePath: string, remoteHost: string, destinationPath: string): string {
    return `scp -r ${sourcePath} ${remoteHost}:${destinationPath}`;
  }

  buildRemoteCommand(remoteHost: string, command: string): string {
    return `ssh ${remoteHost} '${command.replace(/'/g, "'\"'\"'")}'`;
  }
}
