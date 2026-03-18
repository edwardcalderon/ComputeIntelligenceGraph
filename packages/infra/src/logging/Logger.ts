/**
 * Logging infrastructure for deployment operations
 * @packageDocumentation
 */

import { LoggingConfig } from '../types';

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger class for infrastructure deployment operations
 * 
 * @remarks
 * Provides structured logging with level filtering, timestamp formatting,
 * and operation context. Supports debug, info, warn, and error log levels.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ level: 'info', timestamps: true });
 * logger.info('Deployment started', { environment: 'production' });
 * logger.error('Deployment failed', { error: 'Connection timeout' });
 * ```
 */
export class Logger {
  private level: LogLevel;
  private timestamps: boolean;
  private context: Record<string, any>;

  /**
   * Create a new Logger instance
   * @param config - Logging configuration
   * @param context - Optional operation context to include in all log messages
   */
  constructor(config: LoggingConfig, context?: Record<string, any>) {
    this.level = this.parseLogLevel(config.level);
    this.timestamps = config.timestamps;
    this.context = context || {};
  }

  /**
   * Log a debug message
   * @param message - Log message
   * @param context - Additional context information
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   * @param message - Log message
   * @param context - Additional context information
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   * @param message - Log message
   * @param context - Additional context information
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   * @param message - Log message
   * @param context - Additional context information
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Create a child logger with additional context
   * @param context - Additional context to merge with parent context
   * @returns New Logger instance with merged context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(
      { level: this.getLevelName(this.level), timestamps: this.timestamps },
      { ...this.context, ...context }
    );
    return childLogger;
  }

  /**
   * Internal log method that handles filtering and formatting
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context information
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Filter messages below configured level
    if (level < this.level) {
      return;
    }

    // Build log message
    const parts: string[] = [];

    // Add timestamp if enabled
    if (this.timestamps) {
      parts.push(this.formatTimestamp());
    }

    // Add log level
    parts.push(`[${this.getLevelName(level).toUpperCase()}]`);

    // Add message
    parts.push(message);

    // Merge contexts
    const mergedContext = { ...this.context, ...context };

    // Add context if present
    if (Object.keys(mergedContext).length > 0) {
      parts.push(JSON.stringify(mergedContext));
    }

    // Output to appropriate stream
    const output = parts.join(' ');
    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else if (level >= LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Format current timestamp in ISO 8601 format
   * @returns ISO 8601 formatted timestamp
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Parse log level string to LogLevel enum
   * @param level - Log level string
   * @returns LogLevel enum value
   */
  private parseLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogLevel {
    switch (level) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Get log level name from LogLevel enum
   * @param level - LogLevel enum value
   * @returns Log level string
   */
  private getLevelName(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.ERROR:
        return 'error';
      default:
        return 'info';
    }
  }
}
