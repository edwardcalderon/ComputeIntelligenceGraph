import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogEntry } from "../../components/gpu/LogEntry";
import type { GpuLogEntry, GpuLogLevel } from "../../types/gpu";

/** Helper to build a minimal valid log entry. */
function makeEntry(overrides: Partial<GpuLogEntry> = {}): GpuLogEntry {
  return {
    id: "log-1",
    timestamp: "2025-06-01T12:30:00.000Z",
    level: "info",
    component: "SessionManager",
    sessionId: "sess-abc",
    message: "Session started successfully",
    ...overrides,
  };
}

describe("LogEntry", () => {
  // -----------------------------------------------------------------------
  // Collapsed view – required fields
  // -----------------------------------------------------------------------

  it("renders the formatted timestamp", () => {
    render(<LogEntry entry={makeEntry()} />);
    // toLocaleString output varies by environment; just check the button text
    // contains a recognizable date fragment
    const button = screen.getByRole("button");
    expect(button.textContent).toContain("2025");
  });

  it("renders the level badge with uppercase text", () => {
    render(<LogEntry entry={makeEntry({ level: "warn" })} />);
    expect(screen.getByText("warn")).toBeInTheDocument();
  });

  it("renders the component name", () => {
    render(<LogEntry entry={makeEntry({ component: "HealthChecker" })} />);
    expect(screen.getByText("HealthChecker")).toBeInTheDocument();
  });

  it("renders the session ID when present", () => {
    render(<LogEntry entry={makeEntry({ sessionId: "sess-xyz" })} />);
    expect(screen.getByText("sess-xyz")).toBeInTheDocument();
  });

  it('renders "—" placeholder when sessionId is null', () => {
    render(<LogEntry entry={makeEntry({ sessionId: null })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the message text", () => {
    render(<LogEntry entry={makeEntry({ message: "Worker restarted" })} />);
    expect(screen.getByText("Worker restarted")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Level color coding
  // -----------------------------------------------------------------------

  const levelColorMap: [GpuLogLevel, string][] = [
    ["debug", "text-gray-500"],
    ["info", "text-blue-600"],
    ["warn", "text-yellow-600"],
    ["error", "text-red-600"],
  ];

  it.each(levelColorMap)(
    "applies %s color class for %s level badge",
    (level, expectedClass) => {
      const { container } = render(<LogEntry entry={makeEntry({ level })} />);
      const badge = container.querySelector("span.uppercase");
      expect(badge?.className).toContain(expectedClass);
    },
  );

  // -----------------------------------------------------------------------
  // Expand / collapse
  // -----------------------------------------------------------------------

  it("starts in collapsed state (aria-expanded=false)", () => {
    render(
      <LogEntry
        entry={makeEntry({
          details: { foo: "bar" },
        })}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("expands on click to show details JSON", () => {
    render(
      <LogEntry
        entry={makeEntry({
          details: { retryCount: 3, region: "us-east-2" },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Details")).toBeInTheDocument();
    // Verify JSON content is rendered
    expect(screen.getByText(/retryCount/)).toBeInTheDocument();
    expect(screen.getByText(/us-east-2/)).toBeInTheDocument();
  });

  it("collapses again on second click", () => {
    render(
      <LogEntry
        entry={makeEntry({
          details: { foo: "bar" },
        })}
      />,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button); // expand
    fireEvent.click(button); // collapse

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("shows error message and stack trace when expanded", () => {
    render(
      <LogEntry
        entry={makeEntry({
          error: {
            message: "Connection refused",
            stack: "Error: Connection refused\n  at connect (net.js:42)",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
    expect(
      screen.getByText(/Error: Connection refused/),
    ).toBeInTheDocument();
  });

  it("shows error message without stack trace when stack is absent", () => {
    render(
      <LogEntry
        entry={makeEntry({
          error: { message: "Timeout exceeded" },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Timeout exceeded")).toBeInTheDocument();
  });

  it("does not show expand indicator when there are no details or error", () => {
    const { container } = render(
      <LogEntry
        entry={makeEntry({ details: undefined, error: undefined })}
      />,
    );
    // The ▶ indicator should not be present
    expect(container.textContent).not.toContain("▶");
  });

  it("shows both details and error when both are present", () => {
    render(
      <LogEntry
        entry={makeEntry({
          details: { attempt: 2 },
          error: { message: "Failed after retries" },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText(/attempt/)).toBeInTheDocument();
    expect(screen.getByText("Failed after retries")).toBeInTheDocument();
  });
});
