/**
 * Unit tests for the GPU Logs Viewer page (`/gpu/logs`).
 *
 * Validates: Requirements 5.6, 5.8
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { GpuLogEntry, PaginatedResponse } from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefetch = jest.fn();
let mockUseQueryReturn: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => mockUseQueryReturn),
}));

jest.mock("../../lib/gpuApi", () => ({
  getGpuLogs: jest.fn(),
}));

// Mock LogEntry to capture expand/collapse behavior
jest.mock("../../components/gpu/LogEntry", () => ({
  LogEntry: ({ entry }: { entry: GpuLogEntry }) => (
    <div data-testid={`log-entry-${entry.id}`}>
      <span data-testid="log-message">{entry.message}</span>
      <span data-testid="log-level">{entry.level}</span>
    </div>
  ),
}));

jest.mock("../../components/gpu/LogFilters", () => ({
  LogFilters: ({
    filters,
    onChange,
  }: {
    filters: Record<string, unknown>;
    onChange: (f: Record<string, unknown>) => void;
  }) => (
    <div data-testid="log-filters">
      <input
        data-testid="search-input"
        value={(filters.searchText as string) ?? ""}
        onChange={(e) => onChange({ ...filters, searchText: e.target.value || undefined })}
        placeholder="Search"
      />
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

import GpuLogsPage from "../../app/(dashboard)/gpu/logs/page";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function buildLogEntry(overrides: Partial<GpuLogEntry> = {}): GpuLogEntry {
  return {
    id: "log-1",
    timestamp: "2025-01-15T12:00:00Z",
    level: "info",
    component: "orchestrator",
    sessionId: "sess-001",
    message: "Session verified successfully",
    ...overrides,
  };
}

const mockLogs: GpuLogEntry[] = [
  buildLogEntry({ id: "log-1", message: "Session verified successfully", timestamp: "2025-01-15T12:00:00Z" }),
  buildLogEntry({ id: "log-2", level: "error", message: "Health check failed", timestamp: "2025-01-15T11:55:00Z" }),
  buildLogEntry({ id: "log-3", level: "warn", message: "Worker heartbeat stale", timestamp: "2025-01-15T11:50:00Z" }),
];

const mockPaginatedLogs: PaginatedResponse<GpuLogEntry> = {
  items: mockLogs,
  total: 3,
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

describe("GpuLogsPage", () => {
  // -----------------------------------------------------------------------
  // Requirement 5.6: Log entry expand/collapse (rendered via LogEntry mock)
  // -----------------------------------------------------------------------
  describe("log entry rendering", () => {
    it("renders all log entries from the API response", () => {
      setQueryReturn({ data: mockPaginatedLogs });

      render(<GpuLogsPage />);

      expect(screen.getByTestId("log-entry-log-1")).toBeInTheDocument();
      expect(screen.getByTestId("log-entry-log-2")).toBeInTheDocument();
      expect(screen.getByTestId("log-entry-log-3")).toBeInTheDocument();
    });

    it("displays log messages", () => {
      setQueryReturn({ data: mockPaginatedLogs });

      render(<GpuLogsPage />);

      expect(screen.getByText("Session verified successfully")).toBeInTheDocument();
      expect(screen.getByText("Health check failed")).toBeInTheDocument();
      expect(screen.getByText("Worker heartbeat stale")).toBeInTheDocument();
    });

    it("renders LogFilters component", () => {
      setQueryReturn({ data: mockPaginatedLogs });

      render(<GpuLogsPage />);

      expect(screen.getByTestId("log-filters")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 5.8: Empty state when no matches
  // -----------------------------------------------------------------------
  describe("empty state", () => {
    it("renders empty state when API returns no logs", () => {
      setQueryReturn({
        data: { items: [], total: 0, limit: 50, offset: 0 },
      });

      render(<GpuLogsPage />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      expect(screen.getByText("No log entries match the current filters.")).toBeInTheDocument();
    });

    it("renders empty state when text search filters out all entries", () => {
      setQueryReturn({ data: mockPaginatedLogs });

      render(<GpuLogsPage />);

      // Type a search that won't match any log messages
      fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "zzz_nonexistent_query_zzz" },
      });

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton loader when data is loading", () => {
      setQueryReturn({ isLoading: true });

      render(<GpuLogsPage />);

      expect(screen.getByText("Logs Viewer")).toBeInTheDocument();
      expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  describe("error state", () => {
    it("renders ErrorState when query fails", () => {
      setQueryReturn({ isError: true });

      render(<GpuLogsPage />);

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText("Failed to load log entries. Please try again.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------------
  describe("page header", () => {
    it("displays entry count in subtitle", () => {
      setQueryReturn({ data: mockPaginatedLogs });

      render(<GpuLogsPage />);

      expect(screen.getByText(/Showing 3 of 3 entries/)).toBeInTheDocument();
    });
  });
});
