import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, hostname } from "node:os";
import { stripJsoncComments } from "./jsonc";

export type MomoPiConfig = {
  baseUrl: string;
  apiKey?: string;
  containerTag: string;
  autoRecall: boolean;
  autoCapture: boolean;
  maxRecallResults: number;
  profileFrequency: number;
  debug: boolean;
};

export type ConfigSource =
  | "default"
  | "env:MOMO_PI"
  | "env:MOMO"
  | "project"
  | "global:~/.omp"
  | "global:~/.pi";

export type MomoPiConfigMeta = {
  cwd?: string;
  files: {
    project?: string;
    ompGlobal?: string;
    piGlobal?: string;
  };
  sources: Record<keyof MomoPiConfig, ConfigSource>;
};

type MomoConfigFile = Partial<{
  baseUrl: string;
  apiKey: string;
  containerTag: string;
  autoRecall: boolean;
  autoCapture: boolean;
  maxRecallResults: number;
  profileFrequency: number;
  debug: boolean;
}>;

type ConfigFileResult = {
  path?: string;
  config: MomoConfigFile;
};

const DEFAULTS: Omit<MomoPiConfig, "apiKey"> = {
  baseUrl: "http://localhost:3000",
  containerTag: `pi_${hostname()}`,
  autoRecall: true,
  autoCapture: true,
  maxRecallResults: 10,
  profileFrequency: 50,
  debug: false,
};

const KNOWN_KEYS = new Set<keyof MomoConfigFile>([
  "baseUrl",
  "apiKey",
  "containerTag",
  "autoRecall",
  "autoCapture",
  "maxRecallResults",
  "profileFrequency",
  "debug",
]);

function hasOwn(config: MomoConfigFile, key: keyof MomoConfigFile): boolean {
  return Object.prototype.hasOwnProperty.call(config, key);
}

function readJsoncFile(path: string): MomoConfigFile {
  try {
    const raw = readFileSync(path, "utf-8");
    const stripped = stripJsoncComments(raw);
    const parsed = JSON.parse(stripped) as MomoConfigFile;

    for (const key of Object.keys(parsed)) {
      if (!KNOWN_KEYS.has(key as keyof MomoConfigFile)) {
        throw new Error(`Unknown config key in ${path}: ${key}`);
      }
    }

    return parsed;
  } catch {
    return {};
  }
}

function readGlobalConfig(name: ".pi" | ".omp"): ConfigFileResult {
  const path = join(homedir(), name, "momo.jsonc");
  if (!existsSync(path)) {
    return { path: undefined, config: {} };
  }
  return {
    path,
    config: readJsoncFile(path),
  };
}

function readProjectConfig(cwd?: string): ConfigFileResult {
  if (!cwd) return { path: undefined, config: {} };

  const dotPath = join(cwd, ".momo.jsonc");
  if (existsSync(dotPath)) {
    return { path: dotPath, config: readJsoncFile(dotPath) };
  }

  const plainPath = join(cwd, "momo.jsonc");
  if (existsSync(plainPath)) {
    return { path: plainPath, config: readJsoncFile(plainPath) };
  }

  return { path: undefined, config: {} };
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
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  return fallback;
}

function toBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      const n = Math.round(parsed);
      if (n < min) return min;
      if (n > max) return max;
      return n;
    }
  }
  return fallback;
}

function pickRawValue(
  key: keyof MomoConfigFile,
  piEnvKey: string,
  momoEnvKey: string,
  projectConfig: MomoConfigFile,
  ompConfig: MomoConfigFile,
  piConfig: MomoConfigFile,
  defaultValue: unknown,
): { value: unknown; source: ConfigSource } {
  const piEnvValue = process.env[piEnvKey];
  if (piEnvValue !== undefined) {
    return { value: piEnvValue, source: "env:MOMO_PI" };
  }

  const momoEnvValue = process.env[momoEnvKey];
  if (momoEnvValue !== undefined) {
    return { value: momoEnvValue, source: "env:MOMO" };
  }

  if (hasOwn(projectConfig, key)) {
    return { value: projectConfig[key], source: "project" };
  }

  if (hasOwn(ompConfig, key)) {
    return { value: ompConfig[key], source: "global:~/.omp" };
  }

  if (hasOwn(piConfig, key)) {
    return { value: piConfig[key], source: "global:~/.pi" };
  }

  return { value: defaultValue, source: "default" };
}

