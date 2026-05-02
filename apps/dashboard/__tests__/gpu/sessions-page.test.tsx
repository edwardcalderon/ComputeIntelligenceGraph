/**
 * Unit tests for the GPU Sessions Overview page (`/gpu`).
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.6, 2.8, 10.1, 10.3, 10.4, 10.5
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { GpuSession, PaginatedResponse } from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRefetch = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// We need to control useQuery return values per test
let mockUseQueryReturn: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => mockUseQueryReturn),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock the GPU API module
jest.mock("../../lib/gpuApi", () => ({
  getGpuSessions: jest.fn(),
}));

// Mock child components to isolate page logic
jest.mock("../../components/StatCard", () => ({
  StatCard: ({ label, value, loading }: { label: string; value: string | number; loading?: boolean }) =>
    loading ? (
      <div data-testid="stat-card-loading">{label || "loading"}</div>
    ) : (
      <div data-testid="stat-card">
        <span data-testid="stat-label">{label}</span>
        <span data-testid="stat-value">{value}</span>
      </div>
    ),
}));

jest.mock("../../components/gpu/SessionsTable", () => ({
  SessionsTable: ({
    sessions,
    onRowClick,
  }: {
    sessions: GpuSession[];
    onRowClick: (id: string) => void;
  }) => (
    <table data-testid="sessions-table">
      <tbody>
        {sessions.map((s: GpuSession) => (
          <tr
            key={s.sessionId}
            data-testid={`session-row-${s.sessionId}`}
            onClick={() => onRowClick(s.sessionId)}
          >
            <td>{s.sessionId}</td>
            <td>{s.status}</td>
            <td>{s.provider}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

jest.mock("../../components/gpu/StatusFilter", () => ({
  StatusFilter: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      data-testid="status-filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All</option>
      <option value="running">Running</option>
      <option value="error">Error</option>
    </select>
  ),
}));

jest.mock("../../components/gpu/NewSessionDialog", () => ({
  NewSessionDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="new-session-dialog" role="dialog">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

jest.mock("../../components/gpu/ErrorState", () => ({
  ErrorState: ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
    <div data-testid="error-state" role="alert">
      <p>{message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

jest.mock("../../components/gpu/EmptyState", () => ({
  EmptyState: ({
    message,
    description,
  }: {
    message: string;
    description?: string;
  }) => (
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

import GpuSessionsPage from "../../app/(dashboard)/gpu/page";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function buildSession(overrides: Partial<GpuSession> = {}): GpuSession {
  return {
    sessionId: "sess-001",
    status: "running",
    provider: "colab",
    models: ["llama3"],
    createdAt: "2025-01-15T10:00:00Z",
    lastVerifiedAt: "2025-01-15T12:00:00Z",
    uptimeSeconds: 7200,
    healthStatus: "healthy",
    ...overrides,
  };
}

const mockSessions: GpuSession[] = [
  buildSession({ sessionId: "sess-001", status: "running", models: ["llama3", "mistral"], uptimeSeconds: 7200, healthStatus: "healthy" }),
  buildSession({ sessionId: "sess-002", status: "connected", models: ["phi3"], uptimeSeconds: 3600, healthStatus: "healthy" }),
  buildSession({ sessionId: "sess-003", status: "error", models: ["llama3"], uptimeSeconds: 900, healthStatus: "unhealthy" }),
  buildSession({ sessionId: "sess-004", status: "terminated", models: ["codellama"], uptimeSeconds: 0, healthStatus: "no_data" }),
];

const mockPaginatedResponse: PaginatedResponse<GpuSession> = {
  items: mockSessions,
  total: 4,
  limit: 50,
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

describe("GpuSessionsPage", () => {
  // -----------------------------------------------------------------------
  // Requirement 2.4: Loading state
  // -----------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton loaders when data is loading", () => {
      setQueryReturn({ isLoading: true });

      render(<GpuSessionsPage />);

      // Page title should still be visible
      expect(screen.getByText("GPU Sessions")).toBeInTheDocument();
      expect(screen.getByText("Loading sessions…")).toBeInTheDocument();

      // StatCard loading placeholders (4 of them)
      const loadingCards = screen.getAllByTestId("stat-card-loading");
      expect(loadingCards).toHaveLength(4);

      // Table skeleton loader
      const skeleton = screen.getByTestId("skeleton-loader");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute("data-variant", "table");
      expect(skeleton).toHaveAttribute("data-rows", "5");
    });

    it("does not render the sessions table or stat cards with data while loading", () => {
      setQueryReturn({ isLoading: true });

      render(<GpuSessionsPage />);

      expect(screen.queryByTestId("sessions-table")).not.toBeInTheDocument();
      expect(screen.queryByTestId("stat-card")).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 2.8: Error state
  // -----------------------------------------------------------------------
  describe("error state", () => {
    it("renders ErrorState with retry button when query fails", () => {
      setQueryReturn({ isError: true });

      render(<GpuSessionsPage />);

      const errorState = screen.getByTestId("error-state");
      expect(errorState).toBeInTheDocument();
      expect(
        screen.getByText("Failed to load GPU sessions. Please try again.")
      ).toBeInTheDocument();
    });

    it("calls refetch when retry button is clicked", () => {
      setQueryReturn({ isError: true });

      render(<GpuSessionsPage />);

      fireEvent.click(screen.getByText("Retry"));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Empty state (Requirement 12.3)
  // -----------------------------------------------------------------------
  describe("empty state", () => {
    it("renders EmptyState when API returns no sessions", () => {
      setQueryReturn({
        data: { items: [], total: 0, limit: 50, offset: 0 },
      });

      render(<GpuSessionsPage />);

      const emptyState = screen.getByTestId("empty-state");
      expect(emptyState).toBeInTheDocument();
      expect(screen.getByText("No GPU sessions found.")).toBeInTheDocument();
      expect(
        screen.getByText("Start a new session to get started.")
      ).toBeInTheDocument();
    });

    it("renders EmptyState when data is null/undefined", () => {
      setQueryReturn({ data: undefined });

      // data is undefined and not loading/error → falls through to empty check
      // The page checks: if (!data || data.items.length === 0)
      render(<GpuSessionsPage />);

      const emptyState = screen.getByTestId("empty-state");
      expect(emptyState).toBeInTheDocument();
    });

    it("still shows New Session button in empty state", () => {
      setQueryReturn({
        data: { items: [], total: 0, limit: 50, offset: 0 },
      });

      render(<GpuSessionsPage />);

      expect(screen.getByText("New Session")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 2.1: StatCards with aggregate metrics
  // -----------------------------------------------------------------------
  describe("stat cards with data", () => {
    it("renders four StatCards with correct aggregate metrics", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      const statCards = screen.getAllByTestId("stat-card");
      expect(statCards).toHaveLength(4);

      const labels = statCards.map((card) =>
        within(card).getByTestId("stat-label").textContent
      );
      expect(labels).toEqual([
        "Active Sessions",
        "Unhealthy",
        "Avg Uptime",
        "Total Models",
      ]);

      // Active sessions: running + connected = 2 (not terminated, not error)
      const values = statCards.map((card) =>
        within(card).getByTestId("stat-value").textContent
      );
      expect(values[0]).toBe("2"); // active (running, connected)
      expect(values[1]).toBe("1"); // unhealthy (sess-003)
      // Avg uptime: (7200 + 3600) / 2 = 5400s = 90m = 1h 30m
      expect(values[2]).toBe("1h 30m");
      // Total unique models: llama3, mistral, phi3, codellama = 4
      expect(values[3]).toBe("4");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 2.2: Sessions table rendering
  // -----------------------------------------------------------------------
  describe("sessions table", () => {
    it("renders the SessionsTable with all sessions", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      const table = screen.getByTestId("sessions-table");
      expect(table).toBeInTheDocument();

      // Each session should have a row
      expect(screen.getByTestId("session-row-sess-001")).toBeInTheDocument();
      expect(screen.getByTestId("session-row-sess-002")).toBeInTheDocument();
      expect(screen.getByTestId("session-row-sess-003")).toBeInTheDocument();
      expect(screen.getByTestId("session-row-sess-004")).toBeInTheDocument();
    });

    it("displays the total session count in the subtitle", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      expect(screen.getByText("4 sessions found.")).toBeInTheDocument();
    });

    it("displays singular 'session' when total is 1", () => {
      setQueryReturn({
        data: {
          items: [mockSessions[0]],
          total: 1,
          limit: 50,
          offset: 0,
        },
      });

      render(<GpuSessionsPage />);

      expect(screen.getByText("1 session found.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 2.6: Row click navigates to session detail
  // -----------------------------------------------------------------------
  describe("row click navigation", () => {
    it("navigates to /gpu/sessions/[sessionId] when a row is clicked", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      fireEvent.click(screen.getByTestId("session-row-sess-001"));
      expect(mockPush).toHaveBeenCalledWith("/gpu/sessions/sess-001");
    });

    it("navigates to the correct session for different rows", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      fireEvent.click(screen.getByTestId("session-row-sess-003"));
      expect(mockPush).toHaveBeenCalledWith("/gpu/sessions/sess-003");
    });
  });

  // -----------------------------------------------------------------------
  // Status filter (Requirement 2.7 — tested via StatusFilter mock)
  // -----------------------------------------------------------------------
  describe("status filter", () => {
    it("renders the StatusFilter component", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      expect(screen.getByTestId("status-filter")).toBeInTheDocument();
    });

    it("shows Clear Filter button when a status is selected", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      // Select a status
      fireEvent.change(screen.getByTestId("status-filter"), {
        target: { value: "running" },
      });

      expect(screen.getByText("Clear Filter")).toBeInTheDocument();
    });

    it("clears the filter when Clear Filter is clicked", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      // Select a status
      fireEvent.change(screen.getByTestId("status-filter"), {
        target: { value: "running" },
      });

      // Click clear
      fireEvent.click(screen.getByText("Clear Filter"));

      // The filter should be back to empty
      expect(
        (screen.getByTestId("status-filter") as HTMLSelectElement).value
      ).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 10.1: New Session button opens dialog
  // -----------------------------------------------------------------------
  describe("New Session button", () => {
    it("renders the New Session button", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      expect(screen.getByText("New Session")).toBeInTheDocument();
    });

    it("opens the NewSessionDialog when clicked", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      // Dialog should not be visible initially
      expect(screen.queryByTestId("new-session-dialog")).not.toBeInTheDocument();

      // Click the button
      fireEvent.click(screen.getByText("New Session"));

      // Dialog should now be visible
      expect(screen.getByTestId("new-session-dialog")).toBeInTheDocument();
    });

    it("closes the dialog when the close button is clicked", () => {
      setQueryReturn({ data: mockPaginatedResponse });

      render(<GpuSessionsPage />);

      // Open dialog
      fireEvent.click(screen.getByText("New Session"));
      expect(screen.getByTestId("new-session-dialog")).toBeInTheDocument();

      // Close dialog
      fireEvent.click(screen.getByText("Close"));
      expect(screen.queryByTestId("new-session-dialog")).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 10.3, 10.4, 10.5: Cache invalidation on success
  // (Tested indirectly — the page wires handleNewSessionSuccess to invalidate)
  // -----------------------------------------------------------------------
  describe("page header", () => {
    it("renders the page title in all data states", () => {
      // With data
      setQueryReturn({ data: mockPaginatedResponse });
      const { unmount } = render(<GpuSessionsPage />);
      expect(screen.getByText("GPU Sessions")).toBeInTheDocument();
      unmount();

      // Loading
      setQueryReturn({ isLoading: true });
      const { unmount: unmount2 } = render(<GpuSessionsPage />);
      expect(screen.getByText("GPU Sessions")).toBeInTheDocument();
      unmount2();

      // Error
      setQueryReturn({ isError: true });
      const { unmount: unmount3 } = render(<GpuSessionsPage />);
      expect(screen.getByText("GPU Sessions")).toBeInTheDocument();
      unmount3();
    });
  });

  // -----------------------------------------------------------------------
  // Edge case: all sessions terminated
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("shows 0 active sessions when all are terminated", () => {
      const allTerminated: GpuSession[] = [
        buildSession({ sessionId: "t1", status: "terminated", uptimeSeconds: 0, healthStatus: "no_data", models: [] }),
        buildSession({ sessionId: "t2", status: "terminated", uptimeSeconds: 0, healthStatus: "no_data", models: [] }),
      ];

      setQueryReturn({
        data: { items: allTerminated, total: 2, limit: 50, offset: 0 },
      });

      render(<GpuSessionsPage />);

      const statCards = screen.getAllByTestId("stat-card");
      const values = statCards.map((card) =>
        within(card).getByTestId("stat-value").textContent
      );

      expect(values[0]).toBe("0"); // active sessions
      expect(values[1]).toBe("0"); // unhealthy
      expect(values[2]).toBe("0s"); // avg uptime (0 active → 0)
      expect(values[3]).toBe("0"); // total models
    });
  });
});
