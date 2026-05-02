/**
 * Unit tests for the GPU Config View page (`/gpu/config`).
 *
 * Validates: Requirements 6.1, 6.5
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { GpuConfig, GpuConfigEntry } from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefetch = jest.fn();
let mockUseQueryReturn: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => mockUseQueryReturn),
}));

jest.mock("../../lib/gpuApi", () => ({
  getGpuConfig: jest.fn(),
}));

// Mock ConfigGroup to verify it receives correct props
jest.mock("../../components/gpu/ConfigGroup", () => ({
  ConfigGroup: ({ title, entries }: { title: string; entries: GpuConfigEntry[] }) => (
    <div data-testid={`config-group-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h3 data-testid="config-group-title">{title}</h3>
      <span data-testid="config-group-count">{entries.length}</span>
      {entries.map((entry) => (
        <div key={entry.key} data-testid={`config-entry-${entry.key}`}>
          <span data-testid="config-key">{entry.key}</span>
          <span data-testid="config-value">{entry.redacted ? "***" : entry.value}</span>
        </div>
      ))}
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

import GpuConfigPage from "../../app/(dashboard)/gpu/config/page";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockConfig: GpuConfig = {
  providerSettings: [
    { key: "provider", value: "colab", redacted: false },
    { key: "credentials_path", value: "/secret/path", redacted: true },
  ],
  awsSettings: [
    { key: "region", value: "us-east-2", redacted: false },
    { key: "table_name", value: "llm-proxy-state", redacted: false },
  ],
  healthCheckSettings: [
    { key: "interval_ms", value: "30000", redacted: false },
    { key: "port", value: "8787", redacted: false },
  ],
  loggingSettings: [
    { key: "log_level", value: "info", redacted: false },
  ],
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

describe("GpuConfigPage", () => {
  // -----------------------------------------------------------------------
  // Requirement 6.1: Grouped display
  // -----------------------------------------------------------------------
  describe("grouped config display", () => {
    it("renders four ConfigGroup components with correct titles", () => {
      setQueryReturn({ data: mockConfig });

      render(<GpuConfigPage />);

      expect(screen.getByTestId("config-group-provider-settings")).toBeInTheDocument();
      expect(screen.getByTestId("config-group-aws-settings")).toBeInTheDocument();
      expect(screen.getByTestId("config-group-health-check-settings")).toBeInTheDocument();
      expect(screen.getByTestId("config-group-logging-settings")).toBeInTheDocument();
    });

    it("passes correct entries to each ConfigGroup", () => {
      setQueryReturn({ data: mockConfig });

      render(<GpuConfigPage />);

      // Provider settings has 2 entries
      const providerGroup = screen.getByTestId("config-group-provider-settings");
      expect(providerGroup.querySelector('[data-testid="config-group-count"]')!.textContent).toBe("2");

      // AWS settings has 2 entries
      const awsGroup = screen.getByTestId("config-group-aws-settings");
      expect(awsGroup.querySelector('[data-testid="config-group-count"]')!.textContent).toBe("2");

      // Health check settings has 2 entries
      const healthGroup = screen.getByTestId("config-group-health-check-settings");
      expect(healthGroup.querySelector('[data-testid="config-group-count"]')!.textContent).toBe("2");

      // Logging settings has 1 entry
      const loggingGroup = screen.getByTestId("config-group-logging-settings");
      expect(loggingGroup.querySelector('[data-testid="config-group-count"]')!.textContent).toBe("1");
    });

    it("displays page title and subtitle", () => {
      setQueryReturn({ data: mockConfig });

      render(<GpuConfigPage />);

      expect(screen.getByText("Configuration")).toBeInTheDocument();
      expect(screen.getByText(/Sensitive values are redacted/)).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 6.5: Error state
  // -----------------------------------------------------------------------
  describe("error state", () => {
    it("renders ErrorState when config endpoint fails", () => {
      setQueryReturn({ isError: true });

      render(<GpuConfigPage />);

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText("Failed to load configuration. Please try again.")).toBeInTheDocument();
    });

    it("still shows page title in error state", () => {
      setQueryReturn({ isError: true });

      render(<GpuConfigPage />);

      expect(screen.getByText("Configuration")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe("loading state", () => {
    it("renders skeleton loader when data is loading", () => {
      setQueryReturn({ isLoading: true });

      render(<GpuConfigPage />);

      expect(screen.getByText("Configuration")).toBeInTheDocument();
      expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();
    });
  });
});
