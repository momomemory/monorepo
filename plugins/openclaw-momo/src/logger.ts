export type LoggerBackend = {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug?(msg: string, ...args: unknown[]): void;
};

const SILENT_LOGGER: LoggerBackend = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const LOGGER_SCOPE = "momo";

type LoggerState = {
  backend: LoggerBackend;
  verbose: boolean;
};

const state: LoggerState = {
  backend: SILENT_LOGGER,
  verbose: false,
};

function format(level: "info" | "warn" | "error" | "debug", message: string): string {
  if (level === "debug") return `${LOGGER_SCOPE} [debug] ${message}`;
  return `${LOGGER_SCOPE}: ${message}`;
}

function debugSink(): (msg: string, ...args: unknown[]) => void {
  return state.backend.debug ?? state.backend.info;
}

export function initLogger(backend: LoggerBackend, debugEnabled: boolean): void {
  state.backend = backend;
  state.verbose = debugEnabled;
}

export const log = {
  info(message: string, ...args: unknown[]): void {
    state.backend.info(format("info", message), ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    state.backend.warn(format("warn", message), ...args);
  },

  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : err ? String(err) : "";
    const suffix = detail ? ` (${detail})` : "";
    state.backend.error(format("error", `${message}${suffix}`));
  },

  debug(message: string, ...args: unknown[]): void {
    if (!state.verbose) return;
    debugSink()(format("debug", message), ...args);
  },

  debugRequest(operation: string, payload: Record<string, unknown>): void {
    if (!state.verbose) return;
    debugSink()(format("debug", `request ${operation}`), JSON.stringify(payload, null, 2));
  },

  debugResponse(operation: string, payload: unknown): void {
    if (!state.verbose) return;
    debugSink()(format("debug", `response ${operation}`), JSON.stringify(payload, null, 2));
  },
};
