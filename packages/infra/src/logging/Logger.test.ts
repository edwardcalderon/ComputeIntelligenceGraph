/**
 * Unit tests for Logger class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel } from './Logger';
import { LoggingConfig } from '../types';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('log level filtering', () => {
    it('should filter debug messages when level is info', () => {
      const config: LoggingConfig = { level: 'info', timestamps: false };
      const logger = new Logger(config);

      logger.debug('debug message');
      logger.info('info message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] info message');
    });

    it('should filter debug and info messages when level is warn', () => {
      const config: LoggingConfig = { level: 'warn', timestamps: false };
      const logger = new Logger(config);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] warn message');
    });

    it('should only log error messages when level is error', () => {
      const config: LoggingConfig = { level: 'error', timestamps: false };
      const logger = new Logger(config);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message');
    });

    it('should log all messages when level is debug', () => {
      const config: LoggingConfig = { level: 'debug', timestamps: false };
      const logger = new Logger(config);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // debug and info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('timestamp formatting', () => {
    it('should include ISO 8601 timestamp when timestamps are enabled', () => {
      const config: LoggingConfig = { level: 'info', timestamps: true };
      const logger = new Logger(config);

      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      
      // Check for ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
      expect(logOutput).toMatch(iso8601Regex);
      expect(logOutput).toContain('[INFO] test message');
    });

    it('should not include timestamp when timestamps are disabled', () => {
      const config: LoggingConfig = { level: 'info', timestamps: false };
      const logger = new Logger(config);

      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      
      // Should start with log level, not timestamp
      expect(logOutput).toBe('[INFO] test message');
    });
  });

  describe('structured logging with context', () => {
    it('should include context in log message', () => {
      const config: LoggingConfig = { level: 'info', timestamps: false };
      const logger = new Logger(config);

      logger.info('deployment started', { environment: 'production', region: 'us-east-2' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      
      expect(logOutput).toContain('[INFO] deployment started');
      expect(logOutput).toContain('"environment":"production"');
      expect(logOutput).toContain('"region":"us-east-2"');
    });

    it('should redact secret-bearing fields in structured context', () => {
      const config: LoggingConfig = { level: 'info', timestamps: false };
      const logger = new Logger(config);

      logger.info('deployment started', {
        tokenEndpoint: 'https://auth.example.com/application/o/token/',
        oidcClientId: 'client-id-123',
        oidcClientSecret: 'client-secret-456',
        connectionString: 'postgresql://dbuser:dbpassword@db.example.com/app',
        publicUrl: 'https://auth.cig.technology',
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];

      expect(logOutput).toContain('"tokenEndpoint":"[REDACTED]"');
      expect(logOutput).toContain('"oidcClientId":"[REDACTED]"');
      expect(logOutput).toContain('"oidcClientSecret":"[REDACTED]"');
      expect(logOutput).toContain(
        '"connectionString":"postgresql://dbuser:[REDACTED]@db.example.com/app"'
      );
      expect(logOutput).toContain('"publicUrl":"https://auth.cig.technology"');
    });

    it('should merge constructor context with log context', () => {
      const config: LoggingConfig = { level: 'info', timestamps: false };
      const logger = new Logger(config, { operation: 'deploy' });

      logger.info('step completed', { step: 'validation' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      
      expect(logOutput).toContain('"operation":"deploy"');
      expect(logOutput).toContain('"step":"validation"');
    });

    it('should log without context when none provided', () => {
      const config: LoggingConfig = { level: 'info', timestamps: false };
      const logger = new Logger(config);

      logger.info('simple message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] simple message');
    });
  });

  describe('child logger', () => {
    it('should create child logger with merged context', () => {
      const config: LoggingConfig = { level: 'info', timestamps: false };
      const parentLogger = new Logger(config, { operation: 'deploy' });
      const childLogger = parentLogger.child({ environment: 'production' });

      childLogger.info('child message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      
      expect(logOutput).toContain('"operation":"deploy"');
      expect(logOutput).toContain('"environment":"production"');
    });

    it('should inherit log level from parent', () => {
      const config: LoggingConfig = { level: 'warn', timestamps: false };
      const parentLogger = new Logger(config);
      const childLogger = parentLogger.child({ component: 'auth' });

      childLogger.debug('debug message');
      childLogger.info('info message');
      childLogger.warn('warn message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('log methods', () => {
    it('should use console.log for debug and info', () => {
      const config: LoggingConfig = { level: 'debug', timestamps: false };
      const logger = new Logger(config);

      logger.debug('debug message');
      logger.info('info message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.warn for warn', () => {
      const config: LoggingConfig = { level: 'warn', timestamps: false };
      const logger = new Logger(config);

      logger.warn('warn message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.error for error', () => {
      const config: LoggingConfig = { level: 'error', timestamps: false };
      const logger = new Logger(config);

      logger.error('error message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
