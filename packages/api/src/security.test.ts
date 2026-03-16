/**
 * Unit tests for SecurityScanner
 * Validates: Requirements 26.1, 26.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @cig/graph before importing security.ts
vi.mock('@cig/graph', () => ({
  GraphQueryEngine: vi.fn().mockImplementation(() => ({
    listResourcesPaged: vi.fn(),
  })),
  Resource_Model: {},
}));

import { SecurityScanner } from './security.js';
import { GraphQueryEngine } from '@cig/graph';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ResourceLike = {
  id: string;
  type: string;
  tags: Record<string, string>;
  name?: string;
  provider?: string;
  region?: string;
  state?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  discoveredAt?: Date;
};

function makeResource(overrides: Partial<ResourceLike> = {}): ResourceLike {
  return {
    id: 'res-1',
    type: 'ec2',
    tags: {},
    name: 'test',
    provider: 'aws',
    region: 'us-east-1',
    state: 'running',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    discoveredAt: new Date(),
    ...overrides,
  };
}

function makeScannerWithResources(resources: ResourceLike[]): SecurityScanner {
  const scanner = new SecurityScanner();
  const mockEngine = {
    listResourcesPaged: vi.fn().mockResolvedValue({ items: resources, hasMore: false }),
  };
  (scanner as unknown as Record<string, unknown>)['queryEngine'] = mockEngine;
  return scanner;
}

function makeScannerWithNullEngine(): SecurityScanner {
  const scanner = new SecurityScanner();
  (scanner as unknown as Record<string, unknown>)['queryEngine'] = null;
  return scanner;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SecurityScanner', () => {
  describe('getFindings()', () => {
    it('returns all findings when no resourceId filter', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
        makeResource({ id: 'r2', type: 'ec2', tags: { ssh_open: 'true' } }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });

    it('filters findings by resourceId when provided', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
        makeResource({ id: 'r2', type: 'ec2', tags: { ssh_open: 'true' } }),
      ]);
      const findings = await scanner.getFindings('r1');
      expect(findings.every((f) => f.resourceId === 'r1')).toBe(true);
    });
  });

  describe('getScore()', () => {
    it('returns score object with correct structure', async () => {
      const scanner = makeScannerWithResources([]);
      const score = await scanner.getScore();
      expect(score).toHaveProperty('score');
      expect(score).toHaveProperty('maxScore', 100);
      expect(score).toHaveProperty('grade');
      expect(score).toHaveProperty('findingsBySeverity');
    });
  });

  describe('calculateScore()', () => {
    it('deducts 20 points per critical finding', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
      ]);
      const score = await scanner.getScore();
      // S3_PUBLIC_READ is critical (20 pts), S3_PUBLIC_READ also matches public-read-write check
      // but public-read only triggers S3_PUBLIC_READ (not S3_PUBLIC_WRITE)
      expect(score.score).toBe(80); // 100 - 20
    });

    it('deducts 10 points per high finding', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 'ec2', tags: { ssh_open: 'true' } }),
      ]);
      const score = await scanner.getScore();
      expect(score.score).toBe(90); // 100 - 10
    });

    it('deducts 5 points per medium finding', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 'iam', tags: { last_used_days: '100' } }),
      ]);
      const score = await scanner.getScore();
      expect(score.score).toBe(95); // 100 - 5
    });

    it('never goes below 0', async () => {
      // Many critical findings
      const resources = Array.from({ length: 10 }, (_, i) =>
        makeResource({ id: `r${i}`, type: 's3', tags: { acl: 'public-read' } })
      );
      const scanner = makeScannerWithResources(resources);
      const score = await scanner.getScore();
      expect(score.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('grade calculation', () => {
    it('assigns grade A for score 90-100', async () => {
      const scanner = makeScannerWithResources([]);
      const score = await scanner.getScore();
      expect(score.score).toBe(100);
      expect(score.grade).toBe('A');
    });

    it('assigns grade B for score 80-89', async () => {
      // 1 critical = -20 → score 80
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
      ]);
      const score = await scanner.getScore();
      expect(score.score).toBe(80);
      expect(score.grade).toBe('B');
    });

    it('assigns grade C for score 70-79', async () => {
      // 1 critical + 1 high = -30 → score 70
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
        makeResource({ id: 'r2', type: 'ec2', tags: { ssh_open: 'true' } }),
      ]);
      const score = await scanner.getScore();
      expect(score.score).toBe(70);
      expect(score.grade).toBe('C');
    });

    it('assigns grade D for score 60-69', async () => {
      // 2 critical = -40 → score 60
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
        makeResource({ id: 'r2', type: 's3', tags: { acl: 'public-read' } }),
      ]);
      const score = await scanner.getScore();
      expect(score.score).toBe(60);
      expect(score.grade).toBe('D');
    });

    it('assigns grade F for score below 60', async () => {
      // 3 critical = -60 → score 40
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
        makeResource({ id: 'r2', type: 's3', tags: { acl: 'public-read' } }),
        makeResource({ id: 'r3', type: 's3', tags: { acl: 'public-read' } }),
      ]);
      const score = await scanner.getScore();
      expect(score.score).toBe(40);
      expect(score.grade).toBe('F');
    });
  });

  describe('detection rules', () => {
    it('S3_PUBLIC_READ matches s3 with acl=public-read', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read' } }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.some((f) => f.id.includes('S3_PUBLIC_READ'))).toBe(true);
    });

    it('S3_PUBLIC_WRITE matches s3 with acl=public-read-write', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 's3', tags: { acl: 'public-read-write' } }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.some((f) => f.id.includes('S3_PUBLIC_WRITE'))).toBe(true);
    });

    it('EC2_UNRESTRICTED_SSH matches ec2 with ssh_open=true', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 'ec2', tags: { ssh_open: 'true' } }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.some((f) => f.id.includes('EC2_UNRESTRICTED_SSH'))).toBe(true);
    });

    it('RDS_PUBLICLY_ACCESSIBLE matches rds with publicly_accessible=true', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 'rds', tags: { publicly_accessible: 'true' } }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.some((f) => f.id.includes('RDS_PUBLICLY_ACCESSIBLE'))).toBe(true);
    });

    it('IAM_UNUSED_ACCESS_KEY matches iam with last_used_days > 90', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 'iam', tags: { last_used_days: '91' } }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.some((f) => f.id.includes('IAM_UNUSED_ACCESS_KEY'))).toBe(true);
    });

    it('IAM_UNUSED_ACCESS_KEY does not match iam with last_used_days <= 90', async () => {
      const scanner = makeScannerWithResources([
        makeResource({ id: 'r1', type: 'iam', tags: { last_used_days: '90' } }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.some((f) => f.id.includes('IAM_UNUSED_ACCESS_KEY'))).toBe(false);
    });

    it('SG_UNRESTRICTED_INBOUND matches security-group with unrestricted_inbound=true', async () => {
      const scanner = makeScannerWithResources([
        makeResource({
          id: 'r1',
          type: 'security-group',
          tags: { unrestricted_inbound: 'true' },
        }),
      ]);
      const findings = await scanner.getFindings();
      expect(findings.some((f) => f.id.includes('SG_UNRESTRICTED_INBOUND'))).toBe(true);
    });
  });

  describe('getScanResult() caching', () => {
    it('returns cached result on second call', async () => {
      const scanner = makeScannerWithResources([]);
      const first = await scanner.getScanResult();
      const second = await scanner.getScanResult();
      expect(first).toBe(second); // same object reference = cached
    });
  });
});
