import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../../components/gpu/StatusBadge";
import type { GpuSessionStatus } from "../../types/gpu";

describe("StatusBadge", () => {
  const statuses: GpuSessionStatus[] = [
    "running",
    "connected",
    "creating",
    "disconnected",
    "error",
    "terminated",
  ];

  it.each(statuses)("renders capitalized text for %s status", (status) => {
    render(<StatusBadge status={status} />);
    const expected = status.charAt(0).toUpperCase() + status.slice(1);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each(statuses)(
    "includes an aria-label with the status for %s",
    (status) => {
      render(<StatusBadge status={status} />);
      const expected = status.charAt(0).toUpperCase() + status.slice(1);
      expect(
        screen.getByRole("status", {
          name: `Session status: ${expected}`,
        }),
      ).toBeInTheDocument();
    },
  );

  it("applies green color class for running status", () => {
    const { container } = render(<StatusBadge status="running" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-green-600");
  });

  it("applies blue color class for connected status", () => {
    const { container } = render(<StatusBadge status="connected" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-blue-600");
  });

  it("applies yellow color class for creating status", () => {
    const { container } = render(<StatusBadge status="creating" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-yellow-600");
  });

  it("applies orange color class for disconnected status", () => {
    const { container } = render(<StatusBadge status="disconnected" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-orange-600");
  });

  it("applies red color class for error status", () => {
    const { container } = render(<StatusBadge status="error" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-red-600");
  });

  it("applies gray color class for terminated status", () => {
    const { container } = render(<StatusBadge status="terminated" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-gray-500");
  });
});
