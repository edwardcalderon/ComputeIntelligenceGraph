# Implementation Plan: Infrastructure Deployment Wrapper

## Overview

This plan implements the @cig/infra package, a TypeScript wrapper around @lsts_tech/infra that provides CIG-specific infrastructure deployment capabilities. The implementation follows an incremental approach: package setup → core wrapper → configuration → deployers → IAC integration → CLI → testing → documentation.

## Tasks

- [x] 1. Set up package structure and dependencies
  - Create packages/infra directory with TypeScript configuration
  - Initialize package.json with @cig/infra name and @lsts_tech/infra dependency
  - Set up tsconfig.json for TypeScript compilation with declaration files
  - Configure build, test, and lint scripts
  - Install development dependencies (TypeScript, Jest, fast-check, @types packages)
  - Create src/ directory structure: src/index.ts, src/types.ts, src/errors.ts
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Implement error types and base error handling
  - [x] 2.1 Create error class hierarchy in src/errors.ts
    - Implement InfraError base class with code and context properties
    - Implement ConfigValidationError with missingFields property
    - Implement LSTSInfraError with originalError wrapping
    - Implement DeploymentError with deploymentType and phase properties
    - Define ErrorCode enum with categorized error codes
    - _Requirements: 2.5, 3.4, 6.4, 10.3_
  
  - [ ]* 2.2 Write unit tests for error classes
    - Test error message formatting and property preservation
    - Test error code assignment and context inclusion
    - Test error inheritance chain
    - _Requirements: 2.5_

- [x] 3. Implement configuration management
  - [x] 3.1 Create configuration types in src/types.ts
    - Define InfraConfig, AWSConfig, AuthentikConfig, DashboardConfig interfaces
    - Define IACConfig and LoggingConfig interfaces
    - Define ValidationResult interface
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 3.2 Implement ConfigManager class in src/config/ConfigManager.ts
    - Implement load() method to merge configuration from multiple sources
    - Implement loadFromEnv() to parse environment variables
    - Implement loadFromFile() to load JSON/YAML configuration files
    - Implement validate() to check required fields and return ValidationResult
    - Implement getEnvironmentOverrides() for environment-specific config
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 3.3 Write property test for configuration loading
    - **Property 7: Configuration Loading from Any Valid Source**
    - **Validates: Requirements 6.1, 6.2**
    - Generate random valid configurations from different sources
    - Verify ConfigManager successfully loads and merges into InfraConfig
  
  - [ ]* 3.4 Write property test for missing configuration detection
    - **Property 9: Missing Configuration Error Specificity**
    - **Validates: Requirements 6.4**
    - Generate random incomplete configurations
    - Verify validation errors list exactly the missing parameters
  
  - [ ]* 3.5 Write property test for configuration round-trip
    - **Property 14: Configuration Source Round-Trip**
    - **Validates: Requirements 6.1, 6.2**
    - Generate random valid InfraConfig objects
    - Serialize to file, load back, verify equivalence
  
  - [ ]* 3.6 Write unit tests for ConfigManager
    - Test loading from environment variables with various formats
    - Test loading from JSON and YAML files
    - Test validation with missing required fields
    - Test environment-specific override merging
    - Test error cases: invalid file format, missing files
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4. Implement logging infrastructure
  - [x] 4.1 Create Logger class in src/logging/Logger.ts
    - Implement log level filtering (debug, info, warn, error)
    - Implement timestamp formatting in ISO 8601 format
    - Implement structured logging with operation context
    - Implement log methods: debug(), info(), warn(), error()
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 4.2 Write property test for log level filtering
    - **Property 12: Log Level Filtering**
    - **Validates: Requirements 10.4**
    - Generate random log messages at different levels
    - Verify only messages at or above configured level are output
  
  - [ ]* 4.3 Write property test for log timestamp presence
    - **Property 13: Log Timestamp Presence**
    - **Validates: Requirements 10.5**
    - Generate random log messages
    - Verify all messages include ISO 8601 timestamp at beginning
  
  - [ ]* 4.4 Write unit tests for Logger
    - Test log level filtering behavior
    - Test timestamp format correctness
    - Test structured logging with context
    - _Requirements: 10.4, 10.5_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement core InfraWrapper class
  - [x] 6.1 Create InfraWrapper class in src/InfraWrapper.ts
    - Implement constructor accepting ConfigManager
    - Implement wrapLSTSCall() private method for error wrapping
    - Implement deployAuthentik() method skeleton
    - Implement deployDashboard() method skeleton
    - Implement listDeployments() method skeleton
    - Add logging at operation start, progress, and completion
    - _Requirements: 2.1, 2.2, 2.5, 10.1, 10.2, 10.3_
  
  - [ ]* 6.2 Write property test for error context enrichment
    - **Property 1: Error Context Enrichment**
    - **Validates: Requirements 2.5**
    - Generate random LSTS errors and operation names
    - Verify re-thrown errors include original message plus context
  
  - [ ]* 6.3 Write property test for deployment logging completeness
    - **Property 11: Deployment Logging Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Generate random deployment operations
    - Verify logs include start, progress, and completion/error
  
  - [ ]* 6.4 Write unit tests for InfraWrapper
    - Test wrapLSTSCall() error wrapping with mocked LSTS errors
    - Test logging at different deployment stages
    - Test constructor initialization
    - _Requirements: 2.5, 10.1, 10.2, 10.3_

