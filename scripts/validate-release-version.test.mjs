import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReleaseTag, validateReleaseTagVersion } from './release-version.mjs';

test('normalizeReleaseTag parses release tags and build metadata', () => {
  assert.deepEqual(normalizeReleaseTag('refs/tags/v0.1.115+build.2'), {
    tag: 'v0.1.115+build.2',
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

test('validateReleaseTagVersion rejects mismatched versions', () => {
  const result = validateReleaseTagVersion('v0.1.115', '0.1.114');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /expects version 0\.1\.115, but found 0\.1\.114/);
});
