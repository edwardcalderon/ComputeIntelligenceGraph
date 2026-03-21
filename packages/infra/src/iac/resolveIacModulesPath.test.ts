import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveIacModulesPath } from './resolveIacModulesPath';

const tempDirs: string[] = [];

describe('resolveIacModulesPath', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('prefers an explicit modules path override', () => {
    const cwd = createTempWorkspace();
    const providedPath = path.join(cwd, 'custom-iac');
    createModuleLayout(providedPath);

    const resolvedPath = resolveIacModulesPath({
      cwd,
      providedPath: 'custom-iac',
    });

    expect(resolvedPath).toBe(providedPath);
  });

  it('uses the environment path when no explicit override is provided', () => {
    const cwd = createTempWorkspace();
    const envPath = path.join(cwd, 'env-iac');
    createModuleLayout(envPath);

    const resolvedPath = resolveIacModulesPath({
      cwd,
      envPath: 'env-iac',
    });

    expect(resolvedPath).toBe(envPath);
  });

  it('falls back to the workspace packages/iac layout when present', () => {
    const cwd = createTempWorkspace();
    const workspaceIacPath = path.join(cwd, 'packages', 'iac');
    createModuleLayout(workspaceIacPath);

    const resolvedPath = resolveIacModulesPath({ cwd });

    expect(resolvedPath).toBe(workspaceIacPath);
  });

  it('falls back to infra/terraform when packages/iac is absent', () => {
    const cwd = createTempWorkspace();
    const terraformPath = path.join(cwd, 'infra', 'terraform');
    createModuleLayout(terraformPath);

    const resolvedPath = resolveIacModulesPath({ cwd });

    expect(resolvedPath).toBe(terraformPath);
  });
});

function createTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-infra-'));
  tempDirs.push(dir);
  return dir;
}

function createModuleLayout(rootPath: string): void {
  fs.mkdirSync(path.join(rootPath, 'modules', 'networking'), { recursive: true });
  fs.mkdirSync(path.join(rootPath, 'modules', 'compute'), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modules', 'networking', 'main.tf'), '');
  fs.writeFileSync(path.join(rootPath, 'modules', 'compute', 'main.tf'), '');
}
