import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareReleaseTagVersions,
  findHighestReleaseTag,
  normalizeReleaseTag,
  validateReleaseTagFloor,
  validateReleaseTagVersion,
} from './release-version.mjs';

test('normalizeReleaseTag parses release tags and build metadata', () => {
  assert.deepEqual(normalizeReleaseTag('refs/tags/v0.1.115+build.2'), {
    tag: 'v0.1.115+build.2',
    version: '0.1.115',
    buildNumber: 2,
  });
});

test('normalizeReleaseTag parses prefixed release tags', () => {
  assert.deepEqual(normalizeReleaseTag('refs/tags/cli-v0.1.115+build.2', 'cli-v'), {
    tag: 'cli-v0.1.115+build.2',
    version: '0.1.115',
    buildNumber: 2,
  });
});

test('validateReleaseTagVersion accepts matching semantic tags', () => {
  assert.deepEqual(validateReleaseTagVersion('v0.1.115', '0.1.115'), {
    ok: true,
    skipped: false,
    error: null,
    normalized: {
      tag: 'v0.1.115',
      version: '0.1.115',
      buildNumber: null,
    },
  });
});

test('validateReleaseTagVersion accepts matching build tags', () => {
  assert.deepEqual(validateReleaseTagVersion('v0.1.115+build.2', '0.1.115'), {
    ok: true,
    skipped: false,
    error: null,
    normalized: {
      tag: 'v0.1.115+build.2',
      version: '0.1.115',
      buildNumber: 2,
    },
  });
});

test('validateReleaseTagVersion accepts matching prefixed tags', () => {
  assert.deepEqual(validateReleaseTagVersion('cli-v0.1.115', '0.1.115', 'cli-v'), {
    ok: true,
    skipped: false,
    error: null,
    normalized: {
      tag: 'cli-v0.1.115',
      version: '0.1.115',
      buildNumber: null,
    },
  });
});

test('validateReleaseTagVersion rejects mismatched versions', () => {
  const result = validateReleaseTagVersion('v0.1.115', '0.1.114');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /expects version 0\.1\.115, but found 0\.1\.114/);
});

test('compareReleaseTagVersions orders release tags by version and build number', () => {
  assert.equal(compareReleaseTagVersions('v0.1.122', 'v0.1.121'), 1);
  assert.equal(compareReleaseTagVersions('v0.1.122+build.2', 'v0.1.122+build.1'), 1);
  assert.equal(compareReleaseTagVersions('v0.1.122+build.1', 'v0.1.122'), 1);
  assert.equal(compareReleaseTagVersions('v0.1.121', 'v0.1.122+build.1'), -1);
});

test('validateReleaseTagFloor rejects tags below the current floor', () => {
  const result = validateReleaseTagFloor('v0.1.119', 'v0.1.122');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /below the current release floor v0\.1\.122/);
});

test('validateReleaseTagFloor accepts tags at or above the current floor', () => {
  assert.deepEqual(validateReleaseTagFloor('v0.1.122', 'v0.1.122'), {
    ok: true,
    skipped: false,
    error: null,
    floor: {
      tag: 'v0.1.122',
      version: '0.1.122',
      buildNumber: null,
    },
  });
});

test('findHighestReleaseTag picks the highest tag for a prefix', () => {
  assert.equal(
    findHighestReleaseTag(['cli-v0.1.121', 'cli-v0.1.123', 'cli-v0.1.122+build.1'], 'cli-v'),
    'cli-v0.1.123',
  );
});
