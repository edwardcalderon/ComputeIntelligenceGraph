import React from "react";
import { render, screen } from "@testing-library/react";
import { TimelineEvent } from "../../components/gpu/TimelineEvent";
import type { GpuActivityEvent, GpuActivityEventType } from "../../types/gpu";

// Mock next/link to render a plain anchor so we can inspect href
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
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

/** Helper to build a minimal valid activity event. */
function makeEvent(
  overrides: Partial<GpuActivityEvent> = {},
): GpuActivityEvent {
  return {
    id: "evt-1",
    timestamp: "2025-06-01T14:00:00.000Z",
    eventType: "session_created",
    sessionId: "sess-abc",
    description: "New GPU session created",
    ...overrides,
  };
}

describe("TimelineEvent", () => {
  // -----------------------------------------------------------------------
  // Required fields rendering
  // -----------------------------------------------------------------------

  it("renders the formatted timestamp", () => {
    render(<TimelineEvent event={makeEvent()} />);
    // toLocaleString output varies by environment; check for year fragment
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it("renders the event type as human-readable text", () => {
    render(<TimelineEvent event={makeEvent({ eventType: "session_created" })} />);
    expect(screen.getByText("session created")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(
      <TimelineEvent
        event={makeEvent({ description: "Worker restarted after failure" })}
      />,
    );
    expect(
      screen.getByText("Worker restarted after failure"),
    ).toBeInTheDocument();
  });

  it("renders the event icon", () => {
    render(<TimelineEvent event={makeEvent()} />);
    expect(screen.getByTestId("event-icon")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Session ID link
  // -----------------------------------------------------------------------

  it("renders session ID as a link to the session detail page", () => {
    render(<TimelineEvent event={makeEvent({ sessionId: "sess-xyz" })} />);
    const link = screen.getByRole("link", { name: "sess-xyz" });
    expect(link).toHaveAttribute("href", "/gpu/sessions/sess-xyz");
  });

  it("does not render a session link when sessionId is null", () => {
    render(<TimelineEvent event={makeEvent({ sessionId: null })} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Event type icon + color mapping
  // -----------------------------------------------------------------------

  const eventTypeTests: [GpuActivityEventType, string][] = [
    ["session_created", "text-green-600"],
    ["session_terminated", "text-red-600"],
    ["session_rotated", "text-blue-600"],
    ["health_check_failed", "text-red-600"],
    ["recovery_triggered", "text-yellow-600"],
    ["worker_restarted", "text-yellow-600"],
    ["config_changed", "text-gray-500"],
  ];

  it.each(eventTypeTests)(
    "applies correct color class for %s event type",
    (eventType, expectedClass) => {
      const { container } = render(
        <TimelineEvent event={makeEvent({ eventType })} />,
      );
      // The icon wrapper span should contain the color class
      const iconWrapper = container.querySelector("[aria-hidden='true']");
      expect(iconWrapper?.className).toContain(expectedClass);
    },
  );

  it.each(eventTypeTests)(
    "renders an icon for %s event type",
    (eventType) => {
      render(<TimelineEvent event={makeEvent({ eventType })} />);
      expect(screen.getByTestId("event-icon")).toBeInTheDocument();
    },
  );

  // -----------------------------------------------------------------------
  // Event type label formatting
  // -----------------------------------------------------------------------

  const labelTests: [GpuActivityEventType, string][] = [
    ["session_created", "session created"],
    ["session_terminated", "session terminated"],
    ["session_rotated", "session rotated"],
    ["health_check_failed", "health check failed"],
    ["recovery_triggered", "recovery triggered"],
    ["worker_restarted", "worker restarted"],
    ["config_changed", "config changed"],
  ];

  it.each(labelTests)(
    "formats %s event type as '%s'",
    (eventType, expectedLabel) => {
      render(<TimelineEvent event={makeEvent({ eventType })} />);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    },
  );
});
