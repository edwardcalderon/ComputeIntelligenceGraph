# Implementation Plan: CIG (Compute Intelligence Graph)

## Overview

This implementation plan breaks down the CIG system into 12 phases spanning 24 weeks. Each phase builds incrementally on previous work, with checkpoints to ensure quality and gather user feedback. The plan follows the technical design document and covers all 38 requirements.

## Implementation Language

TypeScript with Node.js runtime for backend services, React/Next.js for frontend applications.
Python 3.11 for the Cartography discovery microservice (services/cartography).

## Discovery Architecture
Infrastructure discovery is handled by Cartography (https://github.com/lyft/cartography), a battle-tested Python tool that writes resource graphs directly to Neo4j. CIG wraps Cartography in a FastAPI microservice and orchestrates it from the TypeScript discovery package. This eliminates the need to implement custom cloud SDK integrations for AWS, GCP, and Kubernetes.

## Tasks

- [x] 1. Phase 1: Foundation and Monorepo Setup
  - [x] 1.1 Initialize monorepo structure with pnpm and TurboRepo
    - Create root package.json with pnpm workspace configuration
    - Configure TurboRepo for build orchestration (turbo.json)
    - Create directory structure: apps/, packages/, infra/, docs/
    - Setup TypeScript configuration with shared tsconfig.base.json
    - Configure ESLint and Prettier for code quality
    - Setup Husky and Commitlint for git hooks
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Create package scaffolds for all components
    - Create packages/cli with Commander.js setup
    - Create packages/iac with Terraform module structure
    - Create packages/discovery with AWS SDK v3 dependencies
    - Create packages/graph with Neo4j driver setup
    - Create packages/api with Fastify framework
    - Create packages/chatbot with LangChain dependencies
    - Create packages/agents for OpenClaw and OpenFang
    - Create packages/config for configuration management
    - Create packages/sdk for TypeScript and Python SDKs
    - _Requirements: 1.7, 1.8_

  - [x] 1.3 Create application scaffolds
    - Create apps/landing with Next.js 14 (App Router)
    - Create apps/dashboard with Next.js 14 and TailwindCSS
    - Create apps/wizard-ui for installation wizard
    - _Requirements: 1.7_

  - [x] 1.4 Setup Docker infrastructure
    - Create base Dockerfiles for Node.js services (multi-stage builds)
    - Create docker-compose.yml for local development
    - Create docker-compose.dev.yml for development overrides with hot reload
    - Configure Docker networks and volumes
    - Implement container security hardening (non-root users, read-only filesystems)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 32.1, 32.2, 33.1, 33.2_

  - [x] 1.5 Setup CI/CD pipeline
    - Create GitHub Actions workflow for testing (test.yml)
    - Create GitHub Actions workflow for building and publishing containers
    - Configure automated linting, unit tests, and coverage reporting
    - Setup Codecov or similar for coverage tracking
    - _Requirements: 26.5_

  - [ ]* 1.6 Write unit tests for monorepo configuration
    - Test package resolution and imports
    - Test build orchestration with TurboRepo
    - Verify Docker Compose service startup
    - _Requirements: 26.1_

- [x] 2. Checkpoint - Foundation Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 2: Graph Engine Implementation
  - [x] 3.1 Deploy and configure Neo4j database
    - Add Neo4j service to docker-compose.yml with APOC plugin
    - Configure Neo4j memory settings and authentication
    - Create health check for Neo4j service
    - Setup Neo4j connection pooling
    - _Requirements: 7.1, 24.8_

  - [x] 3.2 Implement graph schema and constraints
    - Create Cypher scripts for node constraints (resource_id unique)
    - Create indexes for efficient querying (type, provider, state, region, name)
    - Create full-text search index for resource search
    - Create composite indexes for common query patterns
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 3.3 Build GraphEngine core API (packages/graph)
    - Implement resource CRUD operations (create, update, delete, get)
    - Implement relationship creation and deletion
    - Implement connection pooling and retry logic with exponential backoff
    - Add circuit breaker pattern for database failures
    - Implement error handling and logging
    - _Requirements: 7.9, 8.1, 8.2, 23.1, 23.3, 23.8, 23.9_

  - [x] 3.4 Implement graph query interface
    - Implement getDependencies with configurable depth (up to 3 levels)
    - Implement getDependents query
    - Implement findUnusedResources query
    - Implement findCircularDependencies query
    - Implement resource filtering by type, provider, region, tags
    - Implement pagination for large result sets
    - Add query timeout enforcement (30 seconds)
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 24.8_

  - [x] 3.5 Write unit tests for GraphEngine
    - Test resource CRUD operations
    - Test relationship creation and querying
    - Test dependency traversal with various depths
    - Test circular dependency detection
    - Test error handling and retry logic
    - _Requirements: 26.1_

  - [x] 3.6 Write property test for transitive dependency resolution
    - **Property 8: Transitive Dependency Resolution**
    - **Validates: Requirements 6.8**
    - Generate random graphs and verify dependencies resolved up to 3 levels
    - _Requirements: 26.8_

  - [x] 3.7 Write property test for circular dependency detection
    - **Property 9: Circular Dependency Detection**
    - **Validates: Requirements 6.9**
    - Generate graphs with known cycles and verify detection
    - _Requirements: 26.8_

- [x] 4. Checkpoint - Graph Engine Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 3: Cartography Discovery Service
  - [x] 5.1 Create Cartography service container (services/cartography)
    - Create services/cartography/Dockerfile (Python 3.11-slim, install cartography via pip)
    - Create services/cartography/requirements.txt (cartography, fastapi, uvicorn, pydantic)
    - Create services/cartography/app/main.py (FastAPI app with /run, /status, /health, /runs endpoints)
    - Create services/cartography/app/runner.py (subprocess runner that executes cartography CLI)
    - Create services/cartography/app/config.py (config from env vars: NEO4J_URI, AWS_ROLE_ARN, etc.)
    - Add cartography service to docker-compose.yml (port 8001, depends on neo4j)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 18.1, 18.2, 18.3, 28.1, 28.2, 34.1_

  - [x] 5.2 Configure Cartography for AWS discovery
    - Create cartography_config.yaml with AWS module configuration
    - Configure IAM role assumption for least-privilege discovery
    - Configure AWS regions from environment variable
    - Verify EC2, RDS, S3, Lambda, VPC, IAM resource types are enabled
    - Test discovery run against mock/real AWS account
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 14.1, 14.2_

  - [x] 5.3 Implement Discovery Orchestrator (packages/discovery)
    - Refactor packages/discovery to be a thin HTTP client for Cartography service
    - Implement CartographyClient class (triggerRun, getStatus, getRecentRuns)
    - Implement DiscoveryScheduler (cron-based, configurable interval, default 5 min)
    - Emit WebSocket events on discovery completion (resource_discovered, discovery_complete)
    - Implement discovery job tracking (store run history in Neo4j or in-memory)
    - Remove all AWS SDK v3 direct dependencies from packages/discovery
    - _Requirements: 5.9, 5.10, 6.10, 7.10, 24.7_

  - [x] 5.4 Write property test for discovery interval execution
    - **Property 6: Discovery Interval Execution**
    - **Validates: Requirements 5.10**
    - Verify discovery orchestrator calls Cartography at configured intervals with ±10% tolerance
    - _Requirements: 26.8_

  - [x] 5.5 Write integration tests for Cartography service
    - Test FastAPI endpoints (/run, /status, /health)
    - Test runner.py subprocess execution with mocked cartography CLI
    - Test discovery orchestrator HTTP client
    - Test WebSocket event emission on completion
    - _Requirements: 26.2_

- [x] 6. Checkpoint - Cartography Discovery Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Phase 4: API Layer Implementation
  - [x] 7.1 Setup Fastify API framework (packages/api)
    - Initialize Fastify application with TypeScript
    - Configure CORS with configurable origins
    - Configure request logging with Pino
    - Add health check endpoint (/api/v1/health)
    - Configure error handling middleware
    - _Requirements: 16.1, 23.9, 25.2_

  - [x] 7.2 Implement authentication and authorization
    - Create API key generation and storage (bcrypt hashing)
    - Create JWT token generation and validation
    - Implement authentication middleware for API key and JWT
    - Implement authorization middleware with permission checking
    - Define permission model (READ_RESOURCES, WRITE_RESOURCES, EXECUTE_ACTIONS, MANAGE_DISCOVERY, ADMIN)
    - _Requirements: 16.8, 17.8_

  - [ ]* 7.3 Write property test for API authentication enforcement
    - **Property 22: API Authentication Enforcement**
    - **Validates: Requirements 16.8, 17.8**
    - Verify all API endpoints require valid authentication
    - _Requirements: 26.8_

  - [x] 7.4 Implement rate limiting
    - Add rate limiting middleware (100 requests per minute per client)
    - Implement rate limit tracking by API key or IP address
    - Return 429 status code when rate limit exceeded
    - _Requirements: 16.9_

  - [ ]* 7.5 Write property test for API rate limiting
    - **Property 23: API Rate Limiting**
    - **Validates: Requirements 16.9**
    - Verify rate limit enforced at 100 requests per minute
    - _Requirements: 26.8_

  - [x] 7.6 Implement REST API endpoints
    - Implement GET /api/v1/resources (list all resources with filtering)
    - Implement GET /api/v1/resources/:id (get resource by ID)
    - Implement GET /api/v1/resources/:id/dependencies (get dependencies)
    - Implement GET /api/v1/resources/:id/dependents (get dependents)
    - Implement GET /api/v1/resources/search (search resources)
    - Implement GET /api/v1/discovery/status (get discovery status)
    - Implement POST /api/v1/discovery/trigger (manually trigger discovery)
    - Implement POST /api/v1/graph/query (execute custom Cypher query)
    - Implement GET /api/v1/costs (get cost summary)
    - Implement GET /api/v1/costs/breakdown (get cost breakdown)
    - Implement GET /api/v1/security/findings (get security findings)
    - Implement GET /api/v1/security/score (get security score)
    - Implement POST /api/v1/actions/execute (execute infrastructure action)
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.10_

  - [x] 7.7 Implement GraphQL API with GraphQL Yoga
    - Define GraphQL schema for Resource, Relationship, Query, Mutation, Subscription types
    - Implement resource queries (resource, resources, searchResources)
    - Implement aggregation queries (resourceCounts, unusedResources, circularDependencies)
    - Implement discovery queries (discoveryStatus)
    - Implement cost queries (costSummary)
    - Implement security queries (securityFindings, securityScore)
    - Implement mutations (triggerDiscovery, executeAction)
    - Implement subscriptions (resourceUpdated, discoveryProgress)
    - Add query depth limiting (max 5 levels)
    - Add query complexity limiting (max 1000 points)
    - Implement cursor-based pagination
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.9, 17.10_

  - [ ]* 7.8 Write property test for GraphQL query depth limiting
    - **Property 24: GraphQL Query Depth Limiting**
    - **Validates: Requirements 17.9**
    - Generate queries with varying depths and verify rejection at depth > 5
    - _Requirements: 26.8_

  - [x] 7.9 Implement WebSocket server for real-time updates
    - Add WebSocket support to Fastify
    - Implement event broadcasting for resource updates
    - Implement discovery progress streaming
    - Add WebSocket authentication
    - _Requirements: 9.10_

  - [x] 7.10 Implement observability endpoints
    - Add Prometheus metrics endpoint (/metrics)
    - Implement metrics for API request duration and counts
    - Implement metrics for discovery operations
    - Implement metrics for graph query performance
    - Configure structured JSON logging with Pino
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9_

  - [ ]* 7.11 Write integration tests for API endpoints
    - Test REST endpoints with authentication
    - Test GraphQL queries and mutations
    - Test WebSocket connections and events
    - Test rate limiting behavior
    - Test error responses
    - _Requirements: 26.2_

- [x] 8. Checkpoint - API Layer Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Phase 5: Dashboard Implementation
  - [x] 9.1 Setup Next.js dashboard application (apps/dashboard)
    - Initialize Next.js 14 with App Router and TypeScript
    - Configure TailwindCSS for styling
    - Setup TanStack Query for data fetching
    - Setup Zustand for state management
    - Configure environment variables for API URL
    - _Requirements: 9.1_

  - [x] 9.2 Implement dashboard layout and navigation
    - Create main layout with sidebar navigation
    - Create navigation menu (Overview, Resources, Graph, Costs, Security, Settings)
    - Implement responsive design for mobile and desktop
    - Add dark mode support
    - _Requirements: 9.1_

  - [x] 9.3 Implement Overview dashboard page
    - Display total resource count
    - Display resource counts by type (compute, storage, network, database)
    - Display resource counts by provider (AWS, GCP, Kubernetes, Docker)
    - Display resource counts by region
    - Display discovery status (last run, next run)
    - Display inactive resource count
    - Display graph statistics (node count, edge count)
    - Implement real-time metric updates via WebSocket
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [x] 9.4 Implement Resources list view page
    - Create resource list table with sorting and filtering
    - Implement filters by type, provider, region, state, tags
    - Implement search functionality
    - Implement pagination for large resource lists
    - Display resource metadata (ID, name, type, region, state, tags)
    - Add click handler to view resource details
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.9_

  - [x] 9.5 Implement interactive graph visualization page
    - Integrate React Flow for graph rendering
    - Implement force-directed layout with D3-force
    - Color nodes by resource type
    - Size nodes by cost or connection count
    - Style edges by relationship type
    - Implement node click handler to show details panel
    - Implement dependency highlighting on node selection
    - Add zoom and pan controls
    - Implement graph filtering by type, provider, region
    - Add real-time graph updates via WebSocket
    - _Requirements: 9.2, 9.7, 9.8, 9.10, 24.3_

  - [x] 9.6 Implement resource details panel
    - Display full resource metadata
    - Display resource tags
    - Display resource relationships
    - Display resource cost information
    - Display security findings for resource
    - _Requirements: 9.7, 9.8, 9.9_

  - [x] 9.7 Write E2E tests for dashboard
    - Test navigation between pages
    - Test resource filtering and search
    - Test graph visualization interactions
    - Test real-time updates
    - _Requirements: 26.3_

- [x] 10. Checkpoint - Dashboard Complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 11. Phase 6: Conversational Interface Implementation
  - [x] 11.1 Setup vector database (packages/chatbot)
    - Add Chroma vector database to docker-compose.yml
    - Configure Chroma client in TypeScript
    - Create infrastructure_resources collection
    - Implement vector database connection pooling
    - _Requirements: 13.8_

  - [x] 11.2 Implement RAG pipeline
    - Integrate OpenAI text-embedding-3-small or local sentence-transformers
    - Implement resource embedding generation (metadata + tags + relationships)
    - Implement vector similarity search (top-k=10)
    - Implement context assembly (retrieved resources + conversation history)
    - Implement embedding updates on infrastructure changes
    - Add retrieval performance optimization (< 200ms)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9, 13.10_

  - [~] 11.3 Write property test for RAG context retrieval
    - **Property 16: RAG Context Retrieval**
    - **Validates: Requirements 13.1, 13.2, 13.6**
    - Verify top 10 most relevant resources retrieved for any query
    - _Requirements: 26.8_

  - [~] 11.4 Write property test for vector embedding updates
    - **Property 17: Vector Embedding Updates**
    - **Validates: Requirements 13.7**
    - Verify embeddings updated when resources change
    - _Requirements: 26.8_

  - [~] 11.5 Write property test for embedding content completeness
    - **Property 18: Embedding Content Completeness**
    - **Validates: Requirements 13.10**
    - Verify embeddings include metadata, tags, and dependencies
    - _Requirements: 26.8_

  - [x] 11.6 Implement OpenClaw query reasoning agent (packages/agents)
    - Integrate LangChain with OpenAI GPT-4 or local Llama 3
    - Implement natural language query interpretation
    - Implement Cypher query generation from natural language
    - Implement conversation context management (last 5 turns)
    - Implement clarifying question generation for ambiguous queries
    - Add response generation in natural language
    - Optimize for < 3 second response time
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [~] 11.7 Write property test for natural language query translation
    - **Property 11: Natural Language Query Translation**
    - **Validates: Requirements 11.5**
    - Verify queries translated to valid Cypher
    - _Requirements: 26.8_

  - [~] 11.8 Write property test for conversation context maintenance
    - **Property 12: Conversation Context Maintenance**
    - **Validates: Requirements 11.10**
    - Verify context maintained for last 5 turns
    - _Requirements: 26.8_

  - [x] 11.9 Implement chat interface in dashboard
    - Add chat widget to dashboard layout
    - Implement message input and display
    - Implement streaming response display
    - Add loading indicators
    - Display error messages gracefully
    - Implement conversation history persistence
    - _Requirements: 11.1, 11.9_

  - [x] 11.10 Write integration tests for conversational interface
    - Test query interpretation and response generation
    - Test RAG context retrieval
    - Test conversation context maintenance
    - Test error handling for LLM failures
    - _Requirements: 26.2_

- [x] 12. Checkpoint - Conversational Interface Complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 13. Phase 7: Infrastructure Actions Implementation
  - [x] 13.1 Implement OpenFang action execution agent (packages/agents)
    - Create ActionExecutor class
    - Implement permission validation before action execution
    - Implement confirmation workflow for all actions
    - Implement audit logging for all actions (timestamp, user, action type, resource ID, result)
    - Add support for CREATE_S3_BUCKET action
    - Add support for START_EC2_INSTANCE action
    - Add support for STOP_EC2_INSTANCE action
    - Implement destructive action prevention without explicit confirmation
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [~] 13.2 Write property test for permission validation before action execution
    - **Property 13: Permission Validation Before Action Execution**
    - **Validates: Requirements 12.1, 14.1, 14.6**
    - Verify permissions validated before any action execution
    - _Requirements: 26.8_

  - [~] 13.3 Write property test for action confirmation for destructive operations
    - **Property 14: Action Confirmation for Destructive Operations**
    - **Validates: Requirements 12.10**
    - Verify confirmation required for destructive actions
    - _Requirements: 26.8_

  - [~] 13.4 Write property test for action audit logging
    - **Property 15: Action Audit Logging**
    - **Validates: Requirements 12.9**
    - Verify audit log created for every action
    - _Requirements: 26.8_

  - [x] 13.5 Integrate OpenFang with conversational interface
    - Add action request parsing in OpenClaw
    - Implement action confirmation prompts in chat interface
    - Display action results in chat
    - Handle action errors gracefully
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 13.6 Write integration tests for infrastructure actions
    - Test action execution with mocked cloud APIs
    - Test permission validation
    - Test confirmation workflow
    - Test audit logging
    - Test error handling
    - _Requirements: 26.2_

- [x] 14. Checkpoint - Infrastructure Actions Complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 15. Phase 8: CLI and Installation Implementation
  - [x] 15.1 Implement CLI tool (packages/cli)
    - Setup Commander.js for CLI commands
    - Implement "cig install" command to launch wizard
    - Implement "cig connect aws --role-arn <arn>" command
    - Implement "cig connect gcp --service-account <path>" command
    - Implement "cig deploy --target <local|aws|gcp>" command
    - Implement "cig start" command
    - Implement "cig stop" command
    - Implement "cig status" command
    - Implement "cig seed --scenario <small|medium|large>" command
    - Implement "cig reset" command
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 15.2 Implement credential management
    - Create CredentialManager class with AES-256-GCM encryption
    - Implement OS keychain integration (macOS Keychain, Windows Credential Manager, Linux Secret Service)
    - Implement credential storage in ~/.cig/config.json with 0600 permissions
    - Implement credential validation before storage
    - Implement credential rotation (every 90 days)
    - Ensure credentials never logged in plaintext
    - Ensure credentials only transmitted over TLS
    - Support AWS IAM role assumption instead of static credentials
    - _Requirements: 2.7, 2.9, 2.10, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10_

  - [ ]* 15.3 Write property test for credential encryption round-trip
    - **Property 1: Credential Encryption Round-Trip**
    - **Validates: Requirements 2.10, 15.1, 15.2, 15.3**
    - Verify encrypt-decrypt produces equivalent credential
    - _Requirements: 26.8_

  - [ ]* 15.4 Write property test for configuration file permissions
    - **Property 3: Configuration File Permissions**
    - **Validates: Requirements 2.9**
    - Verify config files created with 0600 permissions
    - _Requirements: 26.8_

  - [ ]* 15.5 Write property test for credential non-logging
    - **Property 20: Credential Non-Logging**
    - **Validates: Requirements 15.4**
    - Verify credentials never logged in plaintext
    - _Requirements: 26.8_

  - [ ]* 15.6 Write property test for credential non-transmission over unencrypted connections
    - **Property 21: Credential Non-Transmission Over Unencrypted Connections**
    - **Validates: Requirements 15.5**
    - Verify credentials only transmitted over TLS
    - _Requirements: 26.8_

  - [x] 15.7 Implement installation wizard
    - Create interactive wizard flow with prompts
    - Implement deployment target selection (local, AWS, GCP, hybrid)
    - Implement OS detection (Linux, macOS, Windows)
    - Implement Docker installation verification
    - Implement credential collection and validation
    - Implement permission validation before provisioning
    - Implement infrastructure provisioning with rollback on failure
    - Display dashboard URL on completion
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [ ]* 15.8 Write property test for credential validation before provisioning
    - **Property 4: Credential Validation Before Provisioning**
    - **Validates: Requirements 3.6**
    - Verify credentials validated before provisioning
    - _Requirements: 26.8_

  - [ ]* 15.9 Write property test for provisioning rollback on failure
    - **Property 5: Provisioning Rollback on Failure**
    - **Validates: Requirements 3.11**
    - Verify resources rolled back on provisioning failure
    - _Requirements: 26.8_

  - [x] 15.10 Implement Terraform modules (packages/iac)
    - Create AWS minimal deployment module (t3.micro + 20GB EBS + security group + IAM role)
    - Create GCP minimal deployment module (e2-micro + 20GB PD + firewall + service account)
    - Create user-data script for Docker installation and CIG deployment
    - Implement resource tagging with "cig-managed"
    - Configure security groups for minimal inbound traffic
    - Output connection details (instance IP, dashboard URL)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ]* 15.11 Write property test for read-only discovery permissions
    - **Property 19: Read-Only Discovery Permissions**
    - **Validates: Requirements 14.1, 14.4**
    - Verify only read permissions used for discovery
    - _Requirements: 26.8_

  - [x] 15.12 Implement configuration management (packages/config)
    - Define CIGConfig TypeScript interface
    - Implement configuration loading from environment variables
    - Implement configuration loading from YAML files
    - Implement configuration loading from command-line arguments
    - Implement configuration validation on startup
    - Provide default values for all optional configuration
    - Fail fast with descriptive errors for invalid configuration
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10_

  - [ ]* 15.13 Write property test for configuration validation on startup
    - **Property 29: Configuration Validation on Startup**
    - **Validates: Requirements 20.5, 20.6**
    - Verify invalid configuration causes startup failure
    - _Requirements: 26.8_

  - [x] 15.14 Write unit tests for CLI commands
    - Test each CLI command execution
    - Test credential management
    - Test installation wizard flow
    - Test Terraform module execution
    - _Requirements: 26.1_

