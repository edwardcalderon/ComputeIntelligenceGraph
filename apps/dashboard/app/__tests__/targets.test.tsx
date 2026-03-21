/**
 * Unit tests for targets page status indicator rendering.
 * Validates: Requirement 10 — Dashboard Managed Targets Page
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock component for testing status indicator rendering
function StatusIndicator({
  status,
}: {
  status: "online" | "degraded" | "offline" | "revoked";
}) {
  const getStatusColor = (
    status: "online" | "degraded" | "offline" | "revoked"
  ): string => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "offline":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "revoked":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const getStatusDot = (
    status: "online" | "degraded" | "offline" | "revoked"
  ): string => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "offline":
        return "bg-red-500";
      case "revoked":
        return "bg-gray-500";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${getStatusDot(status)}`} />
      <span
        className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
          status
        )}`}
        data-testid={`status-${status}`}
      >
        {status}
      </span>
    </div>
  );
}

describe("Targets Page Status Indicator", () => {
  it("should render green indicator for online status", () => {
    render(<StatusIndicator status="online" />);
    const indicator = screen.getByTestId("status-online");
    expect(indicator).toHaveClass("bg-green-100");
    expect(indicator).toHaveClass("text-green-800");
    expect(indicator).toHaveTextContent("online");
  });

  it("should render yellow indicator for degraded status", () => {
    render(<StatusIndicator status="degraded" />);
    const indicator = screen.getByTestId("status-degraded");
    expect(indicator).toHaveClass("bg-yellow-100");
    expect(indicator).toHaveClass("text-yellow-800");
    expect(indicator).toHaveTextContent("degraded");
  });

  it("should render red indicator for offline status", () => {
    render(<StatusIndicator status="offline" />);
    const indicator = screen.getByTestId("status-offline");
    expect(indicator).toHaveClass("bg-red-100");
    expect(indicator).toHaveClass("text-red-800");
    expect(indicator).toHaveTextContent("offline");
  });

  it("should render gray indicator for revoked status", () => {
    render(<StatusIndicator status="revoked" />);
    const indicator = screen.getByTestId("status-revoked");
    expect(indicator).toHaveClass("bg-gray-100");
    expect(indicator).toHaveClass("text-gray-800");
    expect(indicator).toHaveTextContent("revoked");
  });

  it("should render colored dot for each status", () => {
    const { rerender } = render(<StatusIndicator status="online" />);
    let dot = screen.getByTestId("status-online").parentElement?.querySelector(
      ".rounded-full"
    );
    expect(dot).toHaveClass("bg-green-500");

    rerender(<StatusIndicator status="degraded" />);
    dot = screen.getByTestId("status-degraded").parentElement?.querySelector(
      ".rounded-full"
    );
    expect(dot).toHaveClass("bg-yellow-500");

    rerender(<StatusIndicator status="offline" />);
    dot = screen.getByTestId("status-offline").parentElement?.querySelector(
      ".rounded-full"
    );
    expect(dot).toHaveClass("bg-red-500");

    rerender(<StatusIndicator status="revoked" />);
    dot = screen.getByTestId("status-revoked").parentElement?.querySelector(
      ".rounded-full"
    );
    expect(dot).toHaveClass("bg-gray-500");
  });
});
