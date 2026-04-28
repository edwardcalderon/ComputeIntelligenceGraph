# Requirements Document

## Introduction

This feature replaces the Cloudflare Tunnel (`cloudflared`) connectivity layer in the free-tier LLM API proxy system with an AWS-native solution, and evaluates whether DynamoDB or Aurora Serverless is the better state management backend. The system proxies OpenAI-compatible API requests from clients through an AWS Lambda + API Gateway (Hono/TypeScript) proxy to a Google Colab instance running Ollama for GPU inference. The core challenge is that Google Colab can make outbound HTTPS connections but cannot receive inbound connections, so the AWS-native replacement must use a pull-based or bidirectional pattern (e.g., SQS polling, API Gateway WebSocket, or AWS IoT Core MQTT) instead of a tunnel.

## Glossary

- **Proxy_Lambda**: The AWS Lambda function running the Hono TypeScript application that receives client API requests via API Gateway and forwards them to the Colab_Worker
- **API_Gateway**: The AWS API Gateway (HTTP API) that exposes the Proxy_Lambda to the internet with OpenAI-compatible REST endpoints
- **Colab_Worker**: The Google Colab notebook process that runs Ollama for GPU inference and communicates with AWS services to receive inference requests and return responses
- **Request_Queue**: The AWS SQS queue that holds pending inference requests placed by the Proxy_Lambda for the Colab_Worker to consume
- **Response_Queue**: The AWS SQS queue that holds completed inference responses placed by the Colab_Worker for the Proxy_Lambda to consume
- **State_Store**: The AWS service (DynamoDB or Aurora Serverless) that persists session metadata, heartbeat timestamps, and connectivity status for the Colab_Worker
- **Heartbeat**: A periodic signal sent by the Colab_Worker to the State_Store indicating the worker is alive and processing requests
- **Session**: A single Colab_Worker runtime period (up to ~11 hours on Google Colab free tier) identified by a unique session ID
- **Correlation_ID**: A unique identifier assigned to each inference request, used to match responses from the Response_Queue back to the originating client request
- **Ollama**: The open-source LLM inference server running on the Colab_Worker that serves models locally
- **MCP_Endpoint**: Model Context Protocol tool endpoints exposed by the Proxy_Lambda for agent-based tool use
- **Dead_Letter_Queue**: An SQS queue that receives messages that could not be processed after the maximum number of receive attempts
- **Visibility_Timeout**: The SQS parameter that controls how long a message is hidden from other consumers after being received
- **Free_Tier**: AWS services used within the AWS Free Tier limits (12-month introductory or always-free), targeting $0/month operational cost

## Requirements

### Requirement 1: SQS-Based Request Delivery

**User Story:** As a client application, I want my inference requests to be reliably delivered to the Colab_Worker without requiring a direct inbound connection, so that the system works within Google Colab's networking constraints.

#### Acceptance Criteria

1. WHEN the Proxy_Lambda receives a valid inference request, THE Proxy_Lambda SHALL place a message on the Request_Queue containing the request payload and a unique Correlation_ID
2. WHILE the Colab_Worker is active, THE Colab_Worker SHALL poll the Request_Queue using SQS long polling with a wait time of up to 20 seconds
3. WHEN the Colab_Worker receives a message from the Request_Queue, THE Colab_Worker SHALL delete the message from the Request_Queue after successful receipt
4. THE Request_Queue SHALL be configured with a Visibility_Timeout of at least 120 seconds to prevent duplicate processing of long-running inference requests
5. IF a message on the Request_Queue exceeds the maximum receive count of 3, THEN THE Request_Queue SHALL move the message to the Dead_Letter_Queue
6. WHEN the Proxy_Lambda places a message on the Request_Queue, THE Proxy_Lambda SHALL include a MessageGroupId derived from the client session to preserve request ordering for FIFO queues, OR use a standard queue if ordering is not required

### Requirement 2: SQS-Based Response Delivery

**User Story:** As a client application, I want to receive inference responses matched to my original request, so that I get the correct completion result.

#### Acceptance Criteria

1. WHEN the Colab_Worker completes an inference request, THE Colab_Worker SHALL place the response on the Response_Queue with the same Correlation_ID from the original request
2. WHEN the Proxy_Lambda is waiting for a response, THE Proxy_Lambda SHALL poll the Response_Queue filtering by Correlation_ID for up to 90 seconds before timing out
3. IF the Proxy_Lambda does not receive a matching response within 90 seconds, THEN THE Proxy_Lambda SHALL return an HTTP 504 Gateway Timeout to the client
4. WHEN the Proxy_Lambda receives a matching response from the Response_Queue, THE Proxy_Lambda SHALL return the inference result to the client in OpenAI-compatible JSON format
5. THE Response_Queue SHALL be configured with a message retention period of 300 seconds to prevent stale responses from accumulating
6. FOR ALL valid inference requests, submitting a request and receiving the correlated response SHALL preserve the original request's Correlation_ID (round-trip correlation property)