- [x] 16. Checkpoint - CLI and Installation Complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 17. Phase 9: Multi-Cloud and Kubernetes Discovery
  - [x] 17.1 Configure Cartography for GCP discovery
    - Add GCP module configuration to cartography_config.yaml
    - Configure GCP service account credential injection
    - Verify Compute Engine, Cloud SQL, GCS, Cloud Functions, IAM resource types
    - Test GCP discovery run
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10_

  - [x] 17.2 Configure Cartography for Kubernetes discovery
    - Add Kubernetes module configuration to cartography_config.yaml
    - Configure kubeconfig injection into Cartography container
    - Verify Pod, Service, Deployment, Namespace, Ingress, PV resource types
    - Test Kubernetes discovery run
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8, 28.9, 28.10_

  - [x] 17.3 Update dashboard for multi-cloud support
    - Add provider filter to all resource views
    - Update graph visualization to show multi-cloud resources
    - Add provider-specific icons and colors for AWS, GCP, Kubernetes
    - _Requirements: 18.10, 28.10_

  - [ ]* 17.4 Write property test for multi-cloud resource unification
    - **Property 25: Multi-Cloud Resource Unification**
    - **Validates: Requirements 18.10, 28.10**
    - Verify resources from all providers displayed in unified views
    - _Requirements: 26.8_

  - [ ]* 17.5 Write integration tests for multi-cloud discovery
    - Test GCP discovery configuration
    - Test Kubernetes discovery configuration
    - Test unified resource views in dashboard
    - _Requirements: 26.2_

