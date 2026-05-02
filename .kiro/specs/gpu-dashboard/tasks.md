# Implementation Plan: GPU Dashboard

## Overview

This plan implements the GPU management dashboard for the CIG platform. The implementation follows a bottom-up approach: TypeScript types and shared utilities first, then the API/data layer, reusable components, page implementations, sidebar integration, and finally tests. All code is TypeScript/React following existing dashboard conventions (Next.js 14 App Router, Tailwind CSS with CIG design tokens, TanStack React Query, Zustand, Refine.dev, CigClient SDK, `@cig-technology/i18n`).

## Tasks

- [x] 1. Define TypeScript types and shared utilities
  - [x] 1.1 Create GPU TypeScript interfaces in `apps/dashboard/types/gpu.ts`
    - Define all interfaces: `PaginatedResponse<T>`, `GpuSessionStatus`, `GpuSession`, `GpuHealthDimension`, `GpuSessionHealthDimension`, `GpuWorkerHeartbeatDimension`, `GpuHealthCheck`, `GpuRecoveryState`, `GpuSessionDetail`, `GpuSessionHealth`, `GpuHealthSummary`, `GpuLogLevel`, `GpuLogEntry`, `GpuConfig`, `GpuConfigEntry`, `GpuActivityEventType`, `GpuActivityEvent`, `GpuSessionCreateRequest`, `GpuSetupPhase`
    - Follow the exact type definitions from the design document Data Models section
    - _Requirements: 9.3_

  - [x] 1.2 Create GPU utility functions for status color mapping, health indicator config, log level colors, and activity event icon/color mapping
    - Create a `apps/dashboard/lib/gpuUtils.ts` module exporting pure functions: `getSessionStatusColor(status: GpuSessionStatus)`, `getHealthStatusConfig(status)`, `getLogLevelColor(level: GpuLogLevel)`, `getActivityEventConfig(eventType: GpuActivityEventType)`
    - Implement the `isGpuRouteActive(pathname: string, href: string)` function for sidebar active state detection (exact match for `/gpu`, prefix match for sub-routes)
    - Implement `filterSessionsByStatus`, `filterLogEntries`, `filterActivityEvents`, `sortReverseChronological` pure utility functions
    - Use the status-to-Tailwind-class mappings from the design document (Status Color Mapping and Activity Event Color/Icon Mapping tables)
    - _Requirements: 2.5, 4.4, 5.4, 7.5_

  - [x] 1.3 Create GPU React Query key factory in `apps/dashboard/lib/gpuUtils.ts`
    - Define the `gpuKeys` object with namespaced query keys: `all`, `sessions`, `session(id)`, `health`, `logs`, `config`, `activity`
    - All keys prefixed with `["gpu"]` to avoid cache collisions
    - _Requirements: 9.4_

- [x] 2. Implement API module and data fetching layer
  - [x] 2.1 Create the GPU API module at `apps/dashboard/lib/gpuApi.ts`
    - Export typed fetch functions: `getGpuSessions`, `getGpuSession`, `createGpuSession`, `deleteGpuSession`, `restartGpuWorker`, `getGpuHealth`, `getGpuLogs`, `getGpuConfig`, `getGpuActivity`
    - Use `getDashboardClient()` from `cigClient.ts` for all requests, following the pattern in `lib/api.ts`
    - All functions return properly typed responses using the interfaces from `types/gpu.ts`
    - _Requirements: 9.2, 9.5_

  - [x] 2.2 Add GPU resource paths to the data provider in `apps/dashboard/lib/dataProvider.ts`
    - Add entries to the `resourcePath` map: `"gpu-sessions"` → `/api/v1/gpu/sessions`, `"gpu-health"` → `/api/v1/gpu/health`, `"gpu-logs"` → `/api/v1/gpu/logs`, `"gpu-config"` → `/api/v1/gpu/config`, `"gpu-activity"` → `/api/v1/gpu/activity`
    - _Requirements: 9.1_

  - [x] 2.3 Register GPU Refine resources in `apps/dashboard/app/providers.tsx`
    - Add GPU resources to the `resources` array: `gpu-sessions` (list: `/gpu`, show: `/gpu/sessions/:id`), `gpu-health` (list: `/gpu/health`), `gpu-logs` (list: `/gpu/logs`), `gpu-config` (list: `/gpu/config`), `gpu-activity` (list: `/gpu/activity`)
    - _Requirements: 9.1_