- [x] 7. Implement IAC integration
  - [x] 7.1 Create IACIntegration class in src/iac/IACIntegration.ts
    - Implement constructor accepting iacModulesPath
    - Implement getNetworkingModule() to return TerraformModuleReference
    - Implement getComputeModule() to return TerraformModuleReference
    - Implement validateModule() to check module existence and compatibility
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 7.2 Write property test for configuration parameter propagation
    - **Property 6: Configuration Parameter Propagation**
    - **Validates: Requirements 5.3**
    - Generate random configuration parameters
    - Verify parameters pass through to IAC modules without corruption
  
  - [ ]* 7.3 Write unit tests for IACIntegration
    - Test getNetworkingModule() with various configurations
    - Test getComputeModule() with various configurations
    - Test validateModule() with existing and missing modules
    - Test parameter mapping to Terraform variables
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Implement Authentik deployer
  - [x] 8.1 Create AuthentikDeployer class in src/deployers/AuthentikDeployer.ts
    - Implement constructor accepting InfraWrapper and ConfigManager
    - Implement deploy() method to provision Authentik to AWS
    - Integrate with IACIntegration for networking module
    - Call @lsts_tech/infra methods through InfraWrapper.wrapLSTSCall()
    - Implement configure() method for post-deployment setup
    - Implement getConnectionDetails() to return URL, adminUrl, clientId
    - Return AuthentikDeploymentResult with connection details
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 8.2 Write property test for successful deployment returns resource info
    - **Property 2: Successful Deployment Returns Resource Information**
    - **Validates: Requirements 3.3**
    - Generate random valid Authentik configurations
    - Verify successful deployments return resource IDs and connection details
  
  - [ ]* 8.3 Write property test for failed deployment returns descriptive error
    - **Property 3: Failed Deployment Returns Descriptive Error**
    - **Validates: Requirements 3.4**
    - Simulate various deployment failures
    - Verify error messages describe what failed, phase, and troubleshooting info
  
  - [ ]* 8.4 Write unit tests for AuthentikDeployer
    - Test deploy() with minimal configuration
    - Test deploy() with full configuration including VPC and subnet
    - Test configure() post-deployment setup
    - Test getConnectionDetails() return format
    - Test error handling for missing domain
    - Test integration with IAC networking module
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Implement Dashboard deployer
  - [x] 9.1 Create DashboardDeployer class in src/deployers/DashboardDeployer.ts
    - Implement constructor accepting InfraWrapper and ConfigManager
    - Implement deploy() method to provision dashboard to AWS
    - Call @lsts_tech/infra methods through InfraWrapper.wrapLSTSCall()
    - Implement integrateAuthentik() to configure authentication
    - Return DashboardDeploymentResult with deployed URL
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 9.2 Write property test for environment-specific configuration
    - **Property 4: Environment-Specific Configuration Application**
    - **Validates: Requirements 4.3, 6.5**
    - Generate random environment names and configurations
    - Verify environment overrides correctly merge with base config
  
  - [ ]* 9.3 Write property test for multi-environment isolation
    - **Property 5: Multi-Environment Isolation**
    - **Validates: Requirements 4.5**
    - Deploy same component to two different environments
    - Verify deployments are isolated with no shared state
  
  - [ ]* 9.4 Write unit tests for DashboardDeployer
    - Test deploy() with minimal configuration
    - Test deploy() with custom domain
    - Test integrateAuthentik() with Authentik connection details
    - Test deployment to multiple environments
    - Test error handling for missing buildPath
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement CLI interface
  - [~] 11.1 Create CLI class in src/cli/CLI.ts
    - Implement main() entry point with argument parsing
    - Implement deployAuthentik() command handler
    - Implement deployDashboard() command handler
    - Implement listDeployments() command handler
    - Format output for console display
    - Handle exit codes: 0 for success, non-zero for failure
    - Print errors to stderr
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [~] 11.2 Create CLI entry point in src/cli/index.ts
    - Export CLI.main() as default entry point
    - Add shebang for executable script
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ]* 11.3 Write property test for CLI exit code correctness
    - **Property 10: CLI Exit Code Correctness**
    - **Validates: Requirements 7.4, 7.5**
    - Generate random CLI commands (valid and invalid)
    - Verify exit code is 0 iff operation succeeds, non-zero with error message otherwise
  
  - [ ]* 11.4 Write property test for configuration validation before deployment
    - **Property 8: Configuration Validation Before Deployment**
    - **Validates: Requirements 6.3**
    - Generate random deployment commands with various configurations
    - Verify validation executes before provisioning and invalid config prevents deployment
  
  - [ ]* 11.5 Write unit tests for CLI
    - Test argument parsing for all commands
    - Test deployAuthentik command with valid arguments
    - Test deployDashboard command with valid arguments
    - Test listDeployments command
    - Test error handling for invalid commands
    - Test error handling for missing arguments
    - Test exit code behavior
    - Test error output to stderr
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12. Wire all components together
  - [x] 12.1 Create main package exports in src/index.ts
    - Export InfraWrapper class
    - Export ConfigManager class
    - Export AuthentikDeployer and DashboardDeployer classes
    - Export IACIntegration class
    - Export all error classes
    - Export all type definitions
    - Export Logger class
    - _Requirements: 2.2, 2.3_
  
  - [x] 12.2 Update package.json with correct entry points
    - Set main field to dist/index.js
    - Set types field to dist/index.d.ts
    - Set bin field to dist/cli/index.js for CLI executable
    - Add exports field for ESM/CJS compatibility
    - _Requirements: 1.2, 2.2, 2.3, 2.4_
  
  - [ ]* 12.3 Write integration tests
    - Test end-to-end Authentik deployment flow (mocked AWS)
    - Test end-to-end Dashboard deployment flow (mocked AWS)
    - Test CLI to wrapper to deployer integration
    - Test configuration loading through full deployment
    - _Requirements: 2.1, 3.1, 4.1_

