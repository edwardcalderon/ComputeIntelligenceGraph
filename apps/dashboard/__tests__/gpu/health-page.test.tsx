/**
 * Unit tests for the GPU Health Dashboard page (`/gpu/health`).
 *
 * Validates: Requirements 4.1, 4.2, 4.5, 4.6, 4.7
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { GpuHealthSummary, GpuSessionHealth } from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefetch = jest.fn();
let mockUseQueryReturn: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => mockUseQueryReturn),
}));

jest.mock("../../lib/gpuApi", () => ({
  getGpuHealth: jest.fn(),
}));

// Mock child components
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

jest.mock("../../components/gpu/SessionHealthCard", () => ({
  SessionHealthCard: ({ session }: { session: GpuSessionHealth }) => (
    <div data-testid="session-health-card">
      <span data-testid="health-card-session-id">{session.sessionId}</span>
      <span data-testid="health-card-status">{session.healthStatus}</span>
      {session.recoveryState && (
        <span data-testid="health-card-recovery">{session.recoveryState.actionType}</span>
      )}
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

jest.mock("../../components/gpu/SkeletonLoader", () => ({
  SkeletonLoader: ({ variant, rows }: { variant?: string; rows?: number }) => (
    <div data-testid="skeleton-loader" data-variant={variant} data-rows={rows} />
  ),
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import GpuHealthPage from "../../app/(dashboard)/gpu/health/page";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function buildHealthSummary(overrides: Partial<GpuHealthSummary> = {}): GpuHealthSummary {
  return {
    totalHealthy: 3,
    totalUnhealthy: 1,
    totalNoData: 0,
    oldestHeartbeatAgeSeconds: 120,
    sessions: [
      {
        sessionId: "sess-001",
        healthStatus: "healthy",
        healthCheck: {
          timestamp: "2025-01-15T12:00:00Z",
          sessionId: "sess-001",
          checks: {
            session: { healthy: true, latencyMs: 50, status: "running" },
            workerHeartbeat: { healthy: true, latencyMs: 30 },
          },
          overall: true,
        },
        recoveryState: null,
        lastCheckTimestamp: "2025-01-15T12:00:00Z",
      },
      {
        sessionId: "sess-002",
        healthStatus: "unhealthy",
        healthCheck: {
          timestamp: "2025-01-15T12:00:00Z",
          sessionId: "sess-002",
          checks: {
            session: { healthy: false, latencyMs: 500, status: "error" },
            workerHeartbeat: { healthy: false, latencyMs: 200 },
          },
          overall: false,
        },
        recoveryState: {
          actionType: "restart_worker",
          consecutiveFailures: 2,
          nextRetryAt: "2025-01-15T12:05:00Z",
        },
        lastCheckTimestamp: "2025-01-15T12:00:00Z",
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

describe("GpuHealthPage", () => {
  // -----------------------------------------------------------------------
  // Requirement 4.1: StatCard summary row
  // -----------------------------------------------------------------------
  describe("stat card summary", () => {
    it("renders four StatCards with correct health metrics", () => {
      const summary = buildHealthSummary();
      setQueryReturn({ data: summary });

      render(<GpuHealthPage />);

      const statCards = screen.getAllByTestId("stat-card");
      expect(statCards).toHaveLength(4);

      const labels = statCards.map((card) =>
        within(card).getByTestId("stat-label").textContent
      );
      expect(labels).toEqual(["Healthy", "Unhealthy", "No Data", "Oldest Heartbeat"]);

      const values = statCards.map((card) =>
        within(card).getByTestId("stat-value").textContent
      );
      expect(values[0]).toBe("3");
      expect(values[1]).toBe("1");
      expect(values[2]).toBe("0");
      expect(values[3]).toBe("2m"); // 120 seconds = 2m
    });

    it("displays '—' for oldest heartbeat when null", () => {
      const summary = buildHealthSummary({ oldestHeartbeatAgeSeconds: null });
      setQueryReturn({ data: summary });

      render(<GpuHealthPage />);

      const statCards = screen.getAllByTestId("stat-card");
      const oldestHeartbeatValue = within(statCards[3]).getByTestId("stat-value").textContent;
      expect(oldestHeartbeatValue).toBe("—");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 4.2: Session health cards
  // -----------------------------------------------------------------------
  describe("session health cards", () => {
    it("renders a SessionHealthCard for each session", () => {
      const summary = buildHealthSummary();
      setQueryReturn({ data: summary });

      render(<GpuHealthPage />);

      const healthCards = screen.getAllByTestId("session-health-card");
      expect(healthCards).toHaveLength(2);

      expect(screen.getByText("sess-001")).toBeInTheDocument();
      expect(screen.getByText("sess-002")).toBeInTheDocument();
    });

    it("shows empty state when no sessions exist", () => {
      const summary = buildHealthSummary({
        totalHealthy: 0,
        totalUnhealthy: 0,
        totalNoData: 0,
        sessions: [],
      });
      setQueryReturn({ data: summary });

      render(<GpuHealthPage />);

      expect(screen.getByText("No active sessions to display health data for.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 4.5: Unhealthy pulse animation (via SessionHealthCard mock)
  // -----------------------------------------------------------------------
  describe("unhealthy session display", () => {
    it("passes unhealthy status to SessionHealthCard", () => {
      const summary = buildHealthSummary();
      setQueryReturn({ data: summary });

      render(<GpuHealthPage />);

      const statusElements = screen.getAllByTestId("health-card-status");
      expect(statusElements[0]).toHaveTextContent("healthy");
      expect(statusElements[1]).toHaveTextContent("unhealthy");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 4.6: Recovery state display
  // -----------------------------------------------------------------------
  describe("recovery state", () => {
    it("passes recovery state to SessionHealthCard for unhealthy sessions", () => {
      const summary = buildHealthSummary();
      setQueryReturn({ data: summary });

      render(<GpuHealthPage />);

      const recoveryElements = screen.getAllByTestId("health-card-recovery");
      expect(recoveryElements).toHaveLength(1);
      expect(recoveryElements[0]).toHaveTextContent("restart_worker");
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 4.7: Warning banner when health endpoint unreachable
  // -----------------------------------------------------------------------
  describe("error state / warning banner", () => {
    it("renders warning banner when health endpoint is unreachable", () => {
      setQueryReturn({ isError: true });

      render(<GpuHealthPage />);

      expect(
        screen.getByText(/Health data is currently unavailable/)
      ).toBeInTheDocument();
    });

    it("renders ErrorState with retry button on error", () => {
      setQueryReturn({ isError: true });

      render(<GpuHealthPage />);

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText("Failed to load health data. Please try again.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton loaders when data is loading", () => {
      setQueryReturn({ isLoading: true });

      render(<GpuHealthPage />);

      expect(screen.getByText("Health Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Loading health data…")).toBeInTheDocument();
      expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------------
  describe("page header", () => {
    it("displays session count in subtitle", () => {
      const summary = buildHealthSummary();
      setQueryReturn({ data: summary });

      render(<GpuHealthPage />);

      // totalHealthy(3) + totalUnhealthy(1) + totalNoData(0) = 4
      expect(screen.getByText(/4 GPU sessions/)).toBeInTheDocument();
    });
  });
});