- [x] 18. Checkpoint - Multi-Cloud and Kubernetes Discovery Complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 19. Phase 10: Security and Cost Features Implementation
  - [x] 19.1 Implement cost analysis features
    - Integrate AWS Cost Explorer API for cost data retrieval
    - Integrate GCP Cloud Billing API for cost data retrieval
    - Associate costs with individual resources
    - Implement cost aggregation by provider, type, region, tag
    - Implement cost trend calculation (7 days, 30 days, 90 days)
    - Update cost data daily
    - _Requirements: 29.1, 29.2, 29.3, 29.10_

  - [x] 19.2 Implement cost dashboard pages
    - Display total monthly infrastructure cost
    - Display cost breakdown by resource type
    - Display cost breakdown by region
    - Display cost breakdown by tag
    - Display cost trends over time with charts
    - Display top 10 most expensive resources
    - _Requirements: 29.4, 29.5, 29.6, 29.7, 29.8_

  - [x] 19.3 Add cost queries to conversational interface
    - Implement "What are my most expensive resources?" query
    - Implement cost filtering and sorting in OpenClaw
    - _Requirements: 29.9_

  - [x] 19.4 Implement security misconfiguration detection
    - Create SecurityScanner class with detection rules
    - Implement S3 public read access detection
    - Implement S3 public write access detection
    - Implement EC2 unrestricted SSH access detection (0.0.0.0/0 on port 22)
    - Implement RDS public accessibility detection
    - Implement IAM unused access keys detection (> 90 days)
    - Implement security group unrestricted inbound rules detection
    - Calculate security score (0-100) based on findings
    - Categorize findings by severity (critical, high, medium, low)
    - Create notifications for detected misconfigurations
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8, 30.9_

  - [x] 19.5 Implement security dashboard pages
    - Display security score and grade (A-F)
    - Display security findings list with severity levels
    - Display findings by category (public access, encryption, IAM, network)
    - Display finding details with remediation steps
    - Add finding status management (open, acknowledged, resolved, false positive)
    - _Requirements: 30.7, 30.8_

  - [x] 19.6 Add security queries to conversational interface
    - Implement "What security issues do I have?" query
    - Implement security finding filtering in OpenClaw
    - _Requirements: 30.10_

  - [ ]* 19.7 Write unit tests for cost and security features
    - Test cost calculation and aggregation
    - Test security rule detection
    - Test security score calculation
    - _Requirements: 26.1_