### Requirement 3: Colab Worker Lifecycle Management

**User Story:** As a system operator, I want the Colab_Worker to register itself on startup and send periodic heartbeats, so that the Proxy_Lambda knows whether a worker is available to process requests.

#### Acceptance Criteria

1. WHEN the Colab_Worker starts a new Session, THE Colab_Worker SHALL register itself in the State_Store with a unique session ID, start timestamp, and an initial heartbeat timestamp
2. WHILE the Colab_Worker is active, THE Colab_Worker SHALL update the heartbeat timestamp in the State_Store at an interval no greater than 60 seconds
3. WHEN the Proxy_Lambda receives an inference request, THE Proxy_Lambda SHALL check the State_Store for a heartbeat timestamp within the last 120 seconds before enqueuing the request
4. IF the Proxy_Lambda detects that the most recent heartbeat is older than 120 seconds, THEN THE Proxy_Lambda SHALL return an HTTP 503 Service Unavailable response to the client with a message indicating no active worker
5. WHEN the Colab_Worker shuts down gracefully, THE Colab_Worker SHALL update the State_Store to mark the Session as terminated
6. THE State_Store SHALL support TTL-based automatic expiration of session records older than 24 hours

### Requirement 4: State Store Evaluation and Implementation

**User Story:** As a system architect, I want the state management layer to use the most cost-effective and operationally simple AWS service, so that the system remains within Free_Tier limits and is easy to maintain.

#### Acceptance Criteria

1. THE State_Store SHALL operate within AWS Free_Tier limits, consuming no more than 25 read capacity units and 25 write capacity units per second for DynamoDB, or remaining within Aurora Serverless v1 free-tier ACU-hours if Aurora is selected
2. THE State_Store SHALL support key-value lookups by session ID with a read latency of less than 50 milliseconds under normal load
3. THE State_Store SHALL support conditional writes to prevent concurrent session registration conflicts
4. THE State_Store SHALL support TTL-based automatic deletion of expired records without manual cleanup
5. IF DynamoDB is selected as the State_Store, THEN THE State_Store SHALL use a single-table design with a partition key of session ID and sort key for record type
6. IF Aurora Serverless is selected as the State_Store, THEN THE State_Store SHALL use auto-pause after 5 minutes of inactivity to minimize cost, and the design document SHALL document the cold-start latency impact
7. THE design document SHALL include a comparison matrix evaluating DynamoDB and Aurora Serverless across cost, complexity, query patterns, auto-scaling, TTL support, and cold-start implications, with a justified recommendation

### Requirement 5: OpenAI-Compatible API Preservation

**User Story:** As a client application developer, I want the API interface to remain unchanged after the infrastructure migration, so that existing integrations continue to work without modification.

#### Acceptance Criteria

1. THE Proxy_Lambda SHALL continue to expose a POST /v1/completions endpoint that accepts OpenAI-compatible request payloads validated with Zod schemas
2. THE Proxy_Lambda SHALL continue to expose a POST /v1/chat/completions endpoint that accepts OpenAI-compatible chat request payloads
3. THE Proxy_Lambda SHALL continue to expose a GET /v1/models endpoint that returns available model information
4. THE Proxy_Lambda SHALL continue to expose health check, admin, and MCP_Endpoint routes with the same path structure and response formats as the current implementation
5. WHEN the Proxy_Lambda returns an inference response, THE Proxy_Lambda SHALL format the response body to match the OpenAI completions API response schema including id, object, created, model, choices, and usage fields
6. THE Proxy_Lambda SHALL continue to enforce rate limiting and authentication middleware on all inference endpoints

### Requirement 6: Infrastructure as Code

**User Story:** As a DevOps engineer, I want all new AWS resources to be defined in a standalone SST infrastructure config within the llm-proxy package, so that deployments are repeatable, version-controlled, and fully independent from the existing CIG API infrastructure.

#### Acceptance Criteria

1. THE infrastructure code SHALL define the Request_Queue, Response_Queue, and Dead_Letter_Queue as SQS resources within a standalone SST configuration in `packages/llm-proxy/`
2. THE infrastructure code SHALL define IAM roles granting the Proxy_Lambda permission to send messages to the Request_Queue and receive messages from the Response_Queue
3. THE infrastructure code SHALL define IAM roles or credentials for the Colab_Worker to receive messages from the Request_Queue and send messages to the Response_Queue
4. THE infrastructure code SHALL define the State_Store (DynamoDB table) with the appropriate schema, capacity settings, and TTL configuration
5. WHEN the infrastructure is deployed, THE deployment SHALL complete without errors and all resources SHALL be prefixed with `llm-proxy-` to avoid naming conflicts with existing CIG API resources
6. THE infrastructure code SHALL configure all SQS queues with encryption at rest using AWS-managed KMS keys
7. THE `packages/llm-proxy/` package SHALL have ZERO imports from or dependencies on any `@cig/*` package, and SHALL be deployable independently using its own SST config