- [x] 3. Checkpoint - Verify types and data layer compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Build reusable GPU components
  - [x] 4.1 Create `HealthIndicator` component at `apps/dashboard/components/gpu/HealthIndicator.tsx`
    - Render a colored dot + text label for health status (`healthy`, `unhealthy`, `no_data`)
    - Include `role="status"` and `aria-label` with status text and optional label prefix (e.g., "Session health: Healthy")
    - Use green for healthy, red for unhealthy, gray for no_data with both light and dark mode Tailwind classes
    - Ensure status is never conveyed by color alone (always include text label)
    - _Requirements: 4.4, 11.4, 11.5_

  - [x] 4.2 Create `StatusBadge` component for session status display
    - Create `apps/dashboard/components/gpu/StatusBadge.tsx` that renders a colored text label for `GpuSessionStatus` values
    - Use the status color mapping from the design: running=green, connected=blue, creating=yellow, disconnected=orange, error=red, terminated=gray
    - Include both color and text so status is accessible
    - _Requirements: 2.5, 11.5_

  - [x] 4.3 Create `LogEntry` component at `apps/dashboard/components/gpu/LogEntry.tsx`
    - Render a single log entry showing: formatted timestamp, color-coded level badge, component name, session ID (or "—" placeholder if null), and message
    - Support collapsed/expanded state; expanded view shows full JSON `details` and optional `error` with stack trace
    - Color-code log levels: debug=gray, info=blue, warn=yellow, error=red
    - _Requirements: 5.2, 5.4, 5.6_

  - [x] 4.4 Create `LogFilters` component at `apps/dashboard/components/gpu/LogFilters.tsx`
    - Render filter controls: log level multi-select, component name dropdown, session ID text input, and text search input
    - Emit filter state changes via callback props
    - _Requirements: 5.3, 5.7_

  - [x] 4.5 Create `TimelineEvent` component at `apps/dashboard/components/gpu/TimelineEvent.tsx`
    - Render a single activity event with: formatted timestamp, event type icon + color, session ID as a clickable link (when non-null), and description text
    - Use the activity event color/icon mapping from the design: session_created=green/plus, session_terminated=red/x, session_rotated=blue/refresh, health_check_failed=red/alert, recovery_triggered=yellow/wrench, worker_restarted=yellow/rotate, config_changed=gray/settings
    - Use `lucide-react` icons (already a dependency)
    - _Requirements: 7.2, 7.3, 7.5_

  - [x] 4.6 Create `EventTypeFilter` component at `apps/dashboard/components/gpu/EventTypeFilter.tsx`
    - Render a multi-select dropdown for filtering by `GpuActivityEventType` values
    - _Requirements: 7.7_

  - [x] 4.7 Create `ConfigGroup` component at `apps/dashboard/components/gpu/ConfigGroup.tsx`
    - Render a grouped key-value list of `GpuConfigEntry` items
    - Display redacted values as `***` when `redacted` is true, otherwise show the actual value
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 4.8 Create `SessionHealthCard` component at `apps/dashboard/components/gpu/SessionHealthCard.tsx`
    - Render a card for a single session showing: session ID, overall health status via `HealthIndicator`, session dimension result, worker heartbeat dimension result, and last check timestamp
    - Include red border pulse animation when status is unhealthy
    - Show recovery state (action type, consecutive failures, next retry) when present
    - _Requirements: 4.2, 4.5, 4.6_

  - [x] 4.9 Create `ConfirmDialog` component at `apps/dashboard/components/gpu/ConfirmDialog.tsx`
    - Generic confirmation dialog with title, message, confirm/cancel buttons
    - Keyboard accessible with focus trapping
    - _Requirements: 3.6, 11.3_

  - [x] 4.10 Create `SessionActionButtons` component at `apps/dashboard/components/gpu/SessionActionButtons.tsx`
    - Render "Stop Session" and "Restart Worker" buttons with loading spinners when mutations are in flight
    - Disable buttons while any request is in progress to prevent duplicate submissions
    - _Requirements: 3.5, 10.5, 12.5_

  - [x] 4.11 Create `NewSessionDialog` component at `apps/dashboard/components/gpu/NewSessionDialog.tsx`
    - Dialog form with fields: provider type dropdown (colab/local), model names comma-separated text input, optional config overrides
    - Submit triggers `POST /api/v1/gpu/sessions` via the `createGpuSession` API function
    - Show loading indicator until session reaches `connected` status or error
    - _Requirements: 10.1, 10.2_

  - [x] 4.12 Create `SessionProgressIndicator` component at `apps/dashboard/components/gpu/SessionProgressIndicator.tsx`
    - Display setup phase progress for sessions in `creating` status: uploading_notebook → connecting_runtime → installing_ollama → pulling_models → starting_worker
    - _Requirements: 10.6_

  - [x] 4.13 Create shared `ErrorState`, `EmptyState`, and `SkeletonLoader` GPU helper components
    - `ErrorState`: inline error message with "Retry" button
    - `EmptyState`: contextual empty state with guidance text
    - `SkeletonLoader`: skeleton placeholders matching expected content shapes
    - Place in `apps/dashboard/components/gpu/` directory
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 5. Checkpoint - Verify all components compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement GPU pages
  - [x] 6.1 Create Sessions Overview page at `apps/dashboard/app/(dashboard)/gpu/page.tsx`
    - Display StatCard grid with aggregate metrics: total active sessions, total unhealthy, average uptime, total models
    - Render a `SessionsTable` with columns: Session ID, Status (via StatusBadge), Provider, Models, Started At, Uptime, Health (via HealthIndicator)
    - Fetch data via `useQuery` with key `gpuKeys.sessions` and `getGpuSessions`, polling every 30s
    - Include `StatusFilter` dropdown for filtering by session status
    - Clicking a row navigates to `/gpu/sessions/[sessionId]`
    - Include `NewSessionDialog` triggered by a "New Session" button
    - Handle loading (skeleton), error (retry), and empty states
    - Invalidate query caches on successful mutations (create, stop)
    - Use responsive grid: single-column on mobile, multi-column on desktop
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 12.1, 12.2, 12.3, 12.4_

  - [x] 6.2 Create Session Detail page at `apps/dashboard/app/(dashboard)/gpu/sessions/[sessionId]/page.tsx`
    - Display session metadata: session ID, status, provider, models list, creation timestamp, last verified, TTL expiry
    - Display health check result with both dimensions (session status + worker heartbeat) via `HealthCheckDisplay`
    - Display worker heartbeat info: last heartbeat timestamp, age in seconds, freshness status
    - Fetch via `useQuery` with key `gpuKeys.session(sessionId)` and `getGpuSession`, polling every 15s
    - Include `SessionActionButtons` (Stop Session, Restart Worker) with `ConfirmDialog` for stop
    - Stop sends `DELETE /api/v1/gpu/sessions/[sessionId]`, restart sends `POST .../restart-worker`
    - Show "Session not found" with link to `/gpu` on 404
    - Include `SessionLogSection` showing recent logs filtered to current session
    - Show `SessionProgressIndicator` when session is in `creating` status
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 10.3, 10.4, 10.5, 10.6, 12.1, 12.2, 12.5_

  - [x] 6.3 Create Health Dashboard page at `apps/dashboard/app/(dashboard)/gpu/health/page.tsx`
    - Display StatCard summary row: total healthy, total unhealthy, total no_data, oldest heartbeat age
    - Render a `SessionHealthCard` for each active session
    - Fetch via `useQuery` with key `gpuKeys.health` and `getGpuHealth`, polling every 15s
    - Show warning banner when health endpoint is unreachable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 12.1, 12.2_

  - [x] 6.4 Create Logs Viewer page at `apps/dashboard/app/(dashboard)/gpu/logs/page.tsx`
    - Display scrollable list of `LogEntry` components in reverse chronological order
    - Include `LogFilters` for level, component, session ID, and text search
    - Fetch via `useQuery` with key `gpuKeys.logs` and `getGpuLogs`, pagination (50 per page), polling every 10s for first page
    - Client-side text search filtering on current page
    - Show empty state when no logs match filters
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 12.1, 12.2, 12.3_

  - [x] 6.5 Create Config View page at `apps/dashboard/app/(dashboard)/gpu/config/page.tsx`
    - Display orchestrator config as grouped key-value lists using `ConfigGroup` components
    - Groups: Provider Settings, AWS Settings, Health Check Settings, Logging Settings
    - Fetch via `useQuery` with key `gpuKeys.config` and `getGpuConfig`, stale time 60s
    - Show error state if config endpoint fails
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.1, 12.2_

  - [x] 6.6 Create Activity Timeline page at `apps/dashboard/app/(dashboard)/gpu/activity/page.tsx`
    - Display vertical timeline of `TimelineEvent` components in reverse chronological order
    - Include `EventTypeFilter` for filtering by event type
    - Fetch via `useQuery` with key `gpuKeys.activity` and `getGpuActivity`, pagination (30 per page), polling every 30s for first page
    - Clicking a session ID link navigates to the session detail page
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 12.1, 12.2, 12.3_

