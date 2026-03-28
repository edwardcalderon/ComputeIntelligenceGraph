#!/usr/bin/env node
/**
 * CIG CLI — main entry point
 *
 * Defines the root commander.js program with global flags and registers all
 * top-level commands.  Individual command implementations live in ./commands/.
 */
import { Command } from 'commander';
export declare const program: Command;
export interface GlobalOptions {
    mode: 'managed' | 'self-hosted';
    cloud?: 'aws' | 'gcp';
    profile: 'core' | 'full';
    target: 'local' | 'ssh' | 'host';
    manifest?: string;
    token?: string;
}
export declare function getGlobalOptions(): GlobalOptions;
//# sourceMappingURL=index.d.ts.map