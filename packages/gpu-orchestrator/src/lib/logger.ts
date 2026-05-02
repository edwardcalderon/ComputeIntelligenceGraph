/**
 * Structured JSON logger for the GPU Orchestrator.
 *
 * Outputs one JSON object per line to stdout with fields:
 * `timestamp` (ISO 8601), `level`, `component`, `sessionId`, `message`,
 * and optional `error` details.
 *
 * @module
 */

/** Supported log levels ordered by severity. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/** Numeric severity for level filtering. */
const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

/** Optional error details attached to a log entry. */
export interface LogErrorDetails {
  name: string;
  message: string;
  stack?: string;
  category?: string;
  context?: Record<string, unknown>;
}

/** A single structured log entry. */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  sessionId: string;
  message: string;
  error?: LogErrorDetails;
}

/** Options for constructing a Logger instance. */
export interface LoggerOptions {
  component: string;
  sessionId: string;
  /** Minimum log level to emit. Defaults to `'debug'`. */
  minLevel?: LogLevel;
  /** Custom write function for testing. Defaults to `process.stdout.write`. */
  writer?: (line: string) => void;
}

/**
 * Structured JSON logger that outputs one JSON object per line.
 *
 * Each log entry contains `timestamp`, `level`, `component`, `sessionId`,
 * `message`, and optional `error` details.
 */
export class Logger {
  private readonly component: string;
  private readonly sessionId: string;
  private readonly minSeverity: number;
  private readonly write: (line: string) => void;

  constructor(options: LoggerOptions) {
    this.component = options.component;
    this.sessionId = options.sessionId;
    this.minSeverity = LOG_LEVEL_SEVERITY[options.minLevel ?? 'debug'];
    this.write =
      options.writer ?? ((line: string) => process.stdout.write(line + '\n'));
  }

  /** Log at `debug` level. */
  debug(message: string, error?: Error): void {
    this.log('debug', message, error);
  }

  /** Log at `info` level. */
  info(message: string, error?: Error): void {
    this.log('info', message, error);
  }

  /** Log at `warn` level. */
  warn(message: string, error?: Error): void {
    this.log('warn', message, error);
  }

  /** Log at `error` level. */
  error(message: string, error?: Error): void {
    this.log('error', message, error);
  }

  /** Log at `critical` level. */
  critical(message: string, error?: Error): void {
    this.log('critical', message, error);
  }

  /**
   * Create a child logger that inherits the session ID but uses a different component name.
   */
  child(component: string): Logger {
    return new Logger({
      component,
      sessionId: this.sessionId,
      minLevel: this.currentMinLevel(),
      writer: this.write,
    });
  }

  /**
   * Core logging method. Builds a structured JSON entry and writes it as a single line.
   */
  private log(level: LogLevel, message: string, error?: Error): void {
    if (LOG_LEVEL_SEVERITY[level] < this.minSeverity) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      sessionId: this.sessionId,
      message,
    };

    if (error) {
      const errorDetails: LogErrorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };

      // Attach OrchestratorError-specific fields if present
      if ('category' in error && typeof (error as Record<string, unknown>).category === 'string') {
        errorDetails.category = (error as Record<string, unknown>).category as string;
      }
      if ('context' in error && typeof (error as Record<string, unknown>).context === 'object') {
        errorDetails.context = (error as Record<string, unknown>).context as Record<string, unknown>;
      }

      entry.error = errorDetails;
    }

    this.write(JSON.stringify(entry));
  }

  /** Resolve the current minimum log level name. */
  private currentMinLevel(): LogLevel {
    for (const [level, severity] of Object.entries(LOG_LEVEL_SEVERITY)) {
      if (severity === this.minSeverity) {
        return level as LogLevel;
      }
    }
    return 'debug';
  }
}
