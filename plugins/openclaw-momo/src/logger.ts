export type LoggerBackend = {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug?(msg: string, ...args: unknown[]): void;
};

const NOOP_LOGGER: LoggerBackend = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

let backend: LoggerBackend = NOOP_LOGGER;
let debugEnabled = false;

export function initLogger(logger: LoggerBackend, debug: boolean): void {
  backend = logger;
  debugEnabled = debug;
}

export const log = {
  info(msg: string, ...args: unknown[]): void {
    backend.info(`momo: ${msg}`, ...args);
  },

  warn(msg: string, ...args: unknown[]): void {
    backend.warn(`momo: ${msg}`, ...args);
  },

  error(msg: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : err ? String(err) : "";
    backend.error(`momo: ${msg}${detail ? ` -- ${detail}` : ""}`);
  },

  debug(msg: string, ...args: unknown[]): void {
    if (!debugEnabled) return;
    const fn = backend.debug ?? backend.info;
    fn(`momo [debug]: ${msg}`, ...args);
  },

  debugRequest(method: string, params: Record<string, unknown>): void {
    if (!debugEnabled) return;
    const fn = backend.debug ?? backend.info;
    fn(`momo [debug] -> ${method}`, JSON.stringify(params, null, 2));
  },

  debugResponse(method: string, data: unknown): void {
    if (!debugEnabled) return;
    const fn = backend.debug ?? backend.info;
    fn(`momo [debug] <- ${method}`, JSON.stringify(data, null, 2));
  },
};
