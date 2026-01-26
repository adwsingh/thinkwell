/**
 * Logging module for the conductor
 *
 * Provides structured logging with configurable levels and optional JSONL tracing.
 * All conductor logging goes through this module to enable consistent output
 * formatting and filtering.
 *
 * ## Log Levels
 *
 * - `error`: Errors that affect operation (component crashes, protocol violations)
 * - `warn`: Warnings about potential issues (missing responses, malformed messages)
 * - `info`: Key operational events (component start/stop, connections)
 * - `debug`: Detailed debugging information (message routing, state changes)
 * - `trace`: Very detailed tracing (every message, internal state)
 *
 * ## Usage
 *
 * ```typescript
 * const logger = createLogger({ level: 'debug', name: 'my-conductor' });
 * logger.info('Component started', { component: 'agent', pid: 1234 });
 * logger.error('Failed to connect', { error: err.message });
 * ```
 *
 * ## JSONL Tracing
 *
 * When enabled, all messages routed through the conductor are written to a
 * JSONL file for debugging and analysis:
 *
 * ```typescript
 * const logger = createLogger({
 *   level: 'info',
 *   trace: { path: '/tmp/conductor.jsonl' }
 * });
 * ```
 */

import { createWriteStream, type WriteStream } from "node:fs";
import type { ConductorMessage } from "./types.js";
import type { JsonRpcMessage } from "@thinkwell/protocol";

/**
 * Log level enumeration (lower = more severe)
 */
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

/**
 * Log entry structure for structured logging
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  name?: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Trace entry for JSONL message tracing
 */
export interface TraceEntry {
  timestamp: string;
  direction: "left-to-right" | "right-to-left" | "internal";
  source?: string;
  target?: string;
  message: ConductorMessage | JsonRpcMessage;
}

/**
 * Options for JSONL tracing output
 */
export interface TraceOptions {
  /** Path to the JSONL trace file */
  path: string;
}

/**
 * Logger configuration
 */
export interface LoggerOptions {
  /** Minimum log level to output (default: 'info') */
  level?: LogLevel;
  /** Optional name prefix for log messages */
  name?: string;
  /** Optional JSONL trace output */
  trace?: TraceOptions;
  /** Use JSON output format instead of human-readable (default: false) */
  json?: boolean;
}

/**
 * Logger interface
 */
export interface Logger {
  /** Log an error message */
  error(message: string, data?: Record<string, unknown>): void;
  /** Log a warning message */
  warn(message: string, data?: Record<string, unknown>): void;
  /** Log an info message */
  info(message: string, data?: Record<string, unknown>): void;
  /** Log a debug message */
  debug(message: string, data?: Record<string, unknown>): void;
  /** Log a trace message */
  trace(message: string, data?: Record<string, unknown>): void;

  /** Write a trace entry for message inspection */
  traceMessage(entry: Omit<TraceEntry, "timestamp">): void;

  /** Check if a log level is enabled */
  isEnabled(level: LogLevel): boolean;

  /** Create a child logger with additional context */
  child(name: string): Logger;

  /** Close any open resources (trace file, etc.) */
  close(): Promise<void>;
}

/**
 * Create a no-op logger that discards all output
 */
export function createNoopLogger(): Logger {
  const noop = () => {};
  return {
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    trace: noop,
    traceMessage: noop,
    isEnabled: () => false,
    child: () => createNoopLogger(),
    close: async () => {},
  };
}

/**
 * Create a logger with the specified options
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const levelNum = LOG_LEVELS[level];
  const name = options.name;
  const useJson = options.json ?? false;

  // Set up trace file if configured
  let traceStream: WriteStream | null = null;
  if (options.trace) {
    traceStream = createWriteStream(options.trace.path, { flags: "a" });
  }

  function isEnabled(checkLevel: LogLevel): boolean {
    return LOG_LEVELS[checkLevel] <= levelNum;
  }

  function log(logLevel: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!isEnabled(logLevel)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      name,
      message,
      data,
    };

    if (useJson) {
      // Output as JSON for machine parsing
      const output = logLevel === "error" || logLevel === "warn" ? console.error : console.log;
      output(JSON.stringify(entry));
    } else {
      // Human-readable format
      const prefix = name ? `[${name}]` : "";
      const levelStr = logLevel.toUpperCase().padEnd(5);
      const dataStr = data ? ` ${JSON.stringify(data)}` : "";
      const output = logLevel === "error" || logLevel === "warn" ? console.error : console.log;
      output(`${entry.timestamp} ${levelStr} ${prefix}${prefix ? " " : ""}${message}${dataStr}`);
    }
  }

  function traceMessage(entry: Omit<TraceEntry, "timestamp">): void {
    if (!traceStream) {
      return;
    }

    const fullEntry: TraceEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    traceStream.write(JSON.stringify(fullEntry) + "\n");
  }

  function child(childName: string): Logger {
    const fullName = name ? `${name}:${childName}` : childName;
    return createLogger({
      ...options,
      name: fullName,
      // Share trace stream with parent
      trace: undefined, // Don't create new stream
    });
  }

  async function close(): Promise<void> {
    if (traceStream) {
      await new Promise<void>((resolve, reject) => {
        traceStream!.end((err: Error | null | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
      traceStream = null;
    }
  }

  return {
    error: (message, data) => log("error", message, data),
    warn: (message, data) => log("warn", message, data),
    info: (message, data) => log("info", message, data),
    debug: (message, data) => log("debug", message, data),
    trace: (message, data) => log("trace", message, data),
    traceMessage,
    isEnabled,
    child,
    close,
  };
}

/**
 * Default logger instance (silent by default, can be replaced)
 */
let defaultLogger: Logger = createNoopLogger();

/**
 * Get the default logger
 */
export function getLogger(): Logger {
  return defaultLogger;
}

/**
 * Set the default logger
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}
