import { ILogService, LogLevel } from '@/services/interfaces/ILogService';

export class ConsoleLogService implements ILogService {
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
      return `[${fileName}:${line}]`;
    }

    // Fallback for different stack trace formats
    const fallbackMatch = callerLine.match(/at\s+(.+?):(\d+):(\d+)/);
    if (fallbackMatch) {
      const [, filePath, line, _column] = fallbackMatch;
      const fileName = filePath.split('/').pop()?.split('?')[0] || filePath;
      return `[${fileName}:${line}]`;
    }

    return '';
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const callerInfo = this.getCallerInfo();
      console.log(`🔍 ${message} ${callerInfo}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const callerInfo = this.getCallerInfo();
      console.log(`ℹ️ ${message} ${callerInfo}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      const callerInfo = this.getCallerInfo();
      console.warn(`⚠️ ${message} ${callerInfo}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const callerInfo = this.getCallerInfo();
      console.error(`❌ ${callerInfo} ${message}`, ...args);
    }
  }

  // Convenience methods for sync-related logging
  debugSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const callerInfo = this.getCallerInfo();
      console.log(`🔄 ${message} ${callerInfo}`, ...args);
    }
  }

  infoSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const callerInfo = this.getCallerInfo();
      console.log(`✅ ${message} ${callerInfo}`, ...args);
    }
  }

  warnSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      const callerInfo = this.getCallerInfo();
      console.warn(`⚠️ ${message} ${callerInfo}`, ...args);
    }
  }

  errorSync(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const callerInfo = this.getCallerInfo();
      console.error(`❌ ${message} ${callerInfo}`, ...args);
    }
  }

  /**
   * No-op for console logging - user identification not needed
   */
  identifyUser(_userId: string, _properties?: Record<string, any>): void {
    // No-op for console logging
  }

  /**
   * No-op for console logging - user reset not needed
   */
  resetUser(): void {
    // No-op for console logging
  }
}
