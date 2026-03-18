/**
 * Error classes for infrastructure operations
 */

/**
 * Base error class for infrastructure operations
 */
export class InfraError extends Error {
  /**
   * Create an infrastructure error
   * @param message - Error message
   * @param code - Error code
   * @param context - Additional context information
   */
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'InfraError';
    Object.setPrototypeOf(this, InfraError.prototype);
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends InfraError {
  /**
   * Create a configuration validation error
   * @param message - Error message
   * @param missingFields - List of missing required fields
   */
  constructor(
    message: string,
    public missingFields: string[]
  ) {
    super(message, 'CONFIG_VALIDATION_ERROR', { missingFields });
    this.name = 'ConfigValidationError';
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

/**
 * LSTS infra error wrapper
 */
export class LSTSInfraError extends InfraError {
  /**
   * Create an LSTS infra error wrapper
   * @param message - Error message
   * @param originalError - Original error from LSTS infra
   */
  constructor(
    message: string,
    public originalError: Error
  ) {
    super(message, 'LSTS_INFRA_ERROR', { originalError: originalError.message });
    this.name = 'LSTSInfraError';
    Object.setPrototypeOf(this, LSTSInfraError.prototype);
  }
}

/**
 * Deployment error
 */
export class DeploymentError extends InfraError {
  /**
   * Create a deployment error
   * @param message - Error message
   * @param deploymentType - Type of deployment that failed
   * @param phase - Deployment phase where error occurred
   */
  constructor(
    message: string,
    public deploymentType: string,
    public phase: string
  ) {
    super(message, 'DEPLOYMENT_ERROR', { deploymentType, phase });
    this.name = 'DeploymentError';
    Object.setPrototypeOf(this, DeploymentError.prototype);
  }
}

/**
 * Error code enumeration
 */
export enum ErrorCode {
  // Configuration errors (1xxx)
  CONFIG_VALIDATION_ERROR = 'E1001',
  CONFIG_MISSING_REQUIRED = 'E1002',
  CONFIG_INVALID_FORMAT = 'E1003',
  
  // LSTS infra errors (2xxx)
  LSTS_INFRA_ERROR = 'E2001',
  LSTS_CONNECTION_ERROR = 'E2002',
  LSTS_AUTH_ERROR = 'E2003',
  
  // Deployment errors (3xxx)
  DEPLOYMENT_ERROR = 'E3001',
  DEPLOYMENT_TIMEOUT = 'E3002',
  DEPLOYMENT_ROLLBACK_FAILED = 'E3003',
  
  // IAC integration errors (4xxx)
  IAC_MODULE_NOT_FOUND = 'E4001',
  IAC_MODULE_INVALID = 'E4002',
  IAC_PARAMETER_ERROR = 'E4003',
  
  // CLI errors (5xxx)
  CLI_INVALID_COMMAND = 'E5001',
  CLI_INVALID_ARGS = 'E5002',
}

/**
 * Error response format
 */
export interface ErrorResponse {
  /** Always false for error responses */
  success: false;
  /** Error details */
  error: {
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: any;
    /** Contextual information */
    context?: {
      /** Operation being performed */
      operation: string;
      /** Environment (if applicable) */
      environment?: string;
      /** Deployment phase (if applicable) */
      phase?: string;
    };
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Stack trace (in debug mode) */
    stackTrace?: string;
  };
}