- [x] 20. Checkpoint - Security and Cost Features Complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 21. Phase 11: Testing and Hardening
  - [x] 21.1 Implement comprehensive unit test suite
    - Achieve 80% code coverage across all packages
    - Add unit tests for all core functions and classes
    - Add unit tests for error handling paths
    - Add unit tests for edge cases
    - _Requirements: 26.1, 26.4_

  - [x] 21.2 Implement all property-based tests
    - Implement Property 1: Credential Encryption Round-Trip
    - Implement Property 3: Configuration File Permissions
    - Implement Property 4: Credential Validation Before Provisioning
    - Implement Property 5: Provisioning Rollback on Failure
    - Implement Property 6: Discovery Interval Execution (orchestrator calls Cartography at configured intervals)
    - Implement Property 7: Dependency Edge Labeling
    - Implement Property 8: Transitive Dependency Resolution
    - Implement Property 9: Circular Dependency Detection
    - Implement Property 10: Resource State Synchronization
    - Implement Property 11: Natural Language Query Translation
    - Implement Property 12: Conversation Context Maintenance
    - Implement Property 13: Permission Validation Before Action Execution
    - Implement Property 14: Action Confirmation for Destructive Operations
    - Implement Property 15: Action Audit Logging
    - Implement Property 16: RAG Context Retrieval
    - Implement Property 17: Vector Embedding Updates
    - Implement Property 18: Embedding Content Completeness
    - Implement Property 19: Read-Only Discovery Permissions
    - Implement Property 20: Credential Non-Logging
    - Implement Property 21: Credential Non-Transmission Over Unencrypted Connections
    - Implement Property 22: API Authentication Enforcement
    - Implement Property 23: API Rate Limiting
    - Implement Property 24: GraphQL Query Depth Limiting
    - Implement Property 25: Multi-Cloud Resource Unification
    - Implement Property 26: API Call Retry on Failure
    - Implement Property 27: Discovery Event Queueing on Database Unavailability
    - Implement Property 28: Graceful Degradation on LLM Unavailability
    - Implement Property 29: Configuration Validation on Startup
    - Implement Property 30: IaC Parsing Round-Trip
    - Implement Property 31: IaC Parse Error Reporting
    - Implement Property 32: Cross-Platform Path Normalization
    - Implement Property 33: Container Non-Root Execution
    - _Requirements: 26.8_

  - [ ]* 21.3 Write property test for API call retry on failure
    - **Property 26: API Call Retry on Failure**
    - **Validates: Requirements 23.1**
    - Verify retries with exponential backoff on transient errors
    - _Requirements: 26.8_

  - [ ]* 21.4 Write property test for discovery event queueing on database unavailability
    - **Property 27: Discovery Event Queueing on Database Unavailability**
    - **Validates: Requirements 23.3**
    - Verify events queued when database unavailable
    - _Requirements: 26.8_

  - [ ]* 21.5 Write property test for graceful degradation on LLM unavailability
    - **Property 28: Graceful Degradation on LLM Unavailability**
    - **Validates: Requirements 23.4**
    - Verify fallback message displayed when LLM unavailable
    - _Requirements: 26.8_

  - [ ]* 21.6 Write property test for cross-platform path normalization
    - **Property 32: Cross-Platform Path Normalization**
    - **Validates: Requirements 38.1, 38.2, 38.4, 38.5**
    - Verify paths normalized to forward slashes on all platforms
    - _Requirements: 26.8_

  - [ ]* 21.7 Write property test for container non-root execution
    - **Property 33: Container Non-Root Execution**
    - **Validates: Requirements 33.1**
    - Verify all containers run as non-root user
    - _Requirements: 26.8_

  - [x] 21.8 Implement integration test suite
    - Add integration tests for API endpoints
    - Add integration tests for discovery workflows
    - Add integration tests for conversational interface
    - Add integration tests for infrastructure actions
    - _Requirements: 26.2_

  - [x] 21.9 Implement E2E test suite
    - Add E2E tests for installation wizard
    - Add E2E tests for dashboard critical flows
    - Add E2E tests for discovery and visualization
    - Add E2E tests for conversational queries
    - _Requirements: 26.3_

  - [x] 21.10 Perform security testing
    - Run container vulnerability scanning with Trivy
    - Run dependency vulnerability scanning with npm audit
    - Perform SAST with SonarQube or CodeQL
    - Test API authentication bypass attempts
    - Test injection attacks (SQL/Cypher, XSS, CSRF)
    - Test rate limiting bypass attempts
    - Document security findings and remediation
    - _Requirements: 26.1_

  - [x] 21.11 Perform performance testing
    - Test API with 100 concurrent requests
    - Test discovery of 1,000 resources (target: < 5 minutes)
    - Test graph queries with 10,000 nodes (target: < 500ms)
    - Test dashboard rendering with 500 nodes (target: < 2 seconds)
    - Test conversational interface response time (target: < 3 seconds)
    - Document performance benchmarks
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 26.9_

  - [x] 21.12 Implement cross-platform compatibility
    - Test on Linux (Ubuntu, Fedora)
    - Test on macOS (Intel and Apple Silicon)
    - Test on Windows 10/11 with WSL2
    - Test Docker Desktop on macOS and Windows
    - Test Docker Engine on Linux
    - Verify path handling across platforms
    - Verify line ending handling (.gitattributes)
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 38.1, 38.2, 38.3, 38.4, 38.5, 38.6, 38.7, 38.8_

  - [~] 21.13 Implement local development optimizations
    - Configure hot reload for all services
    - Setup VS Code debug configurations
    - Optimize Docker layer caching
    - Implement resource limits (total: 4GB RAM)
    - Create minimal profile for essential services only
    - Document minimum system requirements
    - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8, 35.9, 35.10, 37.1, 37.2, 37.3, 37.4, 37.5, 37.6, 37.7, 37.8, 37.9, 37.10_

  - [~] 21.14 Implement data seeding for local development
    - Create data seeding script with sample infrastructure
    - Implement small scenario (10 resources)
    - Implement medium scenario (100 resources)
    - Implement large scenario (1,000 resources)
    - Create sample resource relationships and dependencies
    - Provide sample conversational queries
    - Document test data schema
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6, 36.7, 36.8, 36.9, 36.10_

  - [~] 21.15 Fix bugs and issues identified during testing
    - Address all critical and high-severity bugs
    - Address performance bottlenecks
    - Address security vulnerabilities
    - Address usability issues
    - _Requirements: 26.1, 26.2, 26.3_

