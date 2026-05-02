import {
  getSessionStatusColor,
  getHealthStatusConfig,
  getLogLevelColor,
  getActivityEventConfig,
  isGpuRouteActive,
  filterSessionsByStatus,
  filterLogEntries,
  filterActivityEvents,
  sortReverseChronological,
  gpuKeys,
} from "../../lib/gpuUtils";
import type {
  GpuSessionStatus,
  GpuLogLevel,
  GpuActivityEventType,
  GpuSession,
  GpuLogEntry,
  GpuActivityEvent,
} from "../../types/gpu";

// ---------------------------------------------------------------------------
// gpuKeys
// ---------------------------------------------------------------------------

describe("gpuKeys", () => {
  it("has correct static keys", () => {
    expect(gpuKeys.all).toEqual(["gpu"]);
    expect(gpuKeys.sessions).toEqual(["gpu", "sessions"]);
    expect(gpuKeys.health).toEqual(["gpu", "health"]);
    expect(gpuKeys.logs).toEqual(["gpu", "logs"]);
    expect(gpuKeys.config).toEqual(["gpu", "config"]);
    expect(gpuKeys.activity).toEqual(["gpu", "activity"]);
  });

  it("generates session key with id", () => {
    expect(gpuKeys.session("abc-123")).toEqual(["gpu", "sessions", "abc-123"]);
  });
});

// ---------------------------------------------------------------------------
// getSessionStatusColor
// ---------------------------------------------------------------------------

