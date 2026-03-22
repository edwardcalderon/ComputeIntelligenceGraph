import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialManager } from './credentials.js';
import { detectOS, validateAwsRoleArn, validateGcpServiceAccount } from './wizard.js';

describe('CredentialManager', () => {
  let tmpDir: string;
  let mgr: CredentialManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-test-'));
    mgr = new CredentialManager({
      paths: {
        configDir: path.join(tmpDir, 'config'),
      },
      encryptionSeed: 'test-seed',
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('save() encrypts and stores a credential', () => {
    mgr.save('aws', 'arn:aws:iam::123456789012:role/MyRole');
    const raw = fs.readFileSync(path.join(tmpDir, 'config', 'credentials.json'), 'utf8');
    const config = JSON.parse(raw);
    expect(config.credentials.aws).toBeDefined();
    // Value should be encrypted, not plaintext
    expect(config.credentials.aws.data).not.toBe('arn:aws:iam::123456789012:role/MyRole');
  });

  it('load() decrypts and returns the stored credential', () => {
    mgr.save('aws', 'arn:aws:iam::123456789012:role/MyRole');
    const value = mgr.load('aws');
    expect(value).toBe('arn:aws:iam::123456789012:role/MyRole');
  });

  it('save() throws on empty value', () => {
    expect(() => mgr.save('aws', '')).toThrow('Credential value must not be empty');
    expect(() => mgr.save('aws', '   ')).toThrow('Credential value must not be empty');
  });

  it('isRotationDue() returns false for fresh credentials', () => {
    mgr.save('aws', 'arn:aws:iam::123456789012:role/MyRole', 90);
    expect(mgr.isRotationDue('aws')).toBe(false);
  });

  it('isRotationDue() returns true for old credentials', () => {
    mgr.save('aws', 'arn:aws:iam::123456789012:role/MyRole', 90);

    // Advance time by 91 days
    const futureMs = Date.now() + 91 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(futureMs);

    expect(mgr.isRotationDue('aws')).toBe(true);

    vi.restoreAllMocks();
  });

  it('delete() removes a credential', () => {
    mgr.save('aws', 'arn:aws:iam::123456789012:role/MyRole');
    mgr.delete('aws');
    expect(mgr.load('aws')).toBeNull();
  });

  it('list() returns credential metadata without values', () => {
    mgr.save('aws', 'arn:aws:iam::123456789012:role/MyRole');
    mgr.save('gcp', '/tmp/sa.json');
    const items = mgr.list();
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('rotationDue');
      expect(item).not.toHaveProperty('value');
    }
  });

  it('round-trip: save then load returns original value', () => {
    const original = 'arn:aws:iam::999999999999:role/RoundTripRole';
    mgr.save('aws', original);
    expect(mgr.load('aws')).toBe(original);
  });
});

describe('detectOS()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "linux" on linux platform', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    expect(detectOS()).toBe('linux');
  });

  it('returns "macos" on darwin platform', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    expect(detectOS()).toBe('macos');
  });

  it('returns "windows" on win32 platform', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    expect(detectOS()).toBe('windows');
  });
});

describe('validateAwsRoleArn()', () => {
  it('returns true for a valid ARN', () => {
    expect(validateAwsRoleArn('arn:aws:iam::123456789012:role/MyRole')).toBe(true);
    expect(validateAwsRoleArn('arn:aws:iam:::role/NoAccount')).toBe(true);
  });

  it('returns false for an invalid ARN', () => {
    expect(validateAwsRoleArn('not-an-arn')).toBe(false);
    expect(validateAwsRoleArn('arn:aws:s3:::my-bucket')).toBe(false);
    expect(validateAwsRoleArn('')).toBe(false);
  });
});

describe('validateGcpServiceAccount()', () => {
  it('returns false for a non-existent file', () => {
    expect(validateGcpServiceAccount('/nonexistent/path/sa.json')).toBe(false);
  });

  it('returns false for a non-json file path', () => {
    expect(validateGcpServiceAccount('/tmp/service-account.txt')).toBe(false);
  });
});
