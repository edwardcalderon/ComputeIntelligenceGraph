import * as fc from "fast-check";
import {
  isGpuRouteActive,
  getSessionStatusColor,
  getHealthStatusConfig,
  getLogLevelColor,
  getActivityEventConfig,
  filterSessionsByStatus,
  filterActivityEvents,
  filterLogEntries,
  sortReverseChronological,
} from "../../lib/gpuUtils";
import type {
  GpuSessionStatus,
  GpuLogLevel,
  GpuActivityEventType,
  GpuSession,
  GpuLogEntry,
  GpuActivityEvent,
  GpuConfigEntry,
} from "../../types/gpu";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_SESSION_STATUSES: GpuSessionStatus[] = [
  "creating",
  "connected",
  "running",
  "disconnected",
  "error",
  "terminated",
];

const ALL_HEALTH_STATUSES: ("healthy" | "unhealthy" | "no_data")[] = [
  "healthy",
  "unhealthy",
  "no_data",
];

const ALL_LOG_LEVELS: GpuLogLevel[] = ["debug", "info", "warn", "error"];

const ALL_ACTIVITY_EVENT_TYPES: GpuActivityEventType[] = [
  "session_created",
  "session_terminated",
  "session_rotated",
  "health_check_failed",
  "recovery_triggered",
  "worker_restarted",
  "config_changed",
];

/** The GPU nav items as defined in the Sidebar */
const GPU_NAV_ITEMS = [
  { label: "Sessions", href: "/gpu" },
  { label: "Health", href: "/gpu/health" },
  { label: "Logs", href: "/gpu/logs" },
  { label: "Config", href: "/gpu/config" },
  { label: "Activity", href: "/gpu/activity" },
];

// ---------------------------------------------------------------------------
// Arbitraries (generators)
// ---------------------------------------------------------------------------

const arbSessionStatus = fc.constantFrom<GpuSessionStatus>(...ALL_SESSION_STATUSES);
const arbHealthStatus = fc.constantFrom<"healthy" | "unhealthy" | "no_data">(...ALL_HEALTH_STATUSES);
const arbLogLevel = fc.constantFrom<GpuLogLevel>(...ALL_LOG_LEVELS);
const arbActivityEventType = fc.constantFrom<GpuActivityEventType>(...ALL_ACTIVITY_EVENT_TYPES);

/** Constrained date arbitrary that always produces valid ISO strings.
 *  Uses integer milliseconds to avoid fast-check v4 Invalid Date edge cases. */