- [x] 13. Create documentation
  - [x] 13.1 Create README.md with comprehensive documentation
    - Add package overview and purpose
    - Document installation instructions
    - Add usage examples for deploying Authentik
    - Add usage examples for deploying Dashboard
    - Document CLI commands with examples
    - Document required environment variables
    - Document configuration file format
    - Document integration with @cig/iac modules
    - Add troubleshooting section
    - _Requirements: 9.1, 9.3, 9.4, 9.5_
  
  - [x] 13.2 Add JSDoc comments to all exported functions and classes
    - Document InfraWrapper methods with parameters and return types
    - Document ConfigManager methods with examples
    - Document AuthentikDeployer and DashboardDeployer methods
    - Document IACIntegration methods
    - Document error classes and their usage
    - _Requirements: 9.2_
  
  - [x] 13.3 Create examples directory with sample configurations
    - Add example-config.json with all configuration options
    - Add example-env file with environment variable format
    - Add example deployment scripts
    - _Requirements: 9.5_

- [~] 14. Final checkpoint - Ensure all tests pass
  - Run full test suite including unit and property tests
  - Verify build produces correct output in dist/
  - Verify TypeScript declaration files are generated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples, edge cases, and integration points
- All 14 correctness properties from the design document are covered
- Implementation uses TypeScript as specified in the design document
- Mocking strategy: Mock @lsts_tech/infra and AWS SDK to avoid actual provisioning during tests
