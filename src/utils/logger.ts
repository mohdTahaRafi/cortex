/**
 * Cortex — Centralized Logger
 *
 * Provides a structured logging interface with severity levels.
 * All extension modules should use this instead of raw console calls.
 * The LOG_PREFIX makes Cortex logs easily filterable in DevTools.
 */

const LOG_PREFIX = "[Cortex]";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Current minimum log level. Messages below this level are suppressed. */
let minLevel: LogLevel = "info";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

export const logger = {
  /** Set the minimum log level (default: "info"). */
  setLevel(level: LogLevel): void {
    minLevel = level;
  },

  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(LOG_PREFIX, message, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(LOG_PREFIX, message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(LOG_PREFIX, message, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(LOG_PREFIX, message, ...args);
    }
  },
};