### Requirement 7: Colab Worker AWS Integration

**User Story:** As a system operator, I want the Colab notebook to communicate with AWS services using secure, minimal-privilege credentials, so that the system is secure and the Colab_Worker can function as a request processor.

#### Acceptance Criteria

1. THE Colab_Worker SHALL authenticate to AWS using IAM credentials (access key and secret key) scoped to only the required SQS and State_Store permissions
2. THE Colab_Worker SHALL use the AWS SDK (boto3 for Python or aws-sdk for TypeScript) to interact with the Request_Queue, Response_Queue, and State_Store
3. WHEN the Colab_Worker receives a request message from the Request_Queue, THE Colab_Worker SHALL forward the request payload to the local Ollama instance on localhost:11434
4. WHEN the Ollama instance returns an inference response, THE Colab_Worker SHALL place the response on the Response_Queue with the matching Correlation_ID within 5 seconds of receiving the Ollama response
5. IF the Ollama instance returns an error or times out, THEN THE Colab_Worker SHALL place an error response on the Response_Queue with the matching Correlation_ID and an appropriate error code
6. THE Colab_Worker IAM credentials SHALL follow the principle of least privilege, granting only sqs:ReceiveMessage, sqs:DeleteMessage on the Request_Queue, sqs:SendMessage on the Response_Queue, and the minimum State_Store read/write permissions

### Requirement 8: Monitoring and Alerting

**User Story:** As a system operator, I want visibility into the health and performance of the SQS-based communication layer, so that I can detect and respond to issues quickly.

#### Acceptance Criteria

1. WHEN the Request_Queue depth exceeds 10 messages for more than 5 minutes, THE monitoring system SHALL trigger an SNS alert to the configured email address
2. WHEN the Dead_Letter_Queue receives a message, THE monitoring system SHALL trigger an SNS alert to the configured email address
3. WHILE the system is operational, THE Proxy_Lambda SHALL log each request enqueue and response dequeue event with the Correlation_ID, timestamps, and latency metrics to CloudWatch
4. THE monitoring system SHALL use CloudWatch alarms configured through the infrastructure code, reusing the existing SNS topic for email alerts
5. WHEN the Colab_Worker heartbeat is missed for more than 120 seconds, THE monitoring system SHALL trigger an SNS alert indicating the worker is offline

### Requirement 9: Graceful Degradation and Error Handling

**User Story:** As a client application, I want clear error responses when the system is degraded, so that I can implement appropriate retry or fallback logic.

#### Acceptance Criteria

1. IF the Request_Queue is unreachable, THEN THE Proxy_Lambda SHALL return an HTTP 502 Bad Gateway response with a JSON error body indicating a queue connectivity failure
2. IF the Colab_Worker is not registered or the heartbeat has expired, THEN THE Proxy_Lambda SHALL return an HTTP 503 Service Unavailable response with a JSON error body including a retryAfter field
3. IF the SQS SendMessage operation fails, THEN THE Proxy_Lambda SHALL retry the operation up to 2 times with exponential backoff before returning an error to the client
4. WHEN the Proxy_Lambda returns an error response, THE Proxy_Lambda SHALL use a consistent JSON error schema containing fields: error, message, code, and requestId
5. IF the Colab_Worker encounters an unrecoverable error during inference, THEN THE Colab_Worker SHALL continue processing subsequent requests from the Request_Queue without terminating the polling loop

### Requirement 10: Free Tier Cost Compliance

**User Story:** As a system operator, I want the entire AWS infrastructure to remain within Free_Tier limits, so that the system costs $0/month during the first 12 months.

#### Acceptance Criteria

1. THE SQS queues SHALL remain within the AWS Free_Tier limit of 1 million requests per month across all queues combined
2. THE Proxy_Lambda SHALL remain within the AWS Lambda Free_Tier limit of 1 million invocations and 400,000 GB-seconds of compute per month
3. THE API_Gateway SHALL remain within the AWS API Gateway Free_Tier limit of 1 million HTTP API calls per month
4. THE State_Store SHALL remain within the applicable Free_Tier limits for the selected service (25 RCU/WCU for DynamoDB on-demand, or ACU-hours for Aurora Serverless)
5. THE CloudWatch alarms SHALL use no more than 10 alarms to remain within the Free_Tier limit of 10 alarms
6. THE design document SHALL include a cost estimation table showing expected monthly usage for each AWS service against its Free_Tier limit, assuming a workload of up to 1,000 inference requests per day