- [x] 7. Checkpoint - Verify all pages render without errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate sidebar navigation and i18n
  - [x] 8.1 Add GPU Compute navigation section to `apps/dashboard/components/Sidebar.tsx`
    - Define `gpuComputeItems` NavItem array with entries: Sessions (`/gpu`), Health (`/gpu/health`), Logs (`/gpu/logs`), Config (`/gpu/config`), Activity (`/gpu/activity`)
    - Add a new `<NavSection titleKey="sidebar.gpuCompute" items={gpuComputeItems} ... />` between the Platform and Operations sections
    - Use appropriate `lucide-react` icons and color accents matching the design
    - Ensure the existing `isActive` function correctly highlights GPU nav items (it already uses `pathname.startsWith(href)` for non-root routes)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.2 Add i18n translation keys for all GPU navigation labels and page titles
    - Add keys: `sidebar.gpuCompute`, `nav.gpu.sessions`, `nav.gpu.health`, `nav.gpu.logs`, `nav.gpu.config`, `nav.gpu.activity`
    - Add page title keys: `gpu.sessions.title`, `gpu.sessions.subtitle`, `gpu.health.title`, `gpu.logs.title`, `gpu.config.title`, `gpu.activity.title`
    - Add error/empty state keys: `gpu.error.loadFailed`, `gpu.empty.noSessions`, `gpu.empty.noLogs`, `gpu.empty.noEvents`
    - Add to the `@cig-technology/i18n` package translation files
    - _Requirements: 1.6_