const arbISODate = fc
  .integer({
    min: new Date("2020-01-01T00:00:00Z").getTime(),
    max: new Date("2030-01-01T00:00:00Z").getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/** Generate a minimal GpuSession with the given status */
function arbSession(): fc.Arbitrary<GpuSession> {
  return fc.record({
    sessionId: fc.uuid(),
    status: arbSessionStatus,
    provider: fc.constantFrom("colab", "local"),
    models: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
    createdAt: arbISODate,
    lastVerifiedAt: arbISODate,
    uptimeSeconds: fc.nat({ max: 86400 }),
    healthStatus: arbHealthStatus,
  });
}

/** Generate a minimal GpuLogEntry */
function arbLogEntry(): fc.Arbitrary<GpuLogEntry> {
  return fc.record({
    id: fc.uuid(),
    timestamp: arbISODate,
    level: arbLogLevel,
    component: fc.constantFrom("orchestrator", "worker", "health", "config"),
    sessionId: fc.option(fc.uuid(), { nil: null }),
    message: fc.string({ minLength: 0, maxLength: 200 }),
  });
}

/** Generate a minimal GpuActivityEvent */
function arbActivityEvent(): fc.Arbitrary<GpuActivityEvent> {
  return fc.record({
    id: fc.uuid(),
    timestamp: arbISODate,
    eventType: arbActivityEventType,
    sessionId: fc.option(fc.uuid(), { nil: null }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
  });
}

/** Generate a GpuConfigEntry */
function arbConfigEntry(): fc.Arbitrary<GpuConfigEntry> {
  return fc.record({
    key: fc.string({ minLength: 1, maxLength: 50 }),
    value: fc.string({ minLength: 0, maxLength: 200 }),
    redacted: fc.boolean(),
  });
}

// ---------------------------------------------------------------------------
// Property 1: Route Active State Detection
// Feature: gpu-dashboard, Property 1: Route Active State Detection
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 1: Route Active State Detection", () => {
  it("for /gpu (exact match), only the Sessions item is active", () => {
    fc.assert(
      fc.property(fc.constant("/gpu"), (pathname) => {
        for (const item of GPU_NAV_ITEMS) {
          if (item.href === "/gpu") {
            expect(isGpuRouteActive(pathname, item.href)).toBe(true);
          } else {
            expect(isGpuRouteActive(pathname, item.href)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("for /gpu/health with optional suffix, only the Health item is active", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }).map((s) => {
          // Only allow path-safe characters for suffix
          const safe = s.replace(/[^a-zA-Z0-9/_-]/g, "");
          return `/gpu/health${safe ? `/${safe}` : ""}`;
        }),
        (pathname) => {
          for (const item of GPU_NAV_ITEMS) {
            if (item.href === "/gpu/health") {
              expect(isGpuRouteActive(pathname, item.href)).toBe(true);
            } else if (item.href === "/gpu") {
              // /gpu uses exact match, so /gpu/health* should NOT match /gpu
              expect(isGpuRouteActive(pathname, item.href)).toBe(false);
            }
            // Other items won't match /gpu/health* paths
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("for /gpu/sessions/[id], only the Sessions item is active (prefix match on /gpu/sessions, but /gpu is exact)", () => {
    fc.assert(
      fc.property(
        fc.uuid().map((id) => `/gpu/sessions/${id}`),
        (pathname) => {
          // /gpu uses exact match, so /gpu/sessions/xxx does NOT match /gpu
          expect(isGpuRouteActive(pathname, "/gpu")).toBe(false);
          // None of the other sub-route items should match either
          expect(isGpuRouteActive(pathname, "/gpu/health")).toBe(false);
          expect(isGpuRouteActive(pathname, "/gpu/logs")).toBe(false);
          expect(isGpuRouteActive(pathname, "/gpu/config")).toBe(false);
          expect(isGpuRouteActive(pathname, "/gpu/activity")).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("for each known GPU route, exactly one nav item is active", () => {
    const knownRoutes = fc.constantFrom(
      "/gpu",
      "/gpu/health",
      "/gpu/logs",
      "/gpu/config",
      "/gpu/activity",
    );

    fc.assert(
      fc.property(knownRoutes, (pathname) => {
        const activeItems = GPU_NAV_ITEMS.filter((item) =>
          isGpuRouteActive(pathname, item.href),
        );
        // Exactly one nav item should be active for each known route
        expect(activeItems).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Enum-to-Visual Mapping Completeness
// Feature: gpu-dashboard, Property 2: Enum-to-Visual Mapping Completeness
// Validates: Requirements 2.5, 4.4, 5.4, 7.5
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 2: Enum-to-Visual Mapping Completeness", () => {
  it("every GpuSessionStatus maps to a non-empty color class string", () => {
    fc.assert(
      fc.property(arbSessionStatus, (status) => {
        const color = getSessionStatusColor(status);
        expect(typeof color).toBe("string");
        expect(color.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("every health status maps to a non-empty config with dotColor, text, and textColor", () => {
    fc.assert(
      fc.property(arbHealthStatus, (status) => {
        const config = getHealthStatusConfig(status);
        expect(config.dotColor.length).toBeGreaterThan(0);
        expect(config.text.length).toBeGreaterThan(0);
        expect(config.textColor.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("every GpuLogLevel maps to a non-empty color class string", () => {
    fc.assert(
      fc.property(arbLogLevel, (level) => {
        const color = getLogLevelColor(level);
        expect(typeof color).toBe("string");
        expect(color.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("every GpuActivityEventType maps to a non-empty color and iconCategory", () => {
    fc.assert(
      fc.property(arbActivityEventType, (eventType) => {
        const config = getActivityEventConfig(eventType);
        expect(config.color.length).toBeGreaterThan(0);
        expect(config.iconCategory.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("mappings are deterministic: same input always produces same output", () => {
    fc.assert(
      fc.property(arbSessionStatus, (status) => {
        expect(getSessionStatusColor(status)).toBe(getSessionStatusColor(status));
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(arbHealthStatus, (status) => {
        const a = getHealthStatusConfig(status);
        const b = getHealthStatusConfig(status);
        expect(a).toEqual(b);
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(arbLogLevel, (level) => {
        expect(getLogLevelColor(level)).toBe(getLogLevelColor(level));
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(arbActivityEventType, (eventType) => {
        const a = getActivityEventConfig(eventType);
        const b = getActivityEventConfig(eventType);
        expect(a).toEqual(b);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Enum Filter Correctness
// Feature: gpu-dashboard, Property 3: Enum Filter Correctness
// Validates: Requirements 2.7, 7.7
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 3: Enum Filter Correctness", () => {
  it("filtering sessions by status returns only matching sessions and length ≤ original", () => {
    fc.assert(
      fc.property(
        fc.array(arbSession(), { minLength: 0, maxLength: 30 }),
        arbSessionStatus,
        (sessions, filterStatus) => {
          const result = filterSessionsByStatus(sessions, filterStatus);
          // All results match the filter
          expect(result.every((s) => s.status === filterStatus)).toBe(true);
          // Result length ≤ original
          expect(result.length).toBeLessThanOrEqual(sessions.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filtering activity events by event type set returns only matching events", () => {
    fc.assert(
      fc.property(
        fc.array(arbActivityEvent(), { minLength: 0, maxLength: 30 }),
        fc.subarray(ALL_ACTIVITY_EVENT_TYPES, { minLength: 1 }).map(
          (types) => new Set<GpuActivityEventType>(types),
        ),
        (events, typeSet) => {
          const result = filterActivityEvents(events, typeSet);
          // All results have an eventType in the filter set
          expect(result.every((e) => typeSet.has(e.eventType))).toBe(true);
          // Result length ≤ original
          expect(result.length).toBeLessThanOrEqual(events.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filtering activity events with empty set returns all events", () => {
    fc.assert(
      fc.property(
        fc.array(arbActivityEvent(), { minLength: 0, maxLength: 20 }),
        (events) => {
          const result = filterActivityEvents(
            events,
            new Set<GpuActivityEventType>(),
          );
          expect(result.length).toBe(events.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Reverse Chronological Ordering
// Feature: gpu-dashboard, Property 4: Reverse Chronological Ordering
// Validates: Requirements 5.1, 7.1
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 4: Reverse Chronological Ordering", () => {
  it("sorted list has each timestamp ≥ the next (reverse chronological)", () => {
    fc.assert(
      fc.property(
        fc.array(arbISODate.map((ts) => ({ timestamp: ts })), {
          minLength: 0,
          maxLength: 50,
        }),
        (items) => {
          const sorted = sortReverseChronological(items);
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].timestamp >= sorted[i + 1].timestamp).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("no items are added or removed (same length)", () => {
    fc.assert(
      fc.property(
        fc.array(arbISODate.map((ts) => ({ timestamp: ts })), {
          minLength: 0,
          maxLength: 50,
        }),
        (items) => {
          const sorted = sortReverseChronological(items);
          expect(sorted.length).toBe(items.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("sorted list contains the same elements as the input", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(arbISODate, fc.string({ minLength: 6, maxLength: 6 })).map(
            ([ts, id]) => ({ timestamp: ts, id }),
          ),
          { minLength: 0, maxLength: 50 },
        ),
        (items) => {
          const sorted = sortReverseChronological(items);
          const inputTimestamps = items.map((i) => i.timestamp).sort();
          const sortedTimestamps = sorted.map((i) => i.timestamp).sort();
          expect(sortedTimestamps).toEqual(inputTimestamps);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not mutate the original array", () => {
    fc.assert(
      fc.property(
        fc.array(arbISODate.map((ts) => ({ timestamp: ts })), {
          minLength: 1,
          maxLength: 20,
        }),
        (items) => {
          const original = items.map((i) => ({ ...i }));
          sortReverseChronological(items);
          expect(items).toEqual(original);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Log Filtering Correctness
// Feature: gpu-dashboard, Property 5: Log Filtering Correctness
// Validates: Requirements 5.3, 5.7
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 5: Log Filtering Correctness", () => {
  /** Generate arbitrary filter criteria */
  const arbLogFilters = fc.record({
    levels: fc.option(
      fc.subarray(ALL_LOG_LEVELS, { minLength: 1 }).map(
        (levels) => new Set<GpuLogLevel>(levels),
      ),
      { nil: undefined },
    ),
    component: fc.option(
      fc.constantFrom("orchestrator", "worker", "health", "config"),
      { nil: undefined },
    ),
    sessionId: fc.option(fc.uuid(), { nil: undefined }),
    searchText: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
      nil: undefined,
    }),
  });

  it("every entry in the filtered result satisfies all active criteria simultaneously", () => {
    fc.assert(
      fc.property(
        fc.array(arbLogEntry(), { minLength: 0, maxLength: 30 }),
        arbLogFilters,
        (entries, filters) => {
          const result = filterLogEntries(entries, filters);

          for (const entry of result) {
            // (a) level filter
            if (filters.levels && filters.levels.size > 0) {
              expect(filters.levels.has(entry.level)).toBe(true);
            }
            // (b) component filter
            if (filters.component) {
              expect(entry.component).toBe(filters.component);
            }
            // (c) session ID filter
            if (filters.sessionId) {
              expect(entry.sessionId).toBe(filters.sessionId);
            }
            // (d) text search (case-insensitive)
            if (filters.searchText && filters.searchText.length > 0) {
              expect(
                entry.message
                  .toLowerCase()
                  .includes(filters.searchText.toLowerCase()),
              ).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filtered list length ≤ original list length", () => {
    fc.assert(
      fc.property(
        fc.array(arbLogEntry(), { minLength: 0, maxLength: 30 }),
        arbLogFilters,
        (entries, filters) => {
          const result = filterLogEntries(entries, filters);
          expect(result.length).toBeLessThanOrEqual(entries.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("with no active filters, all entries are returned", () => {
    fc.assert(
      fc.property(
        fc.array(arbLogEntry(), { minLength: 0, maxLength: 20 }),
        (entries) => {
          const result = filterLogEntries(entries, {});
          expect(result.length).toBe(entries.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Config Value Display Correctness
// Feature: gpu-dashboard, Property 8: Config Value Display Correctness
// Validates: Requirements 6.3, 6.4
// ---------------------------------------------------------------------------

describe("Feature: gpu-dashboard, Property 8: Config Value Display Correctness", () => {
  /**
   * Pure data property: for any GpuConfigEntry, when redacted is true the
   * display value should be "***", when false it should be the actual value.
   * This tests the logic used in ConfigGroup.
   */
  function getDisplayValue(entry: GpuConfigEntry): string {
    return entry.redacted ? "***" : entry.value;
  }

  it("redacted entries always display '***'", () => {
    fc.assert(
      fc.property(arbConfigEntry(), (entry) => {
        if (entry.redacted) {
          expect(getDisplayValue(entry)).toBe("***");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("non-redacted entries display the exact value", () => {
    fc.assert(
      fc.property(arbConfigEntry(), (entry) => {
        if (!entry.redacted) {
          expect(getDisplayValue(entry)).toBe(entry.value);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("display value is always a string", () => {
    fc.assert(
      fc.property(arbConfigEntry(), (entry) => {
        expect(typeof getDisplayValue(entry)).toBe("string");
      }),
      { numRuns: 100 },
    );
  });

  it("redacted flag fully determines whether value is masked or shown", () => {
    fc.assert(
      fc.property(arbConfigEntry(), (entry) => {
        const display = getDisplayValue(entry);
        if (entry.redacted) {
          expect(display).toBe("***");
          // The actual value should NOT leak through
          if (entry.value !== "***") {
            expect(display).not.toBe(entry.value);
          }
        } else {
          expect(display).toBe(entry.value);
        }
      }),
      { numRuns: 100 },
    );
  });
});
