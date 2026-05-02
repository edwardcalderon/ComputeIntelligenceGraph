import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import * as fc from "fast-check";
import { LogEntry } from "../../components/gpu/LogEntry";
import { TimelineEvent } from "../../components/gpu/TimelineEvent";
import { HealthIndicator } from "../../components/gpu/HealthIndicator";
import type {
  GpuLogEntry,
  GpuLogLevel,
  GpuActivityEvent,
  GpuActivityEventType,
} from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mock next/link for TimelineEvent tests
// ---------------------------------------------------------------------------

jest.mock("next/link", () => {
  return function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return React.createElement("a", { href, ...rest }, children);
  };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_LOG_LEVELS: GpuLogLevel[] = ["debug", "info", "warn", "error"];

const ALL_ACTIVITY_EVENT_TYPES: GpuActivityEventType[] = [
  "session_created",
  "session_terminated",
  "session_rotated",
  "health_check_failed",
  "recovery_triggered",
  "worker_restarted",
  "config_changed",
];

const ALL_HEALTH_STATUSES: ("healthy" | "unhealthy" | "no_data")[] = [
  "healthy",
  "unhealthy",
  "no_data",
];

// ---------------------------------------------------------------------------
// Arbitraries (generators)
// ---------------------------------------------------------------------------

/** Constrained date arbitrary that always produces valid ISO strings. */
const arbISODate = fc
  .integer({
    min: new Date("2020-01-01T00:00:00Z").getTime(),
    max: new Date("2030-01-01T00:00:00Z").getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

const arbLogLevel = fc.constantFrom<GpuLogLevel>(...ALL_LOG_LEVELS);
const arbActivityEventType = fc.constantFrom<GpuActivityEventType>(
  ...ALL_ACTIVITY_EVENT_TYPES,
);
const arbHealthStatus = fc.constantFrom<"healthy" | "unhealthy" | "no_data">(
  ...ALL_HEALTH_STATUSES,
);

/** Generate a valid GpuLogEntry with non-empty required fields. */
function arbLogEntry(): fc.Arbitrary<GpuLogEntry> {
  return fc.record({
    id: fc.uuid(),
    timestamp: arbISODate,
    level: arbLogLevel,
    component: fc.constantFrom(
      "orchestrator",
      "worker",
      "health",
      "config",
      "SessionManager",
    ),
    sessionId: fc.option(fc.uuid(), { nil: null }),
    message: fc.string({ minLength: 1, maxLength: 50 }),
  });
}

/** Generate a valid GpuActivityEvent with non-empty required fields. */
function arbActivityEvent(): fc.Arbitrary<GpuActivityEvent> {
  return fc.record({
    id: fc.uuid(),
    timestamp: arbISODate,
    eventType: arbActivityEventType,
    sessionId: fc.option(fc.uuid(), { nil: null }),
    description: fc.string({ minLength: 1, maxLength: 50 }),
  });
}

// ---------------------------------------------------------------------------
// Property 6: Log Entry Field Completeness
// Feature: gpu-dashboard, Property 6: Log Entry Field Completeness
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 6: Log Entry Field Completeness", () => {
  afterEach(() => {
    cleanup();
  });

  it("for any valid GpuLogEntry, the rendered LogEntry displays all required fields: timestamp, level, component, session ID or placeholder, and message", () => {
    fc.assert(
      fc.property(arbLogEntry(), (entry) => {
        const { container } = render(React.createElement(LogEntry, { entry }));

        const buttonText = container.textContent ?? "";

        // Timestamp: the formatted date should contain the year from the ISO string
        const year = new Date(entry.timestamp).getFullYear().toString();
        expect(buttonText).toContain(year);

        // Level: the level text should be present (rendered as-is in the badge)
        expect(buttonText).toContain(entry.level);

        // Component: the component name should be present
        expect(buttonText).toContain(entry.component);

        // Session ID or placeholder: either the session ID or "—"
        if (entry.sessionId) {
          expect(buttonText).toContain(entry.sessionId);
        } else {
          expect(buttonText).toContain("—");
        }

        // Message: the message text should be present
        expect(buttonText).toContain(entry.message);

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Activity Event Field Completeness
// Feature: gpu-dashboard, Property 7: Activity Event Field Completeness
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 7: Activity Event Field Completeness", () => {
  afterEach(() => {
    cleanup();
  });

  it("for any valid GpuActivityEvent, the rendered TimelineEvent displays: timestamp, event type with icon, session ID (link when non-null), and description", () => {
    fc.assert(
      fc.property(arbActivityEvent(), (event) => {
        const { container } = render(
          React.createElement(TimelineEvent, { event }),
        );

        const fullText = container.textContent ?? "";

        // Timestamp: the formatted date should contain the year
        const year = new Date(event.timestamp).getFullYear().toString();
        expect(fullText).toContain(year);

        // Event type: rendered as human-readable text (underscores replaced with spaces)
        const eventTypeLabel = event.eventType.replace(/_/g, " ");
        expect(fullText).toContain(eventTypeLabel);

        // Icon: the event icon should be rendered
        const icon = container.querySelector('[data-testid="event-icon"]');
        expect(icon).not.toBeNull();

        // Description: the description text should be present
        expect(fullText).toContain(event.description);

        // Session ID: when non-null, rendered as a link; when null, no link
        if (event.sessionId) {
          const link = container.querySelector("a");
          expect(link).not.toBeNull();
          expect(link?.getAttribute("href")).toBe(
            `/gpu/sessions/${event.sessionId}`,
          );
          expect(link?.textContent).toContain(event.sessionId);
        } else {
          const link = container.querySelector("a");
          expect(link).toBeNull();
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Status Indicator Accessibility
// Feature: gpu-dashboard, Property 9: Status Indicator Accessibility
// Validates: Requirements 11.4, 11.5
// ---------------------------------------------------------------------------

/** Maps health status to the expected display text from getHealthStatusConfig. */
const HEALTH_STATUS_TEXT: Record<"healthy" | "unhealthy" | "no_data", string> =
  {
    healthy: "Healthy",
    unhealthy: "Unhealthy",
    no_data: "No Data",
  };

describe("Feature: gpu-dashboard, Property 9: Status Indicator Accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("for any health status and optional label, HealthIndicator renders with an aria-label containing the status text and label, plus a visible text element", () => {
    fc.assert(
      fc.property(
        arbHealthStatus,
        fc.option(fc.string({ minLength: 1, maxLength: 30 }), {
          nil: undefined,
        }),
        (status, label) => {
          const props: { status: "healthy" | "unhealthy" | "no_data"; label?: string } = { status };
          if (label !== undefined) {
            props.label = label;
          }

          const { container } = render(
            React.createElement(HealthIndicator, props),
          );

          const statusText = HEALTH_STATUS_TEXT[status];

          // (a) aria-label contains the status text
          const statusElement = container.querySelector('[role="status"]');
          expect(statusElement).not.toBeNull();
          const ariaLabel = statusElement?.getAttribute("aria-label") ?? "";
          expect(ariaLabel).toContain(statusText);

          // When a label is provided, aria-label also contains the label
          if (label !== undefined) {
            expect(ariaLabel).toContain(label);
          }

          // (b) Visible text element displaying the status text
          const visibleText = container.textContent ?? "";
          expect(visibleText).toContain(statusText);

          cleanup();
        },
      ),
      { numRuns: 100 },
    );
  });
});