- [x] 9. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Property-based tests
  - [x] 10.1 Write property test for route active state detection
    - **Property 1: Route Active State Detection**
    - Test that for any GPU route path, the `isGpuRouteActive` function returns `true` for exactly the matching nav item and `false` for all others
    - Use `fast-check` to generate arbitrary GPU route paths and verify correct active state
    - Place in `apps/dashboard/__tests__/gpu/utils.property.test.ts`
    - **Validates: Requirements 1.3**

  - [x] 10.2 Write property test for enum-to-visual mapping completeness
    - **Property 2: Enum-to-Visual Mapping Completeness**
    - Test that every valid `GpuSessionStatus`, health status, `GpuLogLevel`, and `GpuActivityEventType` value maps to a non-empty color class string
    - Use `fast-check` `fc.constantFrom` to enumerate all valid enum values
    - Place in `apps/dashboard/__tests__/gpu/utils.property.test.ts`
    - **Validates: Requirements 2.5, 4.4, 5.4, 7.5**

  - [x] 10.3 Write property test for enum filter correctness
    - **Property 3: Enum Filter Correctness**
    - Test that filtering sessions by status returns only matching sessions and length ≤ original; same for activity events filtered by event type set
    - Use `fast-check` to generate arbitrary session lists and filter values
    - Place in `apps/dashboard/__tests__/gpu/utils.property.test.ts`
    - **Validates: Requirements 2.7, 7.7**

  - [x] 10.4 Write property test for reverse chronological ordering
    - **Property 4: Reverse Chronological Ordering**
    - Test that sorting timestamped items produces a list where each timestamp ≥ the next, with no items added or removed
    - Use `fast-check` to generate arbitrary lists of timestamped objects
    - Place in `apps/dashboard/__tests__/gpu/utils.property.test.ts`
    - **Validates: Requirements 5.1, 7.1**

  - [x] 10.5 Write property test for log filtering correctness
    - **Property 5: Log Filtering Correctness**
    - Test that filtering log entries by any combination of level set, component, session ID, and text search returns only entries satisfying all active criteria simultaneously
    - Use `fast-check` to generate arbitrary log entry lists and filter combinations
    - Place in `apps/dashboard/__tests__/gpu/utils.property.test.ts`
    - **Validates: Requirements 5.3, 5.7**

  - [x] 10.6 Write property test for log entry field completeness
    - **Property 6: Log Entry Field Completeness**
    - Test that for any valid `GpuLogEntry`, the rendered `LogEntry` component displays all required fields: timestamp, level with color, component, session ID or placeholder, and message
    - Use `fast-check` to generate arbitrary valid log entries and `@testing-library/react` to verify rendered output
    - Place in `apps/dashboard/__tests__/gpu/components.property.test.ts`
    - **Validates: Requirements 5.2**

  - [x] 10.7 Write property test for activity event field completeness
    - **Property 7: Activity Event Field Completeness**
    - Test that for any valid `GpuActivityEvent`, the rendered `TimelineEvent` component displays: timestamp, event type with icon, session ID (link when non-null), and description
    - Use `fast-check` to generate arbitrary valid activity events and `@testing-library/react` to verify rendered output
    - Place in `apps/dashboard/__tests__/gpu/components.property.test.ts`
    - **Validates: Requirements 7.3**

  - [x] 10.8 Write property test for config value display correctness
    - **Property 8: Config Value Display Correctness**
    - Test that for any `GpuConfigEntry`, the `ConfigGroup` component shows `***` when `redacted` is true and the exact value when `redacted` is false
    - Use `fast-check` to generate arbitrary config entries
    - Place in `apps/dashboard/__tests__/gpu/utils.property.test.ts`
    - **Validates: Requirements 6.3, 6.4**

  - [x] 10.9 Write property test for status indicator accessibility
    - **Property 9: Status Indicator Accessibility**
    - Test that for any health status and optional label, the `HealthIndicator` component renders with an `aria-label` containing the status text and label, plus a visible text element
    - Use `fast-check` to generate arbitrary health status values and label strings
    - Place in `apps/dashboard/__tests__/gpu/components.property.test.ts`
    - **Validates: Requirements 11.4, 11.5**

