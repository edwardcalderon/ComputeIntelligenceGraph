/**
 * @cig/infra - Infrastructure Deployment Wrapper
 *
 * Provider-agnostic deployment layer for AWS and GCP.
 * Wraps @lsts_tech/infra (SST/Pulumi) for AWS and gcloud CLI for GCP,
 * exposing a unified CloudProvider interface so deployment code is portable.
 */

// Core types & errors
export * from './types.js';
export * from './errors.js';

// Configuration
export * from './config/ConfigManager.js';

// Logging
export * from './logging/Logger.js';

// IAC integration (Terraform modules)
export * from './iac/IACIntegration.js';

// Provider abstraction (AWS + GCP)
export * from './providers/index.js';

// Deployers
export * from './deployers/AuthentikDeployer.js';
export * from './deployers/DashboardDeployer.js';
export * from './deployers/GcpCloudRunDeployer.js';

// Orchestration wrapper
export * from './InfraWrapper.js';
