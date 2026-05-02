import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogFilters } from "../../components/gpu/LogFilters";
import type { LogFilterCriteria } from "../../lib/gpuUtils";

describe("LogFilters", () => {
  const emptyFilters: LogFilterCriteria = {};

  it("renders all four log level checkboxes", () => {
    const onChange = jest.fn();
    render(<LogFilters filters={emptyFilters} onChange={onChange} />);

    expect(screen.getByLabelText("Filter by debug level")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by info level")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by warn level")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by error level")).toBeInTheDocument();
  });

  it("renders component dropdown with 'All components' default", () => {
    const onChange = jest.fn();
    render(<LogFilters filters={emptyFilters} onChange={onChange} />);

    const select = screen.getByLabelText("Component");
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("");
  });

  it("renders available components as dropdown options", () => {
    const onChange = jest.fn();
    render(
      <LogFilters
        filters={emptyFilters}
        onChange={onChange}
        availableComponents={["orchestrator", "health-checker", "worker"]}
      />,
    );

    const select = screen.getByLabelText("Component") as HTMLSelectElement;
    // "All components" + 3 component options
    expect(select.options).toHaveLength(4);
    expect(screen.getByText("orchestrator")).toBeInTheDocument();
    expect(screen.getByText("health-checker")).toBeInTheDocument();
    expect(screen.getByText("worker")).toBeInTheDocument();
  });

  it("renders session ID text input", () => {
    const onChange = jest.fn();
    render(<LogFilters filters={emptyFilters} onChange={onChange} />);

    expect(screen.getByLabelText("Session ID")).toBeInTheDocument();
  });

  it("renders search text input", () => {
    const onChange = jest.fn();
    render(<LogFilters filters={emptyFilters} onChange={onChange} />);

    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("calls onChange when a log level checkbox is toggled on", () => {
    const onChange = jest.fn();
    render(<LogFilters filters={emptyFilters} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Filter by error level"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newFilters = onChange.mock.calls[0][0] as LogFilterCriteria;
    expect(newFilters.levels).toBeInstanceOf(Set);
    expect(newFilters.levels!.has("error")).toBe(true);
  });

  it("calls onChange when a log level checkbox is toggled off", () => {
    const onChange = jest.fn();
    const filters: LogFilterCriteria = {
      levels: new Set(["error", "warn"]) as Set<"debug" | "info" | "warn" | "error">,
    };
    render(<LogFilters filters={filters} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Filter by error level"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newFilters = onChange.mock.calls[0][0] as LogFilterCriteria;
    expect(newFilters.levels!.has("error")).toBe(false);
    expect(newFilters.levels!.has("warn")).toBe(true);
  });

  it("calls onChange when component dropdown changes", () => {
    const onChange = jest.fn();
    render(
      <LogFilters
        filters={emptyFilters}
        onChange={onChange}
        availableComponents={["orchestrator", "worker"]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Component"), {
      target: { value: "orchestrator" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].component).toBe("orchestrator");
  });

  it("clears component filter when 'All components' is selected", () => {
    const onChange = jest.fn();
    const filters: LogFilterCriteria = { component: "orchestrator" };
    render(
      <LogFilters
        filters={filters}
        onChange={onChange}
        availableComponents={["orchestrator", "worker"]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Component"), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].component).toBeUndefined();
  });

  it("calls onChange when session ID input changes", () => {
    const onChange = jest.fn();
    render(<LogFilters filters={emptyFilters} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Session ID"), {
      target: { value: "sess-123" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].sessionId).toBe("sess-123");
  });

  it("calls onChange when search text input changes", () => {
    const onChange = jest.fn();
    render(<LogFilters filters={emptyFilters} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "connection failed" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].searchText).toBe("connection failed");
  });

  it("reflects current filter state in inputs", () => {
    const onChange = jest.fn();
    const filters: LogFilterCriteria = {
      levels: new Set(["info", "error"]) as Set<"debug" | "info" | "warn" | "error">,
      component: "worker",
      sessionId: "sess-abc",
      searchText: "timeout",
    };
    render(
      <LogFilters
        filters={filters}
        onChange={onChange}
        availableComponents={["orchestrator", "worker"]}
      />,
    );

    // Level checkboxes reflect state
    expect(screen.getByLabelText("Filter by info level")).toBeChecked();
    expect(screen.getByLabelText("Filter by error level")).toBeChecked();
    expect(screen.getByLabelText("Filter by debug level")).not.toBeChecked();
    expect(screen.getByLabelText("Filter by warn level")).not.toBeChecked();

    // Component dropdown
    expect(screen.getByLabelText("Component")).toHaveValue("worker");

    // Session ID input
    expect(screen.getByLabelText("Session ID")).toHaveValue("sess-abc");

    // Search input
    expect(screen.getByLabelText("Search")).toHaveValue("timeout");
  });
});
