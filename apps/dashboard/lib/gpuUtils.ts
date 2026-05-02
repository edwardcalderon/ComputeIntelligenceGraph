import type {
  GpuSessionStatus,
  GpuLogLevel,
  GpuActivityEventType,
  GpuSession,
  GpuLogEntry,
  GpuActivityEvent,
} from "../types/gpu";

// ---------------------------------------------------------------------------
// React Query key factory – all keys namespaced under ["gpu"]
// ---------------------------------------------------------------------------

export const gpuKeys = {
  all: ["gpu"] as const,
  sessions: ["gpu", "sessions"] as const,
  session: (id: string) => ["gpu", "sessions", id] as const,
  health: ["gpu", "health"] as const,
  logs: ["gpu", "logs"] as const,
  config: ["gpu", "config"] as const,
  activity: ["gpu", "activity"] as const,
};

// ---------------------------------------------------------------------------
// Status → Tailwind color class mapping
// ---------------------------------------------------------------------------

const SESSION_STATUS_COLORS: Record<GpuSessionStatus, string> = {
  running: "text-green-600 dark:text-green-400",
  connected: "text-blue-600 dark:text-blue-400",
  creating: "text-yellow-600 dark:text-yellow-400",
  disconnected: "text-orange-600 dark:text-orange-400",
  error: "text-red-600 dark:text-red-400",
  terminated: "text-gray-500 dark:text-gray-400",
};

/** Returns Tailwind class strings for a given session status. */
export function getSessionStatusColor(status: GpuSessionStatus): string {
  return SESSION_STATUS_COLORS[status];
}

// ---------------------------------------------------------------------------
// Health status config
// ---------------------------------------------------------------------------

export interface HealthStatusConfig {
  dotColor: string;
  text: string;
  textColor: string;
}

const HEALTH_STATUS_CONFIG: Record<
  "healthy" | "unhealthy" | "no_data",
  HealthStatusConfig
> = {
  healthy: {
    dotColor: "bg-green-500",
    text: "Healthy",
    textColor: "text-green-700 dark:text-green-400",
  },
  unhealthy: {
    dotColor: "bg-red-500",
    text: "Unhealthy",
    textColor: "text-red-700 dark:text-red-400",
  },
  no_data: {
    dotColor: "bg-gray-400",
    text: "No Data",
    textColor: "text-gray-600 dark:text-gray-400",
  },
};

/** Returns config object (dotColor, text, textColor) for a health status. */
export function getHealthStatusConfig(
  status: "healthy" | "unhealthy" | "no_data",
): HealthStatusConfig {
  return HEALTH_STATUS_CONFIG[status];
}

// ---------------------------------------------------------------------------
// Log level → Tailwind color class mapping
// ---------------------------------------------------------------------------

const LOG_LEVEL_COLORS: Record<GpuLogLevel, string> = {
  debug: "text-gray-500 dark:text-gray-400",
  info: "text-blue-600 dark:text-blue-400",
  warn: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
};

/** Returns Tailwind class strings for a given log level. */
export function getLogLevelColor(level: GpuLogLevel): string {
  return LOG_LEVEL_COLORS[level];
}

// ---------------------------------------------------------------------------
// Activity event → color / icon category mapping
// ---------------------------------------------------------------------------

export interface ActivityEventConfig {
  color: string;
  iconCategory: string;
}

const ACTIVITY_EVENT_CONFIG: Record<GpuActivityEventType, ActivityEventConfig> =
  {
    session_created: {
      color: "text-green-600 dark:text-green-400",
      iconCategory: "plus-circle",
    },
    session_terminated: {
      color: "text-red-600 dark:text-red-400",
      iconCategory: "x-circle",
    },
    session_rotated: {
      color: "text-blue-600 dark:text-blue-400",
      iconCategory: "refresh",
    },
    health_check_failed: {
      color: "text-red-600 dark:text-red-400",
      iconCategory: "alert-triangle",
    },
    recovery_triggered: {
      color: "text-yellow-600 dark:text-yellow-400",
      iconCategory: "wrench",
    },
    worker_restarted: {
      color: "text-yellow-600 dark:text-yellow-400",
      iconCategory: "rotate",
    },
    config_changed: {
      color: "text-gray-500 dark:text-gray-400",
      iconCategory: "settings",
    },
  };

/** Returns color and icon category config for an activity event type. */
export function getActivityEventConfig(
  eventType: GpuActivityEventType,
): ActivityEventConfig {
  return ACTIVITY_EVENT_CONFIG[eventType];
}

// ---------------------------------------------------------------------------
// Route active-state detection
// ---------------------------------------------------------------------------

/**
 * Determines whether a GPU navigation item should be highlighted.
 *
 * - `/gpu` uses an **exact** match (so `/gpu/health` does NOT highlight it).
 * - All other `/gpu/*` hrefs use a **prefix** match.
 */
export function isGpuRouteActive(pathname: string, href: string): boolean {
  if (href === "/gpu") {
    return pathname === "/gpu";
  }
  return pathname.startsWith(href);
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/** Filter sessions by a single status value. */
export function filterSessionsByStatus(
  sessions: GpuSession[],
  status: GpuSessionStatus,
): GpuSession[] {
  return sessions.filter((s) => s.status === status);
}

/** Filter criteria for log entries. All fields are optional. */
export interface LogFilterCriteria {
  levels?: Set<GpuLogLevel>;
  component?: string;
  sessionId?: string;
  searchText?: string;
}

/** Filter log entries by any combination of level set, component, sessionId, and text search. */
export function filterLogEntries(
  entries: GpuLogEntry[],
  filters: LogFilterCriteria,
): GpuLogEntry[] {
  return entries.filter((entry) => {
    if (filters.levels && filters.levels.size > 0 && !filters.levels.has(entry.level)) {
      return false;
    }
    if (filters.component && entry.component !== filters.component) {
      return false;
    }
    if (filters.sessionId && entry.sessionId !== filters.sessionId) {
      return false;
    }
    if (filters.searchText && filters.searchText.length > 0) {
      if (
        !entry.message.toLowerCase().includes(filters.searchText.toLowerCase())
      ) {
        return false;
      }
    }
    return true;
  });
}

/** Filter activity events by a set of event types. */
export function filterActivityEvents(
  events: GpuActivityEvent[],
  eventTypes: Set<GpuActivityEventType>,
): GpuActivityEvent[] {
  if (eventTypes.size === 0) {
    return events;
  }
  return events.filter((e) => eventTypes.has(e.eventType));
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Sort timestamped items in reverse chronological order (newest first). */
export function sortReverseChronological<T extends { timestamp: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
