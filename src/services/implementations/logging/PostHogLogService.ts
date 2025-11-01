import { ILogService, LogLevel } from '@/services/interfaces/ILogService';
import posthog from 'posthog-js';

export class PostHogLogService implements ILogService {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private getCallerInfo(): string {
    const stack = new Error().stack;
    if (!stack) return '';

    const lines = stack.split('\n');
    // Skip the first line (Error message) and the second line (this function)
    // The third line should be the actual caller
    const callerLine = lines[3];
    if (!callerLine) return '';

    // Extract file and line info from stack trace
    const match = callerLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      const [, _functionName, filePath, line, _column] = match;
      const fileName = filePath.split('/').pop()?.split('?')[0] || filePath;
      return `${fileName}:${line}`;
    }

    // Fallback for different stack trace formats
    const fallbackMatch = callerLine.match(/at\s+(.+?):(\d+):(\d+)/);
    if (fallbackMatch) {
      const [, filePath, line, _column] = fallbackMatch;
      const fileName = filePath.split('/').pop()?.split('?')[0] || filePath;
      return `${fileName}:${line}`;
    }

    return '';
  }

  private captureEvent(
    level: string,
    message: string,
    args: any[],
    properties?: Record<string, any>
  ): void {
    const callerInfo = this.getCallerInfo();

    // Construct properties object
    const eventProperties: Record<string, any> = {
      level,
      message,
      caller: callerInfo,
      timestamp: new Date().toISOString(),
      ...properties,
    };

    // Add additional context from args
    if (args.length > 0) {
      eventProperties.args = args.map(arg => {
        // Handle Error objects
        if (arg instanceof Error) {
          return {
            name: arg.name,
            message: arg.message,
            stack: arg.stack,
          };
        }
        // Handle other objects
        try {
          return JSON.parse(JSON.stringify(arg));
        } catch {
          return String(arg);
        }
      });
    }

    // Capture to PostHog
    posthog.capture(`log_${level}`, eventProperties);
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.captureEvent('debug', message, args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      this.captureEvent('info', message, args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      this.captureEvent('warn', message, args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.captureEvent('error', message, args);
    }
  }

  // Convenience methods for sync-related logging
  debugSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.captureEvent('debug', message, args, { category: 'sync' });
    }
  }

  infoSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      this.captureEvent('info', message, args, { category: 'sync' });
    }
  }

  warnSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      this.captureEvent('warn', message, args, { category: 'sync' });
    }
  }

  errorSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.captureEvent('error', message, args, { category: 'sync' });
    }
  }

  /**
   * Identify a user in PostHog
   * This associates all future events with this user
   */
  identifyUser(userId: string, properties?: Record<string, any>): void {
    posthog.identify(userId, properties);
  }

  /**
   * Reset PostHog user identification
   * Call this on sign out to ensure the next user session is tracked separately
   */
  resetUser(): void {
    posthog.reset();
  }
}