/**
 * Load config with precedence:
 * 1. Environment variables (highest)
 * 2. Project config (.momo.jsonc or momo.jsonc)
 * 3. Global ~/.omp/momo.jsonc (oh-my-pi)
 * 4. Global ~/.pi/momo.jsonc
 * 5. Defaults (lowest)
 */
export function loadConfigWithMeta(cwd?: string): { config: MomoPiConfig; meta: MomoPiConfigMeta } {
  const project = readProjectConfig(cwd);
  const ompGlobal = readGlobalConfig(".omp");
  const piGlobal = readGlobalConfig(".pi");

  const baseUrlRaw = pickRawValue(
    "baseUrl",
    "MOMO_PI_BASE_URL",
    "MOMO_BASE_URL",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    DEFAULTS.baseUrl,
  );

  const apiKeyRaw = pickRawValue(
    "apiKey",
    "MOMO_PI_API_KEY",
    "MOMO_API_KEY",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    undefined,
  );

  const containerTagRaw = pickRawValue(
    "containerTag",
    "MOMO_PI_CONTAINER_TAG",
    "MOMO_CONTAINER_TAG",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    DEFAULTS.containerTag,
  );

  const autoRecallRaw = pickRawValue(
    "autoRecall",
    "MOMO_PI_AUTO_RECALL",
    "MOMO_AUTO_RECALL",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    DEFAULTS.autoRecall,
  );

  const autoCaptureRaw = pickRawValue(
    "autoCapture",
    "MOMO_PI_AUTO_CAPTURE",
    "MOMO_AUTO_CAPTURE",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    DEFAULTS.autoCapture,
  );

  const maxRecallRaw = pickRawValue(
    "maxRecallResults",
    "MOMO_PI_MAX_RECALL_RESULTS",
    "MOMO_MAX_RECALL_RESULTS",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    DEFAULTS.maxRecallResults,
  );

  const profileFrequencyRaw = pickRawValue(
    "profileFrequency",
    "MOMO_PI_PROFILE_FREQUENCY",
    "MOMO_PROFILE_FREQUENCY",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    DEFAULTS.profileFrequency,
  );

  const debugRaw = pickRawValue(
    "debug",
    "MOMO_PI_DEBUG",
    "MOMO_DEBUG",
    project.config,
    ompGlobal.config,
    piGlobal.config,
    DEFAULTS.debug,
  );

  const baseUrlInput = typeof baseUrlRaw.value === "string" ? baseUrlRaw.value : DEFAULTS.baseUrl;
  const containerTagInput = typeof containerTagRaw.value === "string"
    ? containerTagRaw.value
    : DEFAULTS.containerTag;

  const apiKeyInput = typeof apiKeyRaw.value === "string" ? apiKeyRaw.value : undefined;
  const apiKeyInterpolated = apiKeyInput ? interpolateEnvVars(apiKeyInput) : undefined;

  const config: MomoPiConfig = {
    baseUrl: interpolateEnvVars(baseUrlInput),
    apiKey: apiKeyInterpolated && apiKeyInterpolated.length > 0 ? apiKeyInterpolated : undefined,
    containerTag: sanitizeContainerTag(interpolateEnvVars(containerTagInput)),
    autoRecall: toBoolean(autoRecallRaw.value, DEFAULTS.autoRecall),
    autoCapture: toBoolean(autoCaptureRaw.value, DEFAULTS.autoCapture),
    maxRecallResults: toBoundedInt(maxRecallRaw.value, DEFAULTS.maxRecallResults, 1, 20),
    profileFrequency: toBoundedInt(profileFrequencyRaw.value, DEFAULTS.profileFrequency, 1, 500),
    debug: toBoolean(debugRaw.value, DEFAULTS.debug),
  };

  const meta: MomoPiConfigMeta = {
    cwd,
    files: {
      project: project.path,
      ompGlobal: ompGlobal.path,
      piGlobal: piGlobal.path,
    },
    sources: {
      baseUrl: baseUrlRaw.source,
      apiKey: apiKeyRaw.source,
      containerTag: containerTagRaw.source,
      autoRecall: autoRecallRaw.source,
      autoCapture: autoCaptureRaw.source,
      maxRecallResults: maxRecallRaw.source,
      profileFrequency: profileFrequencyRaw.source,
      debug: debugRaw.source,
    },
  };

  return { config, meta };
}

export function loadConfig(cwd?: string): MomoPiConfig {
  return loadConfigWithMeta(cwd).config;
}

// Legacy export for backwards compatibility
export const parseConfig = loadConfig;
