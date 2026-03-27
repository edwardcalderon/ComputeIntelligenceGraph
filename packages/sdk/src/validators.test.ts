import { describe, it, expect } from 'vitest';
import { validateRoleArn, validateGcpProjectId, validateSaEmail } from './validators';

describe('validateRoleArn', () => {
  it('accepts a valid ARN', () => {
    expect(validateRoleArn('arn:aws:iam::123456789012:role/MyRole')).toEqual({ valid: true });
  });

  it('accepts ARN with path segments in role name', () => {
    expect(validateRoleArn('arn:aws:iam::123456789012:role/path/to/MyRole')).toEqual({ valid: true });
  });

  it('accepts ARN with special chars in role name', () => {
    expect(validateRoleArn('arn:aws:iam::123456789012:role/My.Role+Name@org')).toEqual({ valid: true });
  });

  it('rejects ARN with fewer than 12 account digits', () => {
    const result = validateRoleArn('arn:aws:iam::12345:role/MyRole');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid Role ARN format');
  });

  it('rejects ARN with wrong service', () => {
    const result = validateRoleArn('arn:aws:s3::123456789012:role/MyRole');
    expect(result.valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateRoleArn('').valid).toBe(false);
  });

  it('never throws', () => {
    expect(() => validateRoleArn(null as unknown as string)).not.toThrow();
  });
});

describe('validateGcpProjectId', () => {
  it('accepts a valid project ID', () => {
    expect(validateGcpProjectId('my-project-123')).toEqual({ valid: true });
  });

  it('accepts minimum length (6 chars)', () => {
    expect(validateGcpProjectId('abc123')).toEqual({ valid: true });
  });

  it('accepts maximum length (30 chars)', () => {
    expect(validateGcpProjectId('a' + 'b'.repeat(28) + '1')).toEqual({ valid: true });
  });

  it('rejects ID starting with a digit', () => {
    const result = validateGcpProjectId('1myproject');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid GCP project ID');
  });

  it('rejects ID that is too short (5 chars)', () => {
    expect(validateGcpProjectId('ab12c').valid).toBe(false);
  });

  it('rejects ID that is too long (31 chars)', () => {
    expect(validateGcpProjectId('a' + 'b'.repeat(29) + '1').valid).toBe(false);
  });

  it('rejects uppercase letters', () => {
    expect(validateGcpProjectId('MyProject').valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateGcpProjectId('').valid).toBe(false);
  });

  it('never throws', () => {
    expect(() => validateGcpProjectId(null as unknown as string)).not.toThrow();
  });
});

describe('validateSaEmail', () => {
  it('accepts a valid SA email', () => {
    expect(validateSaEmail('my-sa@my-project.iam.gserviceaccount.com')).toEqual({ valid: true });
  });

  it('accepts SA email with alphanumeric name', () => {
    expect(validateSaEmail('sa123@project456.iam.gserviceaccount.com')).toEqual({ valid: true });
  });

  it('rejects email with wrong domain', () => {
    const result = validateSaEmail('my-sa@my-project.iam.googleapis.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid service account email');
  });

  it('rejects plain email address', () => {
    expect(validateSaEmail('user@example.com').valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateSaEmail('').valid).toBe(false);
  });

  it('never throws', () => {
    expect(() => validateSaEmail(null as unknown as string)).not.toThrow();
  });
});