describe("getSessionStatusColor", () => {
  const cases: [GpuSessionStatus, string][] = [
    ["running", "text-green-600 dark:text-green-400"],
    ["connected", "text-blue-600 dark:text-blue-400"],
    ["creating", "text-yellow-600 dark:text-yellow-400"],
    ["disconnected", "text-orange-600 dark:text-orange-400"],
    ["error", "text-red-600 dark:text-red-400"],
    ["terminated", "text-gray-500 dark:text-gray-400"],
  ];

  it.each(cases)("returns correct color for %s", (status, expected) => {
    expect(getSessionStatusColor(status)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getHealthStatusConfig
// ---------------------------------------------------------------------------

describe("getHealthStatusConfig", () => {
  it("returns green config for healthy", () => {
    const config = getHealthStatusConfig("healthy");
    expect(config.dotColor).toBe("bg-green-500");
    expect(config.text).toBe("Healthy");
    expect(config.textColor).toContain("green");
  });

  it("returns red config for unhealthy", () => {
    const config = getHealthStatusConfig("unhealthy");
    expect(config.dotColor).toBe("bg-red-500");
    expect(config.text).toBe("Unhealthy");
    expect(config.textColor).toContain("red");
  });

  it("returns gray config for no_data", () => {
    const config = getHealthStatusConfig("no_data");
    expect(config.dotColor).toBe("bg-gray-400");
    expect(config.text).toBe("No Data");
    expect(config.textColor).toContain("gray");
  });
});

// ---------------------------------------------------------------------------
// getLogLevelColor
// ---------------------------------------------------------------------------

describe("getLogLevelColor", () => {
  const cases: [GpuLogLevel, string][] = [
    ["debug", "text-gray-500 dark:text-gray-400"],
    ["info", "text-blue-600 dark:text-blue-400"],
    ["warn", "text-yellow-600 dark:text-yellow-400"],
    ["error", "text-red-600 dark:text-red-400"],
  ];

  it.each(cases)("returns correct color for %s", (level, expected) => {
    expect(getLogLevelColor(level)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getActivityEventConfig
// ---------------------------------------------------------------------------

describe("getActivityEventConfig", () => {
  it("returns green/plus-circle for session_created", () => {
    const config = getActivityEventConfig("session_created");
    expect(config.color).toContain("green");
    expect(config.iconCategory).toBe("plus-circle");
  });

  it("returns red/x-circle for session_terminated", () => {
    const config = getActivityEventConfig("session_terminated");
    expect(config.color).toContain("red");
    expect(config.iconCategory).toBe("x-circle");
  });

  it("returns blue/refresh for session_rotated", () => {
    const config = getActivityEventConfig("session_rotated");
    expect(config.color).toContain("blue");
    expect(config.iconCategory).toBe("refresh");
  });

  it("returns red/alert-triangle for health_check_failed", () => {
    const config = getActivityEventConfig("health_check_failed");
    expect(config.color).toContain("red");
    expect(config.iconCategory).toBe("alert-triangle");
  });

  it("returns yellow/wrench for recovery_triggered", () => {
    const config = getActivityEventConfig("recovery_triggered");
    expect(config.color).toContain("yellow");
    expect(config.iconCategory).toBe("wrench");
  });

  it("returns yellow/rotate for worker_restarted", () => {
    const config = getActivityEventConfig("worker_restarted");
    expect(config.color).toContain("yellow");
    expect(config.iconCategory).toBe("rotate");
  });

  it("returns gray/settings for config_changed", () => {
    const config = getActivityEventConfig("config_changed");
    expect(config.color).toContain("gray");
    expect(config.iconCategory).toBe("settings");
  });
});

// ---------------------------------------------------------------------------
// isGpuRouteActive
// ---------------------------------------------------------------------------

describe("isGpuRouteActive", () => {
  it("exact-matches /gpu for the sessions nav item", () => {
    expect(isGpuRouteActive("/gpu", "/gpu")).toBe(true);
  });

  it("does NOT match /gpu/health for the /gpu nav item", () => {
    expect(isGpuRouteActive("/gpu/health", "/gpu")).toBe(false);
  });

  it("prefix-matches /gpu/health for the health nav item", () => {
    expect(isGpuRouteActive("/gpu/health", "/gpu/health")).toBe(true);
  });

  it("prefix-matches /gpu/sessions/abc for /gpu/sessions", () => {
    expect(isGpuRouteActive("/gpu/sessions/abc", "/gpu/sessions")).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(isGpuRouteActive("/resources", "/gpu")).toBe(false);
    expect(isGpuRouteActive("/resources", "/gpu/health")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterSessionsByStatus
// ---------------------------------------------------------------------------

describe("filterSessionsByStatus", () => {
  const sessions: GpuSession[] = [
    makeSession("s1", "running"),
    makeSession("s2", "error"),
    makeSession("s3", "running"),
    makeSession("s4", "terminated"),
  ];

  it("returns only sessions matching the given status", () => {
    const result = filterSessionsByStatus(sessions, "running");
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.status === "running")).toBe(true);
  });

  it("returns empty array when no sessions match", () => {
    expect(filterSessionsByStatus(sessions, "creating")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterLogEntries
// ---------------------------------------------------------------------------

describe("filterLogEntries", () => {
  const entries: GpuLogEntry[] = [
    makeLogEntry("1", "info", "orchestrator", "sess-1", "Session started"),
    makeLogEntry("2", "error", "worker", "sess-1", "Worker crashed"),
    makeLogEntry("3", "debug", "orchestrator", null, "Tick"),
    makeLogEntry("4", "warn", "health", "sess-2", "Heartbeat stale"),
  ];

  it("filters by level set", () => {
    const result = filterLogEntries(entries, {
      levels: new Set<GpuLogLevel>(["error", "warn"]),
    });
    expect(result).toHaveLength(2);
  });

  it("filters by component", () => {
    const result = filterLogEntries(entries, { component: "orchestrator" });
    expect(result).toHaveLength(2);
  });

  it("filters by sessionId", () => {
    const result = filterLogEntries(entries, { sessionId: "sess-1" });
    expect(result).toHaveLength(2);
  });

  it("filters by text search (case-insensitive)", () => {
    const result = filterLogEntries(entries, { searchText: "CRASHED" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("applies all filters simultaneously", () => {
    const result = filterLogEntries(entries, {
      levels: new Set<GpuLogLevel>(["info", "error"]),
      component: "orchestrator",
      sessionId: "sess-1",
      searchText: "started",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns all entries when no filters are active", () => {
    expect(filterLogEntries(entries, {})).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// filterActivityEvents
// ---------------------------------------------------------------------------

describe("filterActivityEvents", () => {
  const events: GpuActivityEvent[] = [
    makeEvent("e1", "session_created"),
    makeEvent("e2", "health_check_failed"),
    makeEvent("e3", "config_changed"),
    makeEvent("e4", "session_created"),
  ];

  it("filters by event type set", () => {
    const result = filterActivityEvents(
      events,
      new Set<GpuActivityEventType>(["session_created"]),
    );
    expect(result).toHaveLength(2);
  });

  it("returns all events when the set is empty", () => {
    expect(
      filterActivityEvents(events, new Set<GpuActivityEventType>()),
    ).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// sortReverseChronological
// ---------------------------------------------------------------------------

describe("sortReverseChronological", () => {
  it("sorts items newest first", () => {
    const items = [
      { timestamp: "2024-01-01T00:00:00Z" },
      { timestamp: "2024-03-01T00:00:00Z" },
      { timestamp: "2024-02-01T00:00:00Z" },
    ];
    const sorted = sortReverseChronological(items);
    expect(sorted[0].timestamp).toBe("2024-03-01T00:00:00Z");
    expect(sorted[1].timestamp).toBe("2024-02-01T00:00:00Z");
    expect(sorted[2].timestamp).toBe("2024-01-01T00:00:00Z");
  });

  it("does not mutate the original array", () => {
    const items = [
      { timestamp: "2024-01-01T00:00:00Z" },
      { timestamp: "2024-03-01T00:00:00Z" },
    ];
    const original = [...items];
    sortReverseChronological(items);
    expect(items).toEqual(original);
  });

  it("preserves all items", () => {
    const items = [
      { timestamp: "2024-01-01T00:00:00Z" },
      { timestamp: "2024-02-01T00:00:00Z" },
    ];
    expect(sortReverseChronological(items)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeSession(
  sessionId: string,
  status: GpuSessionStatus,
): GpuSession {
  return {
    sessionId,
    status,
    provider: "colab",
    models: ["llama3"],
    createdAt: "2024-01-01T00:00:00Z",
    lastVerifiedAt: "2024-01-01T00:00:00Z",
    uptimeSeconds: 3600,
    healthStatus: "healthy",
  };
}

function makeLogEntry(
  id: string,
  level: GpuLogLevel,
  component: string,
  sessionId: string | null,
  message: string,
): GpuLogEntry {
  return {
    id,
    timestamp: "2024-01-01T00:00:00Z",
    level,
    component,
    sessionId,
    message,
  };
}

function makeEvent(
  id: string,
  eventType: GpuActivityEventType,
): GpuActivityEvent {
  return {
    id,
    timestamp: "2024-01-01T00:00:00Z",
    eventType,
    sessionId: null,
    description: `Event ${id}`,
  };
}
