import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyApiImpact,
  computeApiSourceFingerprint,
  isApiRuntimePath,
  isApiSourcePath,
  isVersionOnlyPackageJsonDiff,
  normalizePackageJsonText,
} from './api-impact.mjs';

test('ignores package version bumps and release metadata-only changes', async () => {
  const result = await classifyApiImpact({
    changedFiles: [
      'package.json',
      'packages/api/package.json',
      'release-metadata.json',
      'README.md',
    ],
    baseRef: 'base',
    headRef: 'head',
    readTextAtRef: async (ref, filePath) => {
      const files = {
        'base:package.json': JSON.stringify({
          name: 'cig-monorepo',
          version: '0.1.105',
          scripts: { build: 'pnpm build' },
        }),
        'head:package.json': JSON.stringify({
          name: 'cig-monorepo',
          version: '0.1.106',
          scripts: { build: 'pnpm build' },
        }),
        'base:packages/api/package.json': JSON.stringify({
          name: '@cig/api',
          version: '0.1.105',
          scripts: { build: 'tsc --build' },
        }),
        'head:packages/api/package.json': JSON.stringify({
          name: '@cig/api',
          version: '0.1.106',
          scripts: { build: 'tsc --build' },
        }),
      };

      return files[`${ref}:${filePath}`] ?? '';
    },
  });

  assert.equal(result.apiSourceChanged, false);
  assert.equal(result.apiRuntimeChanged, false);
  assert.equal(result.releaseMetadataOnly, true);
  assert.equal(result.hasRelevantChanges, false);
});

test('detects API source changes and ignores tests', async () => {
  const result = await classifyApiImpact({
    changedFiles: [
      'packages/api/src/routes/auth.ts',
      'packages/api/src/routes/auth.test.ts',
      'packages/api/src/routes/__tests__/auth.spec.ts',
    ],
    baseRef: 'base',
    headRef: 'head',
    readTextAtRef: async () => '',
  });

  assert.equal(result.apiSourceChanged, true);
  assert.equal(result.apiRuntimeChanged, false);
  assert.equal(result.releaseMetadataOnly, false);
  assert.equal(result.hasRelevantChanges, true);
});

test('detects runtime changes in the deploy wiring', async () => {
  const result = await classifyApiImpact({
    changedFiles: [
      'packages/infra/src/deployers/ApiDeployer.ts',
      'packages/iac/environments/api-prod/main.tf',
      '.github/workflows/deploy-api.yml',
    ],
    baseRef: 'base',
    headRef: 'head',
    readTextAtRef: async () => '',
  });

  assert.equal(result.apiSourceChanged, false);
  assert.equal(result.apiRuntimeChanged, true);
  assert.equal(result.releaseMetadataOnly, false);
  assert.equal(result.hasRelevantChanges, true);
});

test('treats new package manifests as relevant source changes', async () => {
  const result = await classifyApiImpact({
    changedFiles: ['packages/api/package.json'],
    baseRef: 'base',
    headRef: 'head',
    readTextAtRef: async (ref) => {
      if (ref === 'base') {
        throw new Error('missing base package.json');
      }

      return JSON.stringify({
        name: '@cig/api',
        version: '0.1.106',
        scripts: { build: 'tsc --build' },
      });
    },
  });

  assert.equal(result.apiSourceChanged, true);
  assert.equal(result.apiRuntimeChanged, false);
  assert.equal(result.releaseMetadataOnly, false);
  assert.equal(result.hasRelevantChanges, true);
});

test('includes copied email templates in the source fingerprint', async () => {
  const files = ['packages/emails/src/templates/sign-in.html'];

  const fingerprintA = await computeApiSourceFingerprint({
    listFiles: async () => files,
    readText: async (filePath) =>
      filePath === 'packages/emails/src/templates/sign-in.html'
        ? '<html><body>template-a</body></html>\n'
        : '',
  });

  const fingerprintB = await computeApiSourceFingerprint({
    listFiles: async () => files,
    readText: async (filePath) =>
      filePath === 'packages/emails/src/templates/sign-in.html'
        ? '<html><body>template-b</body></html>\n'
        : '',
  });

  assert.notEqual(fingerprintA, fingerprintB);
});

test('normalizes package.json version-only diffs before fingerprinting', async () => {
  const files = [
    'package.json',
    'packages/api/package.json',
    'packages/api/src/index.ts',
  ];

  const fingerprintA = await computeApiSourceFingerprint({
    listFiles: async () => files,
    readText: async (filePath) => {
      const values = {
        'package.json': JSON.stringify({
          name: 'cig-monorepo',
          version: '0.1.105',
          scripts: { build: 'pnpm build' },
        }),
        'packages/api/package.json': JSON.stringify({
          name: '@cig/api',
          version: '0.1.105',
          scripts: { build: 'tsc --build' },
        }),
        'packages/api/src/index.ts': 'export const version = 1;\n',
      };

      return values[filePath];
    },
  });

  const fingerprintB = await computeApiSourceFingerprint({
    listFiles: async () => files,
    readText: async (filePath) => {
      const values = {
        'package.json': JSON.stringify({
          name: 'cig-monorepo',
          version: '0.1.106',
          scripts: { build: 'pnpm build' },
        }),
        'packages/api/package.json': JSON.stringify({
          name: '@cig/api',
          version: '0.1.106',
          scripts: { build: 'tsc --build' },
        }),
        'packages/api/src/index.ts': 'export const version = 1;\n',
      };

      return values[filePath];
    },
  });

  assert.equal(fingerprintA, fingerprintB);
});

test('normalizes package json content with stable ordering', () => {
  const normalized = normalizePackageJsonText(
    JSON.stringify({
      version: '0.1.106',
      scripts: { test: 'vitest run', build: 'tsc --build' },
      name: '@cig/api',
    })
  );

  assert.equal(
    normalized,
    JSON.stringify({
      name: '@cig/api',
      scripts: { build: 'tsc --build', test: 'vitest run' },
    })
  );
});

test('recognizes source and runtime paths', () => {
  assert.equal(isApiSourcePath('packages/api/src/routes/auth.ts'), true);
  assert.equal(isApiSourcePath('packages/api/src/routes/auth.test.ts'), false);
  assert.equal(isApiSourcePath('packages/emails/src/templates/sign-in.html'), true);
  assert.equal(isApiRuntimePath('packages/infra/src/deployers/ApiDeployer.ts'), true);
  assert.equal(isApiRuntimePath('packages/infra/README.md'), false);
});

test('identifies version-only package diffs', () => {
  assert.equal(
    isVersionOnlyPackageJsonDiff(
      JSON.stringify({
        name: '@cig/api',
        version: '0.1.105',
        scripts: { build: 'tsc --build' },
      }),
      JSON.stringify({
        name: '@cig/api',
        version: '0.1.106',
        scripts: { build: 'tsc --build' },
      })
    ),
    true
  );
});