- [~] 22. Checkpoint - Testing and Hardening Complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 23. Phase 12: Documentation and Release
  - [~] 23.1 Implement IaC parser and pretty printer (packages/iac)
    - Implement Terraform HCL parser
    - Implement CloudFormation YAML parser
    - Implement Resource_Model to Terraform HCL pretty printer
    - Implement Resource_Model to CloudFormation YAML pretty printer
    - Implement round-trip validation (parse → print → parse)
    - Implement parse error reporting with line numbers
    - Support Terraform versions 1.0+
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9, 27.10_

  - [ ]* 23.2 Write property test for IaC parsing round-trip
    - **Property 30: IaC Parsing Round-Trip**
    - **Validates: Requirements 27.9**
    - Verify parse → print → parse produces equivalent resource
    - _Requirements: 26.8_

  - [ ]* 23.3 Write property test for IaC parse error reporting
    - **Property 31: IaC Parse Error Reporting**
    - **Validates: Requirements 27.5, 27.6**
    - Verify descriptive errors with line numbers for invalid files
    - _Requirements: 26.8_

  - [~] 23.4 Implement SDK packages (packages/sdk)
    - Create TypeScript SDK with all API methods
    - Create Python SDK with all API methods
    - Implement authentication helpers
    - Implement event subscription support
    - Implement custom discovery agent registration
    - Implement custom chatbot command registration
    - Provide type definitions for TypeScript
    - Create SDK examples for common patterns
    - Publish TypeScript SDK to npm
    - Publish Python SDK to PyPI
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10_

  - [ ]* 23.5 Write unit tests for SDK packages
    - Test TypeScript SDK methods
    - Test Python SDK methods
    - Test authentication helpers
    - Test event subscriptions
    - _Requirements: 26.1_

  - [~] 23.6 Write comprehensive user documentation
    - Write installation guide for all platforms (Linux, macOS, Windows)
    - Write getting started guide
    - Write configuration reference
    - Write CLI command reference
    - Write API documentation (REST and GraphQL)
    - Write conversational interface guide
    - Write troubleshooting guide
    - Write FAQ
    - _Requirements: 22.2, 22.6, 22.7_

  - [~] 23.7 Write developer documentation
    - Write architecture overview
    - Write component documentation for all packages
    - Write contribution guidelines
    - Write development setup guide
    - Write testing guide
    - Write release process documentation
    - _Requirements: 22.8_

  - [~] 23.8 Create landing page (apps/landing)
    - Design and implement landing page with Next.js
    - Add project overview and features
    - Add architecture diagrams
    - Add example use cases
    - Add installation instructions
    - Add links to documentation
    - Add GitHub repository link
    - Deploy to public URL (GitHub Pages or Vercel)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.10_

  - [~] 23.9 Create tutorial content
    - Create video tutorial for installation
    - Create video tutorial for basic usage
    - Create video tutorial for conversational interface
    - Create written tutorials for common workflows
    - _Requirements: 22.5_

  - [~] 23.10 Prepare for open-source release
    - Create LICENSE file (choose open-source license)
    - Create comprehensive README.md
    - Create CONTRIBUTING.md
    - Create CODE_OF_CONDUCT.md
    - Create SECURITY.md with vulnerability reporting process
    - Create issue templates for GitHub
    - Create pull request template
    - Create changelog (CHANGELOG.md)
    - Tag v1.0.0 release
    - _Requirements: 22.8, 22.9_

  - [~] 23.11 Publish container images
    - Build production container images
    - Tag images with version numbers
    - Publish to Docker Hub or GitHub Container Registry
    - Document image usage
    - _Requirements: 19.10_

  - [~] 23.12 Setup observability integrations
    - Create Prometheus configuration examples
    - Create Grafana dashboard templates
    - Document OpenTelemetry integration
    - Document Datadog integration (optional)
    - _Requirements: 25.10_

- [~] 24. Final Checkpoint - Release Ready
  - Ensure all tests pass, documentation is complete, and release artifacts are ready.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties from the design document
- Unit tests validate specific examples, edge cases, and integration points
- Checkpoints ensure incremental validation and user feedback opportunities
- The implementation follows a 12-phase plan spanning 24 weeks
- Cross-platform compatibility (Linux, macOS, Windows) is tested throughout
- Security hardening is applied at every layer (containers, credentials, API, network)
- Local development experience is optimized with hot reload and minimal resource usage
