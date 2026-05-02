/**
 * Unit tests for the GPU Session Detail page (`/gpu/sessions/[sessionId]`).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9, 10.6
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { GpuSessionDetail } from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRefetch = jest.fn();
const mockMutate = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ sessionId: "test-session" }),
  useRouter: () => ({ push: mockPush }),
}));

let mockUseQueryReturn: Record<string, unknown> = {};
let mockStopMutationReturn: Record<string, unknown> = {};
let mockRestartMutationReturn: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => mockUseQueryReturn),
  useMutation: jest.fn((opts: { mutationFn: () => void }) => {
    // Distinguish stop vs restart by checking the mutationFn reference
    // The page creates stop first, then restart — track call order
    const callCount = (jest.requireMock("@tanstack/react-query").useMutation as jest.Mock).mock.calls.length;
    // Odd calls (1st, 3rd, ...) are stop; even calls (2nd, 4th, ...) are restart
    if (callCount % 2 === 1) {
      return {
        mutate: mockMutate,
        isPending: false,
        ...mockStopMutationReturn,
      };
    }
    return {
      mutate: mockMutate,
      isPending: false,
      ...mockRestartMutationReturn,
    };
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock("../../lib/gpuApi", () => ({
  getGpuSession: jest.fn(),
  deleteGpuSession: jest.fn(),
  restartGpuWorker: jest.fn(),
}));

// Mock child components to isolate page logic
jest.mock("../../components/gpu/StatusBadge", () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

jest.mock("../../components/gpu/HealthCheckDisplay", () => ({
  HealthCheckDisplay: ({ healthCheck }: { healthCheck: unknown }) => (
    <div data-testid="health-check-display">
      {healthCheck ? "Health data present" : "No health data"}
    </div>
  ),
}));

jest.mock("../../components/gpu/SessionLogSection", () => ({
  SessionLogSection: ({ logs, sessionId }: { logs: unknown[]; sessionId: string }) => (
    <div data-testid="session-log-section">
      <span data-testid="log-count">{logs.length}</span>
      <span data-testid="log-session-id">{sessionId}</span>
    </div>
  ),
}));

jest.mock("../../components/gpu/SessionActionButtons", () => ({
  SessionActionButtons: ({
    onStop,
    onRestart,
  }: {
    onStop: () => void;
    onRestart: () => void;
  }) => (
    <div data-testid="session-action-buttons">
      <button data-testid="stop-btn" onClick={onStop}>Stop Session</button>
      <button data-testid="restart-btn" onClick={onRestart}>Restart Worker</button>
    </div>
  ),
}));

jest.mock("../../components/gpu/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    message,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog" role="dialog">
        <p data-testid="confirm-title">{title}</p>
        <p data-testid="confirm-message">{message}</p>
        <button data-testid="confirm-btn" onClick={onConfirm}>Confirm</button>
        <button data-testid="cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

jest.mock("../../components/gpu/SessionProgressIndicator", () => ({
  SessionProgressIndicator: ({ currentPhase }: { currentPhase: string }) => (
    <div data-testid="session-progress-indicator">{currentPhase}</div>
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

jest.mock("../../components/gpu/SkeletonLoader", () => ({
  SkeletonLoader: ({ variant, rows }: { variant?: string; rows?: number }) => (
    <div data-testid="skeleton-loader" data-variant={variant} data-rows={rows} />
  ),
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import SessionDetailPage from "../../app/(dashboard)/gpu/sessions/[sessionId]/page";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function buildSessionDetail(overrides: Partial<GpuSessionDetail> = {}): GpuSessionDetail {
  return {
    sessionId: "test-session",
    status: "running",
    provider: "colab",
    models: ["llama3", "mistral"],
    createdAt: "2025-01-15T10:00:00Z",
    lastVerifiedAt: "2025-01-15T12:00:00Z",
    ttlExpiry: "2025-01-16T10:00:00Z",
    uptimeSeconds: 7200,
    healthCheck: {
      timestamp: "2025-01-15T12:00:00Z",
      sessionId: "test-session",
      checks: {
        session: { healthy: true, latencyMs: 50, status: "running" },
        workerHeartbeat: { healthy: true, latencyMs: 30, lastHeartbeatAt: "2025-01-15T11:59:00Z", ageSeconds: 60 },
      },
      overall: true,
    },
    recoveryState: null,
    recentLogs: [
      {
        id: "log-1",
        timestamp: "2025-01-15T11:55:00Z",
        level: "info",
        component: "orchestrator",
        sessionId: "test-session",
        message: "Session verified successfully",
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setQueryReturn(overrides: Record<string, unknown>) {
  mockUseQueryReturn = {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  setQueryReturn({});
  mockStopMutationReturn = {};
  mockRestartMutationReturn = {};
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionDetailPage", () => {
  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton loader when data is loading", () => {
      setQueryReturn({ isLoading: true });
      render(<SessionDetailPage />);

      expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();
      expect(screen.getByText("← Back to Sessions")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 3.8: 404 handling
  // -----------------------------------------------------------------------
  describe("404 handling", () => {
    it("renders 'Session not found' when API returns 404", () => {
      setQueryReturn({
        isError: true,
        error: new Error("404 Not Found"),
      });

      render(<SessionDetailPage />);

      expect(screen.getByText("Session not found.")).toBeInTheDocument();
      expect(screen.getByText("Return to Sessions Overview")).toBeInTheDocument();
    });

    it("renders 'Session not found' when error message contains 'not found'", () => {
      setQueryReturn({
        isError: true,
        error: new Error("Session not found"),
      });

      render(<SessionDetailPage />);

      expect(screen.getByText("Session not found.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Generic error state
  // -----------------------------------------------------------------------
  describe("error state", () => {
    it("renders ErrorState for non-404 errors", () => {
      setQueryReturn({
        isError: true,
        error: new Error("Internal Server Error"),
      });

      render(<SessionDetailPage />);

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText("Failed to load session details. Please try again.")).toBeInTheDocument();
    });

    it("calls refetch when retry button is clicked", () => {
      setQueryReturn({
        isError: true,
        error: new Error("Internal Server Error"),
      });

      render(<SessionDetailPage />);

      fireEvent.click(screen.getByText("Retry"));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 3.1: Session metadata display
  // -----------------------------------------------------------------------
  describe("session metadata", () => {
    it("displays session metadata fields", () => {
      const session = buildSessionDetail();
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.getByText("Session Detail")).toBeInTheDocument();
      expect(screen.getByText("Session Metadata")).toBeInTheDocument();
      // Session ID appears in metadata
      expect(screen.getAllByText("test-session").length).toBeGreaterThanOrEqual(1);
      // Provider
      expect(screen.getByText("colab")).toBeInTheDocument();
      // Models
      expect(screen.getByText("llama3, mistral")).toBeInTheDocument();
    });

    it("displays status badge", () => {
      const session = buildSessionDetail();
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      const badges = screen.getAllByTestId("status-badge");
      expect(badges.length).toBeGreaterThanOrEqual(1);
      expect(badges[0]).toHaveTextContent("running");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 3.2, 3.3: Health check display
  // -----------------------------------------------------------------------
  describe("health check display", () => {
    it("renders HealthCheckDisplay with health data", () => {
      const session = buildSessionDetail();
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      const healthDisplay = screen.getByTestId("health-check-display");
      expect(healthDisplay).toBeInTheDocument();
      expect(healthDisplay).toHaveTextContent("Health data present");
    });

    it("renders HealthCheckDisplay with null health check", () => {
      const session = buildSessionDetail({ healthCheck: null });
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      const healthDisplay = screen.getByTestId("health-check-display");
      expect(healthDisplay).toHaveTextContent("No health data");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 3.5, 3.6: Action buttons and confirm dialog
  // -----------------------------------------------------------------------
  describe("action buttons", () => {
    it("renders SessionActionButtons", () => {
      const session = buildSessionDetail();
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.getByTestId("session-action-buttons")).toBeInTheDocument();
    });

    it("opens confirm dialog when Stop Session is clicked", () => {
      const session = buildSessionDetail();
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      // Dialog should not be visible initially
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

      // Click stop button
      fireEvent.click(screen.getByTestId("stop-btn"));

      // Dialog should now be visible
      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("confirm-title")).toHaveTextContent("Stop Session");
    });

    it("closes confirm dialog when cancel is clicked", () => {
      const session = buildSessionDetail();
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      // Open dialog
      fireEvent.click(screen.getByTestId("stop-btn"));
      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

      // Cancel
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 3.9: Recent logs section
  // -----------------------------------------------------------------------
  describe("recent logs section", () => {
    it("renders SessionLogSection with logs", () => {
      const session = buildSessionDetail();
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.getByTestId("session-log-section")).toBeInTheDocument();
      expect(screen.getByTestId("log-count")).toHaveTextContent("1");
      expect(screen.getByTestId("log-session-id")).toHaveTextContent("test-session");
    });

    it("renders SessionLogSection with empty logs", () => {
      const session = buildSessionDetail({ recentLogs: [] });
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.getByTestId("log-count")).toHaveTextContent("0");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 10.6: Progress indicator for creating sessions
  // -----------------------------------------------------------------------
  describe("session progress indicator", () => {
    it("shows progress indicator when session is creating", () => {
      const session = buildSessionDetail({ status: "creating" });
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.getByTestId("session-progress-indicator")).toBeInTheDocument();
      expect(screen.getByText("Session Setup in Progress")).toBeInTheDocument();
    });

    it("does not show progress indicator when session is running", () => {
      const session = buildSessionDetail({ status: "running" });
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.queryByTestId("session-progress-indicator")).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Recovery state display
  // -----------------------------------------------------------------------
  describe("recovery state", () => {
    it("displays recovery state when present", () => {
      const session = buildSessionDetail({
        recoveryState: {
          actionType: "restart_worker",
          consecutiveFailures: 3,
          nextRetryAt: "2025-01-15T13:00:00Z",
        },
      });
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.getByText("Recovery State")).toBeInTheDocument();
      expect(screen.getByText("restart worker")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("does not display recovery state when null", () => {
      const session = buildSessionDetail({ recoveryState: null });
      setQueryReturn({ data: session });

      render(<SessionDetailPage />);

      expect(screen.queryByText("Recovery State")).not.toBeInTheDocument();
    });
  });
});
