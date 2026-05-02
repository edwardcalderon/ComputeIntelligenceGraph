/**
 * Unit tests for the GPU Activity Timeline page (`/gpu/activity`).
 *
 * Validates: Requirements 7.2, 7.6
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { GpuActivityEvent, PaginatedResponse } from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefetch = jest.fn();
let mockUseQueryReturn: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => mockUseQueryReturn),
}));

jest.mock("../../lib/gpuApi", () => ({
  getGpuActivity: jest.fn(),
}));

// Mock TimelineEvent to capture event rendering and session ID links
jest.mock("../../components/gpu/TimelineEvent", () => ({
  TimelineEvent: ({ event }: { event: GpuActivityEvent }) => (
    <div data-testid={`timeline-event-${event.id}`}>
      <span data-testid="event-type">{event.eventType}</span>
      <span data-testid="event-description">{event.description}</span>
      {event.sessionId && (
        <a
          data-testid="event-session-link"
          href={`/gpu/sessions/${event.sessionId}`}
        >
          {event.sessionId}
        </a>
      )}
    </div>
  ),
}));

jest.mock("../../components/gpu/EventTypeFilter", () => ({
  EventTypeFilter: ({
    selectedTypes,
    onChange,
  }: {
    selectedTypes: Set<string>;
    onChange: (types: Set<string>) => void;
  }) => (
    <div data-testid="event-type-filter">
      <span data-testid="selected-count">{selectedTypes.size}</span>
    </div>
  ),
}));

jest.mock("../../components/gpu/ErrorState", () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div data-testid="error-state" role="alert">
      <p>{message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

jest.mock("../../components/gpu/EmptyState", () => ({
  EmptyState: ({ message, description }: { message: string; description?: string }) => (
    <div data-testid="empty-state">
      <p>{message}</p>
      {description && <p>{description}</p>}
    </div>
  ),
}));

jest.mock("../../components/gpu/SkeletonLoader", () => ({
  SkeletonLoader: ({ variant, rows }: { variant?: string; rows?: number }) => (
    <div data-testid="skeleton-loader" data-variant={variant} data-rows={rows} />
  ),
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import GpuActivityPage from "../../app/(dashboard)/gpu/activity/page";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockEvents: GpuActivityEvent[] = [
  {
    id: "evt-1",
    timestamp: "2025-01-15T12:00:00Z",
    eventType: "session_created",
    sessionId: "sess-001",
    description: "New GPU session created with provider colab",
  },
  {
    id: "evt-2",
    timestamp: "2025-01-15T11:55:00Z",
    eventType: "health_check_failed",
    sessionId: "sess-002",
    description: "Health check failed for session",
  },
  {
    id: "evt-3",
    timestamp: "2025-01-15T11:50:00Z",
    eventType: "config_changed",
    sessionId: null,
    description: "Orchestrator configuration updated",
  },
];

const mockPaginatedEvents: PaginatedResponse<GpuActivityEvent> = {
  items: mockEvents,
  total: 3,
  limit: 30,
  offset: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setQueryReturn(overrides: Record<string, unknown>) {
  mockUseQueryReturn = {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  setQueryReturn({});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GpuActivityPage", () => {
  // -----------------------------------------------------------------------
  // Requirement 7.2: Event rendering
  // -----------------------------------------------------------------------
  describe("event rendering", () => {
    it("renders all timeline events from the API response", () => {
      setQueryReturn({ data: mockPaginatedEvents });

      render(<GpuActivityPage />);

      expect(screen.getByTestId("timeline-event-evt-1")).toBeInTheDocument();
      expect(screen.getByTestId("timeline-event-evt-2")).toBeInTheDocument();
      expect(screen.getByTestId("timeline-event-evt-3")).toBeInTheDocument();
    });

    it("displays event types and descriptions", () => {
      setQueryReturn({ data: mockPaginatedEvents });

      render(<GpuActivityPage />);

      expect(screen.getByText("New GPU session created with provider colab")).toBeInTheDocument();
      expect(screen.getByText("Health check failed for session")).toBeInTheDocument();
      expect(screen.getByText("Orchestrator configuration updated")).toBeInTheDocument();
    });

    it("renders EventTypeFilter component", () => {
      setQueryReturn({ data: mockPaginatedEvents });

      render(<GpuActivityPage />);

      expect(screen.getByTestId("event-type-filter")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 7.6: Session ID link navigation
  // -----------------------------------------------------------------------
  describe("session ID links", () => {
    it("renders session ID as a link for events with sessionId", () => {
      setQueryReturn({ data: mockPaginatedEvents });

      render(<GpuActivityPage />);

      const sessionLinks = screen.getAllByTestId("event-session-link");
      // evt-1 and evt-2 have sessionId, evt-3 does not
      expect(sessionLinks).toHaveLength(2);
      expect(sessionLinks[0]).toHaveAttribute("href", "/gpu/sessions/sess-001");
      expect(sessionLinks[1]).toHaveAttribute("href", "/gpu/sessions/sess-002");
    });

    it("does not render session link for events without sessionId", () => {
      setQueryReturn({
        data: {
          items: [mockEvents[2]], // config_changed with null sessionId
          total: 1,
          limit: 30,
          offset: 0,
        },
      });

      render(<GpuActivityPage />);

      expect(screen.queryByTestId("event-session-link")).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  describe("empty state", () => {
    it("renders empty state when no events exist", () => {
      setQueryReturn({
        data: { items: [], total: 0, limit: 30, offset: 0 },
      });

      render(<GpuActivityPage />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      expect(screen.getByText("No activity events match the current filters.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton loader when data is loading", () => {
      setQueryReturn({ isLoading: true });

      render(<GpuActivityPage />);

      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
      expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  describe("error state", () => {
    it("renders ErrorState when query fails", () => {
      setQueryReturn({ isError: true });

      render(<GpuActivityPage />);

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText("Failed to load activity events. Please try again.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------------
  describe("page header", () => {
    it("displays event count in subtitle", () => {
      setQueryReturn({ data: mockPaginatedEvents });

      render(<GpuActivityPage />);

      expect(screen.getByText(/Showing 3 of 3 events/)).toBeInTheDocument();
    });
  });
});
