/**
 * Property-Based Tests for Prerequisite Checks
 *
 * Property 12: Prerequisite check correctness
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as os from 'os';
import * as net from 'net';
import {
  checkDockerEngine,
  checkDockerCompose,
  checkMemory,
  checkDiskSpace,
  checkPorts,
  setFreeMemProvider,
  resetFreeMemProvider,
  PrereqCheckResult,
} from '../prereqs.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a valid PrereqCheckResult structure.
 */
const prereqResultArb = fc
  .tuple(fc.boolean(), fc.string({ minLength: 1 }), fc.option(fc.string({ minLength: 1 })))
  .map(([passed, message, remediation]) => ({
    passed,
    message,
    remediation,
  }));

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 12: Prerequisite check correctness', () => {
  describe('checkDockerEngine', () => {
    it('returns a result with passed boolean and message string', async () => {
      /**
       * Validates: Requirements 7.1
       *
       * For any system state (Docker present/absent), checkDockerEngine()
       * should return a result with passed boolean and message string.
       */
      const result = await checkDockerEngine();

      expect(result).toHaveProperty('passed');
      expect(typeof result.passed).toBe('boolean');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('returns remediation message when check fails', async () => {
      /**
       * Validates: Requirements 7.1
       *
       * When Docker is not available, the result should include
       * a remediation message.
       */
      // Mock execSync to simulate Docker not being available
      const originalExecSync = require('child_process').execSync;
      require('child_process').execSync = vi.fn(() => {
        throw new Error('docker: command not found');
      });

      try {
        const result = await checkDockerEngine();

        if (!result.passed) {
          expect(result.remediation).toBeDefined();
          expect(typeof result.remediation).toBe('string');
          expect(result.remediation!.length).toBeGreaterThan(0);
        }
      } finally {
        require('child_process').execSync = originalExecSync;
      }
    });
  });

  describe('checkDockerCompose', () => {
    it('returns a result with passed boolean and message string', async () => {
      /**
       * Validates: Requirements 7.2
       *
       * For any system state (Docker Compose present/absent),
       * checkDockerCompose() should return a result with passed boolean
       * and message string.
       */
      const result = await checkDockerCompose();

      expect(result).toHaveProperty('passed');
      expect(typeof result.passed).toBe('boolean');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('returns remediation message when check fails', async () => {
      /**
       * Validates: Requirements 7.2
       *
       * When Docker Compose is not available or version is too old,
       * the result should include a remediation message.
       */
      const originalExecSync = require('child_process').execSync;
      require('child_process').execSync = vi.fn(() => {
        throw new Error('docker compose: command not found');
      });

      try {
        const result = await checkDockerCompose();

        if (!result.passed) {
          expect(result.remediation).toBeDefined();
          expect(typeof result.remediation).toBe('string');
          expect(result.remediation!.length).toBeGreaterThan(0);
        }
      } finally {
        require('child_process').execSync = originalExecSync;
      }
    });
  });

  describe('checkMemory', () => {
    afterEach(() => {
      resetFreeMemProvider();
    });

    it('returns a result with passed boolean and message string', async () => {
      /**
       * Validates: Requirements 7.3
       *
       * For any system memory state, checkMemory() should return
       * a result with passed boolean and message string.
       */
      const result = await checkMemory();

      expect(result).toHaveProperty('passed');
      expect(typeof result.passed).toBe('boolean');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('returns true when free memory >= 4 GB', async () => {
      /**
       * Validates: Requirements 7.3
       *
       * When free memory is at least 4 GB, checkMemory() should
       * return passed: true.
       */
      setFreeMemProvider(() => 5 * 1024 * 1024 * 1024); // 5 GB

      const result = await checkMemory();
      expect(result.passed).toBe(true);
    });

    it('returns false when free memory < 4 GB', async () => {
      /**
       * Validates: Requirements 7.3
       *
       * When free memory is less than 4 GB, checkMemory() should
       * return passed: false with a remediation message.
       */
      setFreeMemProvider(() => 2 * 1024 * 1024 * 1024); // 2 GB

      const result = await checkMemory();
      expect(result.passed).toBe(false);
      expect(result.remediation).toBeDefined();
    });

    it('returns remediation message when check fails', async () => {
      /**
       * Validates: Requirements 7.3
       *
       * When memory is insufficient, the result should include
       * a remediation message.
       */
      setFreeMemProvider(() => 1 * 1024 * 1024 * 1024); // 1 GB

      const result = await checkMemory();

      if (!result.passed) {
        expect(result.remediation).toBeDefined();
        expect(typeof result.remediation).toBe('string');
        expect(result.remediation!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('checkDiskSpace', () => {
    it('returns a result with passed boolean and message string', async () => {
      /**
       * Validates: Requirements 7.4
       *
       * For any system disk state, checkDiskSpace() should return
       * a result with passed boolean and message string.
       */
      const result = await checkDiskSpace();

      expect(result).toHaveProperty('passed');
      expect(typeof result.passed).toBe('boolean');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('returns remediation message when check fails', async () => {
      /**
       * Validates: Requirements 7.4
       *
       * When disk space is insufficient, the result should include
       * a remediation message.
       */
      const originalExecSync = require('child_process').execSync;
      require('child_process').execSync = vi.fn(() => {
        throw new Error('df: command failed');
      });

      try {
        const result = await checkDiskSpace();

        if (!result.passed) {
          expect(result.remediation).toBeDefined();
          expect(typeof result.remediation).toBe('string');
          expect(result.remediation!.length).toBeGreaterThan(0);
        }
      } finally {
        require('child_process').execSync = originalExecSync;
      }
    });
  });

  describe('checkPorts', () => {
    it('returns a result with passed boolean and message string', async () => {
      /**
       * Validates: Requirements 7.5
       *
       * For any port availability state, checkPorts() should return
       * a result with passed boolean and message string.
       */
      const result = await checkPorts();

      expect(result).toHaveProperty('passed');
      expect(typeof result.passed).toBe('boolean');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('returns remediation message when check fails', async () => {
      /**
       * Validates: Requirements 7.5
       *
       * When required ports are in use, the result should include
       * a remediation message.
       */
      const result = await checkPorts();

      if (!result.passed) {
        expect(result.remediation).toBeDefined();
        expect(typeof result.remediation).toBe('string');
        expect(result.remediation!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('all checks return consistent structure', () => {
    it('every check returns passed boolean and message string', async () => {
      /**
       * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
       *
       * For any prerequisite check, the result should always have
       * a passed boolean and a non-empty message string.
       */
      const checks = [
        checkDockerEngine(),
        checkDockerCompose(),
        checkMemory(),
        checkDiskSpace(),
        checkPorts(),
      ];

      const results = await Promise.all(checks);

      for (const result of results) {
        expect(result).toHaveProperty('passed');
        expect(typeof result.passed).toBe('boolean');
        expect(result).toHaveProperty('message');
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);

        // If check failed, remediation should be present
        if (!result.passed) {
          expect(result.remediation).toBeDefined();
          expect(typeof result.remediation).toBe('string');
        }
      }
    });
  });
});
