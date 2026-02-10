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

const ALLOWED_KEYS = [
  "baseUrl",
  "apiKey",
  "containerTag",
  "autoRecall",
  "autoCapture",
  "maxRecallResults",
  "profileFrequency",
  "captureMode",
  "debug",
];

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
  }
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_m, envVar: string) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function sanitizeTag(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.round(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function defaultContainerTag(): string {
  return sanitizeTag(`openclaw_${hostname()}`);
}

function defaultBaseUrl(): string {
  return process.env.MOMO_OPENCLAW_BASE_URL ?? process.env.MOMO_BASE_URL ?? "http://localhost:3000";
}

export function parseConfig(raw: unknown): MomoOpenClawConfig {
  const cfg =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  if (Object.keys(cfg).length > 0) {
    assertAllowedKeys(cfg, ALLOWED_KEYS, "openclaw-momo config");
  }

  const baseUrl =
    typeof cfg.baseUrl === "string" && cfg.baseUrl.length > 0
      ? resolveEnvVars(cfg.baseUrl)
      : defaultBaseUrl();

  const apiKeyRaw =
    typeof cfg.apiKey === "string" && cfg.apiKey.length > 0
      ? resolveEnvVars(cfg.apiKey)
      : process.env.MOMO_OPENCLAW_API_KEY ?? process.env.MOMO_API_KEY;

  return {
    baseUrl,
    apiKey: apiKeyRaw && apiKeyRaw.length > 0 ? apiKeyRaw : undefined,
    containerTag:
      typeof cfg.containerTag === "string" && cfg.containerTag.length > 0
        ? sanitizeTag(resolveEnvVars(cfg.containerTag))
        : defaultContainerTag(),
    autoRecall: typeof cfg.autoRecall === "boolean" ? cfg.autoRecall : true,
    autoCapture: typeof cfg.autoCapture === "boolean" ? cfg.autoCapture : true,
    maxRecallResults: parseBoundedInt(cfg.maxRecallResults, 10, 1, 20),
    profileFrequency: parseBoundedInt(cfg.profileFrequency, 50, 1, 500),
    captureMode: cfg.captureMode === "everything" ? "everything" : "all",
    debug: typeof cfg.debug === "boolean" ? cfg.debug : false,
  };
}

export const momoConfigSchema = {
  parse: parseConfig,
};