- [x] 11. Unit tests
  - [x] 11.1 Write unit tests for GPU API module
    - Test each function in `gpuApi.ts` with mocked `getDashboardClient`
    - Verify correct URL construction, HTTP methods, and response typing
    - Place in `apps/dashboard/__tests__/gpu/gpu-api.test.ts`
    - _Requirements: 9.2_

  - [x] 11.2 Write unit tests for Sessions Overview page
    - Test StatCard rendering with mock data, table row rendering, status filter, click navigation, loading/error/empty states
    - Place in `apps/dashboard/__tests__/gpu/sessions-page.test.tsx`
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.8, 10.1, 10.3, 10.4, 10.5_

  - [x] 11.3 Write unit tests for Session Detail page
    - Test metadata display, health check display, action buttons with confirm dialog, 404 handling, log section
    - Place in `apps/dashboard/__tests__/gpu/session-detail.test.tsx`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9, 10.6_

  - [x] 11.4 Write unit tests for Health Dashboard page
    - Test StatCard summary, session health cards, unhealthy pulse animation, warning banner, recovery state display
    - Place in `apps/dashboard/__tests__/gpu/health-page.test.tsx`
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7_

  - [x] 11.5 Write unit tests for Logs Viewer page
    - Test log entry expand/collapse, empty state when no matches
    - Place in `apps/dashboard/__tests__/gpu/logs-page.test.tsx`
    - _Requirements: 5.6, 5.8_

  - [x] 11.6 Write unit tests for Config View page
    - Test grouped display, error state
    - Place in `apps/dashboard/__tests__/gpu/config-page.test.tsx`
    - _Requirements: 6.1, 6.5_

  - [x] 11.7 Write unit tests for Activity Timeline page
    - Test event rendering, session ID link navigation
    - Place in `apps/dashboard/__tests__/gpu/activity-page.test.tsx`
    - _Requirements: 7.2, 7.6_

  - [x] 11.8 Write unit tests for Sidebar GPU navigation
    - Test GPU Compute section renders with correct items, active state highlighting
    - Place in `apps/dashboard/__tests__/gpu/sidebar-gpu.test.tsx`
    - _Requirements: 1.1, 1.4_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific UI rendering, interactions, and edge cases
- Backend API endpoints (Requirement 8) are implemented separately in the CIG API server; dashboard tasks mock API responses
- The `fast-check` library needs to be added as a dev dependency for property-based tests
- All GPU pages reuse the existing `(dashboard)/layout.tsx` — no new layout wrappers needed
