import { describe, it, expect } from 'vitest';
import { generateNodeIdentity, signRequest, verifySignature } from './identity';

describe('generateNodeIdentity', () => {
  it('returns a NodeIdentity with all required fields', () => {
    const identity = generateNodeIdentity();
    expect(identity.nodeId).toBeTruthy();
    expect(identity.privateKey).toBeTruthy();
    expect(identity.publicKey).toBeTruthy();
    expect(identity.issuedAt).toBeTruthy();
  });

  it('nodeId is a valid UUID', () => {
    const { nodeId } = generateNodeIdentity();
    expect(nodeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('keys are base64-encoded strings', () => {
    const { privateKey, publicKey } = generateNodeIdentity();
    expect(() => Buffer.from(privateKey, 'base64')).not.toThrow();
    expect(() => Buffer.from(publicKey, 'base64')).not.toThrow();
  });

  it('generates unique identities on each call', () => {
    const a = generateNodeIdentity();
    const b = generateNodeIdentity();
    expect(a.nodeId).not.toBe(b.nodeId);
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  it('issuedAt is a valid ISO 8601 timestamp', () => {
    const { issuedAt } = generateNodeIdentity();
    expect(new Date(issuedAt).toISOString()).toBe(issuedAt);
  });
});

describe('signRequest / verifySignature round-trip', () => {
  it('verifies a signature produced by signRequest', () => {
    const { privateKey, publicKey } = generateNodeIdentity();
    const payload = 'hello world';
    const sig = signRequest(payload, privateKey);
    expect(verifySignature(payload, sig, publicKey)).toBe(true);
  });

  it('returns false for a tampered payload', () => {
    const { privateKey, publicKey } = generateNodeIdentity();
    const sig = signRequest('original', privateKey);
    expect(verifySignature('tampered', sig, publicKey)).toBe(false);
  });

  it('returns false for a tampered signature', () => {
    const { privateKey, publicKey } = generateNodeIdentity();
    const sig = signRequest('payload', privateKey);
    const tampered = sig.slice(0, -4) + 'AAAA';
    expect(verifySignature('payload', tampered, publicKey)).toBe(false);
  });

  it('returns false when using a different key pair', () => {
    const a = generateNodeIdentity();
    const b = generateNodeIdentity();
    const sig = signRequest('payload', a.privateKey);
    expect(verifySignature('payload', sig, b.publicKey)).toBe(false);
  });

  it('verifySignature never throws on invalid inputs', () => {
    expect(() => verifySignature('payload', 'not-base64!!!', 'also-bad')).not.toThrow();
    expect(verifySignature('payload', 'not-base64!!!', 'also-bad')).toBe(false);
  });

  it('handles empty payload', () => {
    const { privateKey, publicKey } = generateNodeIdentity();
    const sig = signRequest('', privateKey);
    expect(verifySignature('', sig, publicKey)).toBe(true);
    expect(verifySignature('nonempty', sig, publicKey)).toBe(false);
  });
});
