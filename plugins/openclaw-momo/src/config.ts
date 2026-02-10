import { hostname } from "node:os";

export type CaptureMode = "everything" | "all";

export type MomoOpenClawConfig = {
  baseUrl: string;
  apiKey?: string;
  containerTag: string;
  autoRecall: boolean;
  autoCapture: boolean;
  maxRecallResults: number;
  profileFrequency: number;
  captureMode: CaptureMode;
  debug: boolean;
};

const DEFAULTS = {
  baseUrl: "http://localhost:3000",
  autoRecall: true,
  autoCapture: true,
  maxRecallResults: 10,
  profileFrequency: 50,
  captureMode: "all" as CaptureMode,
  debug: false,
};

const KNOWN_KEYS = new Set([
  "baseUrl",
  "apiKey",
  "containerTag",
  "autoRecall",
  "autoCapture",
  "maxRecallResults",
  "profileFrequency",
  "captureMode",
  "debug",
]);

function mustBeObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function throwOnUnknownKeys(data: Record<string, unknown>): void {
  const unexpected = Object.keys(data).filter((key) => !KNOWN_KEYS.has(key));
  if (unexpected.length > 0) {
    throw new Error(`openclaw-momo config has unknown keys: ${unexpected.join(", ")}`);
  }
}

function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_chunk, key: string) => {
    const envValue = process.env[key];
    if (!envValue) {
      throw new Error(`Environment variable ${key} is not set`);
    }
    return envValue;
  });
}

function sanitizeContainerTag(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const n = Math.round(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function pickBaseUrl(config: Record<string, unknown>): string {
  const fromConfig = typeof config.baseUrl === "string" ? config.baseUrl : undefined;
  const fromEnv = process.env.MOMO_OPENCLAW_BASE_URL ?? process.env.MOMO_BASE_URL;
  const value = fromConfig ?? fromEnv ?? DEFAULTS.baseUrl;
  return interpolateEnvVars(value);
}

function pickApiKey(config: Record<string, unknown>): string | undefined {
  const fromConfig = typeof config.apiKey === "string" ? config.apiKey : undefined;
  const fromEnv = process.env.MOMO_OPENCLAW_API_KEY ?? process.env.MOMO_API_KEY;
  const value = fromConfig ?? fromEnv;
  if (!value || value.length === 0) return undefined;
  return interpolateEnvVars(value);
}

function pickContainerTag(config: Record<string, unknown>): string {
  const raw = typeof config.containerTag === "string"
    ? interpolateEnvVars(config.containerTag)
    : `openclaw_${hostname()}`;
  return sanitizeContainerTag(raw);
}

export function parseConfig(raw: unknown): MomoOpenClawConfig {
  const config = mustBeObject(raw);
  throwOnUnknownKeys(config);

  return {
    baseUrl: pickBaseUrl(config),
    apiKey: pickApiKey(config),
    containerTag: pickContainerTag(config),
    autoRecall: toBoolean(config.autoRecall, DEFAULTS.autoRecall),
    autoCapture: toBoolean(config.autoCapture, DEFAULTS.autoCapture),
    maxRecallResults: toBoundedInt(config.maxRecallResults, DEFAULTS.maxRecallResults, 1, 20),
    profileFrequency: toBoundedInt(config.profileFrequency, DEFAULTS.profileFrequency, 1, 500),
    captureMode: config.captureMode === "everything" ? "everything" : DEFAULTS.captureMode,
    debug: toBoolean(config.debug, DEFAULTS.debug),
  };
}

export const momoConfigSchema = {
  parse: parseConfig,
};
