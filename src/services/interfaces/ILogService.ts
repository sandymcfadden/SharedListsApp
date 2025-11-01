export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface ILogService {
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;

  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;

  // Convenience methods for common patterns
  debugSync(message: string, ...args: any[]): void;
  infoSync(message: string, ...args: any[]): void;
  warnSync(message: string, ...args: any[]): void;
  errorSync(message: string, ...args: any[]): void;

  // User identification methods (no-op for non-analytics implementations)
  identifyUser(userId: string, properties?: Record<string, any>): void;
  resetUser(): void;
}
