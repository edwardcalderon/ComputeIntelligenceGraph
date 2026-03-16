import { GraphQueryEngine } from '@cig/graph';
import { Resource_Model } from '@cig/graph';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FindingCategory = 'public-access' | 'encryption' | 'iam' | 'network';
export type FindingStatus = 'open' | 'acknowledged' | 'resolved' | 'false-positive';

export interface SecurityFinding {
  id: string;
  resourceId: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  category: FindingCategory;
  status: FindingStatus;
}

export interface SecurityScore {
  score: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  findingsBySeverity: Record<FindingSeverity, number>;
}

export interface SecurityScanResult {
  findings: SecurityFinding[];
  score: SecurityScore;
  scannedAt: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: SecurityScanResult;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── Detection Rules ──────────────────────────────────────────────────────────

interface DetectionRule {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: FindingCategory;
  matches: (resource: Resource_Model) => boolean;
}

const DETECTION_RULES: DetectionRule[] = [
  // Req 30.1 — S3 public read access
  {
    id: 'S3_PUBLIC_READ',
    title: 'S3 bucket allows public read access',
    description:
      'This S3 bucket is configured to allow public read access. ' +
      'Remediation: Remove the public-read ACL and enable Block Public Access settings on the bucket.',
    severity: 'critical',
    category: 'public-access',
    matches: (r) =>
      r.type === ('s3' as never) &&
      (r.tags['public_read'] === 'true' ||
        r.tags['acl'] === 'public-read' ||
        r.tags['acl'] === 'public-read-write'),
  },

  // Req 30.2 — S3 public write access
  {
    id: 'S3_PUBLIC_WRITE',
    title: 'S3 bucket allows public write access',
    description:
      'This S3 bucket is configured to allow public write access. ' +
      'Remediation: Remove the public-read-write ACL and enable Block Public Access settings on the bucket.',
    severity: 'critical',
    category: 'public-access',
    matches: (r) =>
      r.type === ('s3' as never) &&
      (r.tags['public_write'] === 'true' || r.tags['acl'] === 'public-read-write'),
  },

  // Req 30.3 — EC2 unrestricted SSH
  {
    id: 'EC2_UNRESTRICTED_SSH',
    title: 'EC2 instance allows unrestricted SSH access (0.0.0.0/0:22)',
    description:
      'This EC2 instance has a security group rule that allows SSH access from any IP address. ' +
      'Remediation: Restrict SSH access to known IP ranges or use AWS Systems Manager Session Manager instead.',
    severity: 'high',
    category: 'network',
    matches: (r) =>
      r.type === ('ec2' as never) &&
      (r.tags['ssh_open'] === 'true' || r.tags['security_group'] === '0.0.0.0/0:22'),
  },

  // Req 30.4 — RDS public accessibility
  {
    id: 'RDS_PUBLICLY_ACCESSIBLE',
    title: 'RDS instance is publicly accessible',
    description:
      'This RDS database instance has the PubliclyAccessible flag set to true, ' +
      'making it reachable from the internet. ' +
      'Remediation: Disable public accessibility and place the instance in a private subnet.',
    severity: 'high',
    category: 'public-access',
    matches: (r) =>
      r.type === ('rds' as never) && r.tags['publicly_accessible'] === 'true',
  },

  // Req 30.5 — IAM unused access keys (> 90 days)
  {
    id: 'IAM_UNUSED_ACCESS_KEY',
    title: 'IAM access key unused for more than 90 days',
    description:
      'This IAM user has an access key that has not been used in over 90 days. ' +
      'Remediation: Deactivate or delete unused access keys to reduce the attack surface.',
    severity: 'medium',
    category: 'iam',
    matches: (r) => {
      if (r.type !== ('iam' as never)) return false;
      const lastUsedDays = parseInt(r.tags['last_used_days'] ?? '', 10);
      return !isNaN(lastUsedDays) && lastUsedDays > 90;
    },
  },

  // Req 30.6 — Security group unrestricted inbound
  {
    id: 'SG_UNRESTRICTED_INBOUND',
    title: 'Security group has unrestricted inbound rules',
    description:
      'This security group allows unrestricted inbound traffic from any source. ' +
      'Remediation: Restrict inbound rules to specific IP ranges and ports required by your application.',
    severity: 'high',
    category: 'network',
    matches: (r) =>
      r.type === ('security-group' as never) && r.tags['unrestricted_inbound'] === 'true',
  },
];

// ─── Score Calculation ────────────────────────────────────────────────────────

const SEVERITY_DEDUCTIONS: Record<FindingSeverity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
};

function calculateScore(findings: SecurityFinding[]): SecurityScore {
  const counts: Record<FindingSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const f of findings) {
    counts[f.severity]++;
  }

  const deduction = Object.entries(counts).reduce(
    (total, [sev, count]) => total + SEVERITY_DEDUCTIONS[sev as FindingSeverity] * count,
    0
  );

  const score = Math.max(0, 100 - deduction);

  let grade: SecurityScore['grade'];
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return { score, maxScore: 100, grade, findingsBySeverity: counts };
}

// ─── SecurityScanner ─────────────────────────────────────────────────────────

export class SecurityScanner {
  private cache: CacheEntry | null = null;
  private queryEngine: GraphQueryEngine | null = null;

  constructor() {
    try {
      this.queryEngine = new GraphQueryEngine();
    } catch {
      this.queryEngine = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getFindings(resourceId?: string): Promise<SecurityFinding[]> {
    const result = await this.getScanResult();
    if (resourceId) {
      return result.findings.filter((f) => f.resourceId === resourceId);
    }
    return result.findings;
  }

  async getScore(): Promise<SecurityScore> {
    const result = await this.getScanResult();
    return result.score;
  }

  async getScanResult(): Promise<SecurityScanResult> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }
    const data = await this.scan();
    this.cache = { data, fetchedAt: Date.now() };
    return data;
  }

  // ── Scanning ───────────────────────────────────────────────────────────────

  private async scan(): Promise<SecurityScanResult> {
    const resources = await this.fetchAllResources();
    const findings = this.applyRules(resources);
    const score = calculateScore(findings);

    return {
      findings,
      score,
      scannedAt: new Date().toISOString(),
    };
  }

  private async fetchAllResources(): Promise<Resource_Model[]> {
    if (!this.queryEngine) return [];

    try {
      const PAGE_SIZE = 200;
      const all: Resource_Model[] = [];
      let offset = 0;

      while (true) {
        const page = await this.queryEngine.listResourcesPaged(
          {},
          { limit: PAGE_SIZE, offset }
        );
        all.push(...page.items);
        if (!page.hasMore) break;
        offset += PAGE_SIZE;
      }

      return all;
    } catch {
      return [];
    }
  }

  private applyRules(resources: Resource_Model[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    let seq = 0;

    for (const resource of resources) {
      for (const rule of DETECTION_RULES) {
        if (rule.matches(resource)) {
          seq++;
          findings.push({
            id: `finding_${rule.id}_${resource.id}_${seq}`,
            resourceId: resource.id,
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            category: rule.category,
            status: 'open',
          });
        }
      }
    }

    return findings;
  }
}

// Singleton instance shared across requests
export const securityScanner = new SecurityScanner();
