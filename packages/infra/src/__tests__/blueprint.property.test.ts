/**
 * Property-based tests for AuthentikInfraBlueprint (AuthentikDeployer).
 *
 * Properties tested:
 *   Property 19: Blueprint deployment outputs completeness
 *   Property 20: Blueprint deployment failure triggers rollback
 *
 * Feature: cig-auth-provisioning
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AuthentikDeployer } from '../deployers/AuthentikDeployer';
import { IACIntegration } from '../iac/IACIntegration';
import { InfraWrapper } from '../InfraWrapper';
import { ConfigManager } from '../config/ConfigManager';
import { DeploymentError } from '../errors';
import type { AuthentikDeploymentConfig } from '../types';

// ─── Global configuration ─────────────────────────────────────────────────────

fc.configureGlobal({ numRuns: 100 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDeployer() {
  const configManager = new ConfigManager();
  const wrapper = new InfraWrapper(configManager);
  return new AuthentikDeployer(wrapper, configManager);
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid domain names (simple two-label form, TLD must be alpha-only). */
const domainArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/),
    fc.stringMatching(/^[a-z]{2,6}$/)
  )
  .map(([label, tld]) => `${label}.${tld}`);

/** Valid email addresses. */
const emailArb = fc.emailAddress();

/** AWS region strings. */
const regionArb = fc.constantFrom(
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'ap-southeast-1'
);

/** A complete, valid AuthentikDeploymentConfig. */
const deploymentConfigArb: fc.Arbitrary<AuthentikDeploymentConfig> = fc.record({
  domain: domainArb,
  adminEmail: emailArb,
  region: regionArb,
});

/** Non-empty string arbitrary for OIDC output values. */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 64 });

// ─── Property 19 ──────────────────────────────────────────────────────────────

describe('Property 19: Blueprint deployment outputs completeness', () => {
  // Feature: cig-auth-provisioning, Property 19: For any successful
  // AuthentikInfraBlueprint.deploy() call, the result should contain non-empty
  // issuerUrl, oidcClientId, and oidcClientSecret fields.
  // Validates: Requirements 1.7

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successful deploy() always returns non-empty issuerUrl, oidcClientId, oidcClientSecret', async () => {
    await fc.assert(
      fc.asyncProperty(
        deploymentConfigArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        async (config, issuerUrl, oidcClientId, oidcClientSecret) => {
          const deployer = makeDeployer();

          // Stub applyModule to return the generated outputs
          vi.spyOn(IACIntegration.prototype, 'applyModule').mockResolvedValue({
            issuer_url: issuerUrl,
            oidc_client_id: oidcClientId,
            oidc_client_secret: oidcClientSecret,
          });

          const result = await deployer.deploy(config);

          expect(result.success).toBe(true);
          expect(result.issuerUrl).toBeTruthy();
          expect(result.oidcClientId).toBeTruthy();
          expect(result.oidcClientSecret).toBeTruthy();
          expect(result.issuerUrl).toBe(issuerUrl);
          expect(result.oidcClientId).toBe(oidcClientId);
          expect(result.oidcClientSecret).toBe(oidcClientSecret);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 20 ──────────────────────────────────────────────────────────────

describe('Property 20: Blueprint deployment failure triggers rollback', () => {
  // Feature: cig-auth-provisioning, Property 20: For any deployment that fails
  // at any phase, a DeploymentError should be thrown with a non-empty message,
  // and the deployer should have attempted to destroy provisioned resources.
  // Validates: Requirements 1.8

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws DeploymentError with non-empty message when applyModule fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        deploymentConfigArb,
        fc.string({ minLength: 1, maxLength: 80 }),
        async (config, errorMessage) => {
          const deployer = makeDeployer();

          vi.spyOn(IACIntegration.prototype, 'applyModule').mockRejectedValue(
            new Error(errorMessage)
          );
          const destroySpy = vi
            .spyOn(IACIntegration.prototype, 'destroyModule')
            .mockResolvedValue(undefined);

          let thrown: unknown;
          try {
            await deployer.deploy(config);
          } catch (err) {
            thrown = err;
          }

          // Must throw a DeploymentError
          expect(thrown).toBeInstanceOf(DeploymentError);
          expect((thrown as DeploymentError).message).toBeTruthy();
          expect((thrown as DeploymentError).message.length).toBeGreaterThan(0);

          // Must have attempted rollback
          expect(destroySpy).toHaveBeenCalledOnce();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('throws DeploymentError and rolls back when outputs are incomplete', async () => {
    await fc.assert(
      fc.asyncProperty(
        deploymentConfigArb,
        // Produce outputs with at least one empty/missing field
        fc.record({
          issuer_url: fc.oneof(fc.constant(''), fc.constant(undefined as unknown as string)),
          oidc_client_id: nonEmptyStringArb,
          oidc_client_secret: nonEmptyStringArb,
        }),
        async (config, incompleteOutputs) => {
          const deployer = makeDeployer();

          vi.spyOn(IACIntegration.prototype, 'applyModule').mockResolvedValue(
            incompleteOutputs as Record<string, string>
          );
          const destroySpy = vi
            .spyOn(IACIntegration.prototype, 'destroyModule')
            .mockResolvedValue(undefined);

          let thrown: unknown;
          try {
            await deployer.deploy(config);
          } catch (err) {
            thrown = err;
          }

          expect(thrown).toBeInstanceOf(DeploymentError);
          expect((thrown as DeploymentError).message.length).toBeGreaterThan(0);
          expect(destroySpy).toHaveBeenCalledOnce();
        }
      ),
      { numRuns: 100 }
    );
  });
});
