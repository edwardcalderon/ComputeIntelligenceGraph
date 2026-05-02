# Requirements Document

## Introduction

This feature adds a GPU management dashboard to the existing CIG dashboard application (`apps/dashboard/`). The dashboard provides a UI for monitoring, managing, and troubleshooting GPU compute sessions orchestrated by the `packages/gpu-orchestrator/` package. It surfaces session lifecycle data, health monitoring, structured logs, configuration, and activity timelines through new pages under the `/gpu` route group. The dashboard reads data from the CIG API (`NEXT_PUBLIC_API_URL`) via new API endpoints that query the `llm-proxy-state` DynamoDB table and the orchestrator's health endpoint. The UI follows the existing dashboard patterns: Next.js 14 App Router, Tailwind CSS with CIG design tokens, TanStack React Query for data fetching, Zustand for local state, and the `@cig-technology/i18n` package for internationalization.

## Glossary

- **GPU_Dashboard**: The set of Next.js pages and components under the `/gpu` route group in `apps/dashboard/` that provide the management UI for GPU compute sessions
- **GPU_API**: The set of backend API endpoints (served at `NEXT_PUBLIC_API_URL`) that expose GPU orchestrator data (sessions, health, logs, config, activity) to the dashboard
- **Session_List_View**: The page at `/gpu` that displays a table of all active and recent GPU compute sessions with summary information
- **Session_Detail_View**: The page at `/gpu/sessions/[sessionId]` that displays detailed information about a single GPU compute session
- **Health_Dashboard**: The page at `/gpu/health` that displays real-time health status of all monitored GPU sessions
- **Logs_Viewer**: The page at `/gpu/logs` that displays structured JSON log entries from the GPU orchestrator
- **Config_View**: The page at `/gpu/config` that displays the current orchestrator configuration with sensitive values redacted
- **Activity_Timeline**: The page at `/gpu/activity` that displays a chronological feed of orchestrator events
- **Session_Card**: A UI component that displays a summary of a single GPU session (status, provider, models, uptime, health indicator)
- **Health_Indicator**: A visual component (colored dot or badge) that represents the health status of a session (healthy, unhealthy, no_data)
- **Orchestrator_Record**: A DynamoDB record with PK `ORCHESTRATOR#{sessionId}` and SK `META` containing session metadata written by the GPU orchestrator
- **Worker_Heartbeat**: The `SESSION#LATEST` DynamoDB record written by the Colab worker, containing `lastHeartbeatAt` and `status` fields
- **Health_Endpoint_Response**: The JSON response from the orchestrator's HTTP health endpoint containing `status`, `metadata`, and `health` fields
- **CIG_API**: The existing backend API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3003`) that the dashboard communicates with via the CigClient SDK
- **StatCard**: An existing dashboard component that displays a labeled metric value with optional color accent and loading state
- **Data_Provider**: The Refine.dev data provider in `apps/dashboard/lib/dataProvider.ts` that maps resource names to API paths

## Requirements

### Requirement 1: GPU Dashboard Navigation and Routing

**User Story:** As a dashboard user, I want to access the GPU management pages from the sidebar navigation, so that I can monitor and manage GPU compute sessions alongside other CIG platform features.

#### Acceptance Criteria

1. THE GPU_Dashboard SHALL add a "GPU Compute" navigation section to the Sidebar component between the existing "Platform" and "Operations" sections
2. THE GPU_Dashboard SHALL register the following routes under the `(dashboard)/gpu` App Router route group: `/gpu` (sessions overview), `/gpu/sessions/[sessionId]` (session detail), `/gpu/health` (health dashboard), `/gpu/logs` (logs viewer), `/gpu/config` (configuration), and `/gpu/activity` (activity timeline)
3. WHEN a user navigates to any `/gpu/*` route, THE GPU_Dashboard SHALL highlight the corresponding navigation item in the Sidebar
4. THE GPU_Dashboard SHALL include navigation items for: "Sessions" (`/gpu`), "Health" (`/gpu/health`), "Logs" (`/gpu/logs`), "Config" (`/gpu/config`), and "Activity" (`/gpu/activity`)
5. THE GPU_Dashboard SHALL use the existing `(dashboard)/layout.tsx` layout (Sidebar, Header, Footer, ChatWidget) for all GPU pages
6. THE GPU_Dashboard SHALL add i18n translation keys for all GPU navigation labels and page titles using the `@cig-technology/i18n` package

### Requirement 2: GPU Sessions Overview Page

**User Story:** As a system operator, I want to see a list of all active and recent GPU compute sessions, so that I can quickly assess the state of the GPU infrastructure.

#### Acceptance Criteria

1. WHEN a user navigates to `/gpu`, THE Session_List_View SHALL display a grid of StatCard components showing aggregate metrics: total active sessions, total unhealthy sessions, average session uptime, and total available models
2. WHEN a user navigates to `/gpu`, THE Session_List_View SHALL display a table of all GPU sessions with columns: Session ID, Status, Provider, Models, Started At, Uptime, and Health_Indicator
3. THE Session_List_View SHALL fetch session data from the GPU_API endpoint `GET /api/v1/gpu/sessions` using TanStack React Query with a polling interval of 30 seconds
4. WHEN the session data is loading, THE Session_List_View SHALL display skeleton loading states consistent with the existing dashboard loading patterns
5. THE Session_List_View SHALL color-code session status values: `running` in green, `connected` in blue, `creating` in yellow, `disconnected` in orange, `error` in red, and `terminated` in gray
6. WHEN a user clicks on a session row, THE Session_List_View SHALL navigate to the Session_Detail_View at `/gpu/sessions/[sessionId]`
7. THE Session_List_View SHALL support filtering sessions by status using a dropdown filter control
8. IF the GPU_API returns an error, THEN THE Session_List_View SHALL display an error message with a retry button

### Requirement 3: Session Detail View

**User Story:** As a system operator, I want to view detailed information about a specific GPU session, so that I can diagnose issues and understand session behavior.

#### Acceptance Criteria

1. WHEN a user navigates to `/gpu/sessions/[sessionId]`, THE Session_Detail_View SHALL display session metadata: session ID, status, provider, models list, creation timestamp, last verified timestamp, and TTL expiry
2. THE Session_Detail_View SHALL display the latest health check result including both health dimensions (session status and worker heartbeat) with their individual healthy/unhealthy states and latency values
3. THE Session_Detail_View SHALL display the worker heartbeat information: last heartbeat timestamp, heartbeat age in seconds, and freshness status (healthy if age is within the configured threshold)
4. THE Session_Detail_View SHALL fetch session data from `GET /api/v1/gpu/sessions/[sessionId]` using TanStack React Query with a polling interval of 15 seconds
5. THE Session_Detail_View SHALL provide action buttons for: "Stop Session" (triggers session destruction) and "Restart Worker" (triggers worker restart within the existing session)
6. WHEN a user clicks "Stop Session", THE Session_Detail_View SHALL display a confirmation dialog before sending a `DELETE /api/v1/gpu/sessions/[sessionId]` request to the GPU_API
7. WHEN a user clicks "Restart Worker", THE Session_Detail_View SHALL send a `POST /api/v1/gpu/sessions/[sessionId]/restart-worker` request to the GPU_API
8. IF the session ID does not exist, THEN THE Session_Detail_View SHALL display a "Session not found" message with a link back to the sessions overview
9. THE Session_Detail_View SHALL display a section showing recent log entries filtered to the current session ID

### Requirement 4: Health Monitoring Dashboard

**User Story:** As a system operator, I want a real-time health overview of all GPU sessions, so that I can quickly identify and respond to failures.

#### Acceptance Criteria

1. WHEN a user navigates to `/gpu/health`, THE Health_Dashboard SHALL display a summary row of StatCard components showing: total healthy sessions, total unhealthy sessions, total sessions with no health data, and the oldest heartbeat age across all sessions
2. THE Health_Dashboard SHALL display a card for each active session showing: session ID, overall health status (healthy/unhealthy/no_data), session dimension result, worker heartbeat dimension result, and last check timestamp
3. THE Health_Dashboard SHALL fetch health data from `GET /api/v1/gpu/health` using TanStack React Query with a polling interval of 15 seconds
4. THE Health_Dashboard SHALL use color-coded Health_Indicator components: green for healthy, red for unhealthy, and gray for no_data
5. WHEN a session's health status transitions from healthy to unhealthy, THE Health_Dashboard SHALL visually highlight the affected session card with a red border pulse animation
6. THE Health_Dashboard SHALL display the recovery state for unhealthy sessions: current recovery action type (restart_worker, recreate_session, enter_dormant), consecutive failure count, and next retry time
7. IF the health endpoint is unreachable, THEN THE Health_Dashboard SHALL display a warning banner indicating that health data is unavailable

### Requirement 5: Logs Viewer

**User Story:** As a system operator, I want to view and filter structured logs from the GPU orchestrator, so that I can diagnose issues and understand system behavior.

#### Acceptance Criteria

1. WHEN a user navigates to `/gpu/logs`, THE Logs_Viewer SHALL display a scrollable list of structured log entries in reverse chronological order (newest first)
2. THE Logs_Viewer SHALL display each log entry with fields: timestamp, level (debug/info/warn/error), component name, session ID, and message
3. THE Logs_Viewer SHALL support filtering log entries by: log level (multi-select), component name (dropdown), and session ID (dropdown or text input)
4. THE Logs_Viewer SHALL color-code log levels: `debug` in gray, `info` in blue, `warn` in yellow, and `error` in red
5. THE Logs_Viewer SHALL fetch log data from `GET /api/v1/gpu/logs` using TanStack React Query with pagination (50 entries per page) and a polling interval of 10 seconds for the first page
6. WHEN a user clicks on a log entry, THE Logs_Viewer SHALL expand the entry to show the full JSON payload including optional error details and stack trace
7. THE Logs_Viewer SHALL support a text search input that filters log entries by message content (client-side filtering on the current page)
8. IF no log entries match the current filters, THEN THE Logs_Viewer SHALL display an empty state message indicating no matching logs

### Requirement 6: Configuration View

**User Story:** As a system operator, I want to view the current GPU orchestrator configuration, so that I can verify settings and identify misconfigurations.

#### Acceptance Criteria

1. WHEN a user navigates to `/gpu/config`, THE Config_View SHALL display the current orchestrator configuration as a structured key-value list grouped by category: Provider Settings, AWS Settings, Health Check Settings, and Logging Settings
2. THE Config_View SHALL fetch configuration data from `GET /api/v1/gpu/config` using TanStack React Query with a stale time of 60 seconds
3. THE Config_View SHALL display sensitive configuration values (Google credentials path, OAuth client ID, OAuth client secret) as redacted strings (`***`) as returned by the GPU_API
4. THE Config_View SHALL display non-sensitive values in their resolved form: provider type, model names, AWS region, SQS queue URLs, DynamoDB table name, health check interval, health endpoint port, heartbeat threshold, and log level
5. IF the configuration endpoint returns an error, THEN THE Config_View SHALL display an error message indicating the configuration could not be loaded

### Requirement 7: Activity Timeline

**User Story:** As a system operator, I want to see a chronological feed of GPU orchestrator events, so that I can understand what happened and when.

#### Acceptance Criteria

1. WHEN a user navigates to `/gpu/activity`, THE Activity_Timeline SHALL display a vertical timeline of orchestrator events in reverse chronological order
2. THE Activity_Timeline SHALL display events including: session created, session terminated, session rotated, health check failed, recovery action triggered, worker restarted, and configuration changed
3. EACH event entry in the Activity_Timeline SHALL display: event timestamp, event type (with icon), session ID (if applicable), and a human-readable description
4. THE Activity_Timeline SHALL fetch event data from `GET /api/v1/gpu/activity` using TanStack React Query with pagination (30 events per page) and a polling interval of 30 seconds for the first page
5. THE Activity_Timeline SHALL use distinct icons and colors for each event type: green for creation events, red for failure events, yellow for recovery events, blue for rotation events, and gray for informational events
6. WHEN a user clicks on an event that references a session ID, THE Activity_Timeline SHALL navigate to the Session_Detail_View for that session
7. THE Activity_Timeline SHALL support filtering events by event type using a multi-select dropdown

### Requirement 8: GPU API Endpoints

**User Story:** As the GPU_Dashboard frontend, I need backend API endpoints that expose GPU orchestrator data, so that the dashboard pages can fetch and display session, health, log, configuration, and activity data.

#### Acceptance Criteria

1. THE GPU_API SHALL expose `GET /api/v1/gpu/sessions` that returns a paginated list of all Orchestrator_Record entries from the `llm-proxy-state` DynamoDB table (records with PK prefix `ORCHESTRATOR#`)
2. THE GPU_API SHALL expose `GET /api/v1/gpu/sessions/[sessionId]` that returns a single Orchestrator_Record merged with the latest health check result from the orchestrator's Health_Endpoint_Response
3. THE GPU_API SHALL expose `DELETE /api/v1/gpu/sessions/[sessionId]` that triggers session destruction via the orchestrator
4. THE GPU_API SHALL expose `POST /api/v1/gpu/sessions/[sessionId]/restart-worker` that triggers a worker restart within the specified session
5. THE GPU_API SHALL expose `GET /api/v1/gpu/health` that returns health status for all active sessions by querying each session's health endpoint and the Worker_Heartbeat record from DynamoDB
6. THE GPU_API SHALL expose `GET /api/v1/gpu/logs` that returns paginated structured log entries with support for query parameters: `level`, `component`, `sessionId`, `limit`, and `offset`
7. THE GPU_API SHALL expose `GET /api/v1/gpu/config` that returns the current orchestrator configuration with sensitive values redacted using the `redactConfig()` function from the gpu-orchestrator package
8. THE GPU_API SHALL expose `GET /api/v1/gpu/activity` that returns paginated orchestrator events with support for query parameters: `eventType`, `sessionId`, `limit`, and `offset`
9. THE GPU_API SHALL require authentication via the existing CIG auth mechanism (Authentik/Supabase token validation) for all GPU endpoints
10. IF a GPU_API endpoint encounters a DynamoDB read error, THEN THE GPU_API SHALL return an HTTP 503 response with a JSON body containing an `error` field describing the failure

### Requirement 9: Data Fetching Integration

**User Story:** As a developer, I want the GPU dashboard to use the existing data fetching patterns (CigClient SDK, TanStack React Query, Refine data provider), so that the GPU pages are consistent with the rest of the dashboard.

#### Acceptance Criteria

1. THE GPU_Dashboard SHALL add GPU resource paths to the `resourcePath` mapping in `apps/dashboard/lib/dataProvider.ts` for Refine integration: `gpu-sessions` mapped to `/api/v1/gpu/sessions`, `gpu-health` mapped to `/api/v1/gpu/health`, `gpu-logs` mapped to `/api/v1/gpu/logs`, `gpu-config` mapped to `/api/v1/gpu/config`, and `gpu-activity` mapped to `/api/v1/gpu/activity`
2. THE GPU_Dashboard SHALL create a `apps/dashboard/lib/gpuApi.ts` module that exports typed fetch functions for each GPU_API endpoint, following the pattern established in `apps/dashboard/lib/api.ts`
3. THE GPU_Dashboard SHALL define TypeScript interfaces for all GPU_API response types in a `apps/dashboard/types/gpu.ts` file, including: `GpuSession`, `GpuSessionDetail`, `GpuHealthSummary`, `GpuSessionHealth`, `GpuLogEntry`, `GpuConfig`, and `GpuActivityEvent`
4. THE GPU_Dashboard SHALL use TanStack React Query hooks with appropriate query keys namespaced under `["gpu", ...]` to avoid cache collisions with existing dashboard queries
5. WHEN the user's authentication token expires while viewing a GPU page, THE GPU_Dashboard SHALL handle the token refresh transparently using the existing `resolveDashboardAccessToken` mechanism

### Requirement 10: Session Management Actions

**User Story:** As a system operator, I want to perform management actions on GPU sessions from the dashboard, so that I can control the GPU infrastructure without using the CLI.

#### Acceptance Criteria

1. THE Session_List_View SHALL provide a "New Session" button that opens a dialog for creating a new GPU session with fields for: provider type (dropdown), model names (comma-separated text input), and an optional configuration override
2. WHEN a user submits the "New Session" dialog, THE GPU_Dashboard SHALL send a `POST /api/v1/gpu/sessions` request to the GPU_API and display a loading indicator until the session reaches `connected` status or an error occurs
3. WHEN a session management action (create, stop, restart) succeeds, THE GPU_Dashboard SHALL invalidate the relevant TanStack React Query caches to trigger a data refresh
4. WHEN a session management action fails, THE GPU_Dashboard SHALL display an error notification with the error message returned by the GPU_API
5. THE GPU_Dashboard SHALL disable management action buttons while a request is in flight to prevent duplicate submissions
6. WHILE a session is in `creating` status, THE Session_Detail_View SHALL display a progress indicator showing the current setup phase (uploading notebook, connecting runtime, installing Ollama, pulling models, starting worker)

### Requirement 11: Responsive Layout and Accessibility

**User Story:** As a dashboard user, I want the GPU pages to be responsive and accessible, so that I can use them on different screen sizes and with assistive technologies.

#### Acceptance Criteria

1. THE GPU_Dashboard SHALL use responsive grid layouts that adapt from single-column on mobile (below 640px) to multi-column on desktop, consistent with the existing dashboard pages
2. THE GPU_Dashboard SHALL use the existing CIG design tokens (--cig-primary, --cig-secondary, --cig-muted, --cig-base, --cig-card, --cig-accent) for all colors and styling
3. THE GPU_Dashboard SHALL ensure all interactive elements (buttons, links, filters, table rows) are keyboard-navigable and have visible focus indicators
4. THE GPU_Dashboard SHALL provide ARIA labels for all Health_Indicator components describing the health status (e.g., "Session health: healthy", "Worker heartbeat: unhealthy")
5. THE GPU_Dashboard SHALL ensure color-coded status indicators are accompanied by text labels so that status information is not conveyed by color alone
6. THE GPU_Dashboard SHALL support both light and dark themes using the existing theme mechanism in the Zustand store

### Requirement 12: Error Handling and Loading States

**User Story:** As a dashboard user, I want clear feedback when data is loading or when errors occur, so that I understand the current state of the interface.

#### Acceptance Criteria

1. WHILE GPU_API data is being fetched, THE GPU_Dashboard SHALL display skeleton loading placeholders that match the shape of the expected content
2. IF a GPU_API request fails, THEN THE GPU_Dashboard SHALL display an inline error message with a "Retry" button that re-triggers the failed query
3. IF the GPU_API returns an empty dataset (no sessions, no logs, no events), THEN THE GPU_Dashboard SHALL display a contextual empty state message with guidance (e.g., "No GPU sessions found. Start a new session to get started.")
4. THE GPU_Dashboard SHALL use TanStack React Query's `retry` option set to 1 for all GPU queries, consistent with the existing QueryClient configuration
5. WHEN a mutation (create, stop, restart) is in progress, THE GPU_Dashboard SHALL display a loading spinner on the action button and disable other action buttons on the same session
