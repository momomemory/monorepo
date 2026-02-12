import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type {
  PluginType,
  MomoPluginConfig,
  MomoPluginConfigLoaderOptions,
  OpenClawPluginConfig,
  OpenCodePluginConfig,
  PiPluginConfig,
  ResolvedOpenClawPluginConfig,
  ResolvedOpenCodePluginConfig,
  ResolvedPiPluginConfig,
} from "./types.js";

function stripJsoncComments(content: string): string {
  enum Mode {
    Code,
    String,
    LineComment,
    BlockComment,
  }

  const out: string[] = [];
  let mode = Mode.Code;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    const next = content[i + 1];

    if (mode === Mode.String) {
      out.push(ch);

      if (ch === "\\") {
        if (next !== undefined) {
          out.push(next);
          i++;
        }
        continue;
      }

      if (ch === '"') {
        mode = Mode.Code;
      }

      continue;
    }

    if (mode === Mode.LineComment) {
      if (ch === "\n") {
        mode = Mode.Code;
        out.push("\n");
      }
      continue;
    }

    if (mode === Mode.BlockComment) {
      if (ch === "*" && next === "/") {
        mode = Mode.Code;
        i++;
        continue;
      }

      if (ch === "\n") {
        out.push("\n");
      }

      continue;
    }

    if (ch === '"') {
      mode = Mode.String;
      out.push(ch);
      continue;
    }

    if (ch === "/" && next === "/") {
      mode = Mode.LineComment;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      mode = Mode.BlockComment;
      i++;
      continue;
    }

    out.push(ch);
  }

  return out.join("").replace(/,\s*([}\]])/g, "$1");
}

function readJsoncFile(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    const stripped = stripJsoncComments(raw);
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasOwn<T extends Record<string, unknown>>(
  obj: T,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function sanitizeContainerTag(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function toBoolean(
  value: unknown,
  fallback: boolean,
  trueValues: string[] = ["true", "1", "yes"],
  falseValues: string[] = ["false", "0", "no"],
): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (trueValues.includes(lower)) return true;
    if (falseValues.includes(lower)) return false;
  }
  return fallback;
}

function toBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  let n: number;
  if (typeof value === "number" && Number.isFinite(value)) {
    n = Math.round(value);
  } else if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      n = Math.round(parsed);
    } else {
      return fallback;
    }
  } else {
    return fallback;
  }
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function pickString(
  key: string,
  envKey: string,
  config: Record<string, unknown>,
  fallback: string,
): string {
  const envValue = process.env[envKey];
  if (envValue !== undefined) return interpolateEnvVars(envValue);
  if (hasOwn(config, key) && typeof config[key] === "string") {
    return interpolateEnvVars(config[key] as string);
  }
  return fallback;
}

function pickOptionalString(
  key: string,
  envKey: string,
  config: Record<string, unknown>,
): string | undefined {
  const envValue = process.env[envKey];
  if (envValue !== undefined) return interpolateEnvVars(envValue);
  if (hasOwn(config, key) && typeof config[key] === "string") {
    return interpolateEnvVars(config[key] as string);
  }
  return undefined;
}

function pickBoolean(
  key: string,
  envKey: string,
  config: Record<string, unknown>,
  fallback: boolean,
): boolean {
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    return toBoolean(envValue, fallback);
  }
  return toBoolean(config[key], fallback);
}

function pickBoundedInt(
  key: string,
  envKey: string,
  config: Record<string, unknown>,
  fallback: number,
  min: number,
  max: number,
): number {
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    return toBoundedInt(envValue, fallback, min, max);
  }
  return toBoundedInt(config[key], fallback, min, max);
}

// ============================================================================
// OpenClaw Config
// ============================================================================

const OPENCLAW_DEFAULTS = {
  baseUrl: "http://localhost:3000",
  containerTag: `oclw_${hostname()}`,
  perAgentMemory: false,
  autoRecall: true,
  autoCapture: true,
  maxRecallResults: 10,
  profileFrequency: 50,
  captureMode: "all" as const,
  debug: false,
};

const OPENCLAW_ENV_PREFIX = "MOMO_OPENCLAW_";

function loadOpenClawConfig(config: MomoPluginConfig): ResolvedOpenClawPluginConfig {
  const pluginConfig = config.openclaw ?? {};
  const prefix = OPENCLAW_ENV_PREFIX;

  return {
    baseUrl: pickString("baseUrl", `${prefix}BASE_URL`, pluginConfig as unknown as Record<string, unknown>, OPENCLAW_DEFAULTS.baseUrl),
    apiKey: pickOptionalString("apiKey", `${prefix}API_KEY`, pluginConfig as unknown as Record<string, unknown>),
    containerTag: sanitizeContainerTag(
      pickString("containerTag", `${prefix}CONTAINER_TAG`, pluginConfig as unknown as Record<string, unknown>, OPENCLAW_DEFAULTS.containerTag),
    ),
    perAgentMemory: toBoolean(pluginConfig.perAgentMemory, OPENCLAW_DEFAULTS.perAgentMemory),
    autoRecall: toBoolean(pluginConfig.autoRecall, OPENCLAW_DEFAULTS.autoRecall),
    autoCapture: toBoolean(pluginConfig.autoCapture, OPENCLAW_DEFAULTS.autoCapture),
    maxRecallResults: toBoundedInt(pluginConfig.maxRecallResults, OPENCLAW_DEFAULTS.maxRecallResults, 1, 20),
    profileFrequency: toBoundedInt(pluginConfig.profileFrequency, OPENCLAW_DEFAULTS.profileFrequency, 1, 500),
    captureMode: pluginConfig.captureMode === "everything" ? "everything" : OPENCLAW_DEFAULTS.captureMode,
    debug: toBoolean(pluginConfig.debug, OPENCLAW_DEFAULTS.debug),
  };
}

// ============================================================================
// OpenCode Config
// ============================================================================

const OPENCODE_DEFAULTS = {
  baseUrl: "http://localhost:3000",
};

const OPENCODE_ENV_PREFIX = "MOMO_OPENCODE_";
const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");

function loadOpenCodeConfig(config: MomoPluginConfig): ResolvedOpenCodePluginConfig {
  const pluginConfig = config.opencode ?? {};
  const prefix = OPENCODE_ENV_PREFIX;

  return {
    baseUrl: pickString("baseUrl", `${prefix}BASE_URL`, pluginConfig as unknown as Record<string, unknown>, OPENCODE_DEFAULTS.baseUrl),
    apiKey: pickOptionalString("apiKey", `${prefix}API_KEY`, pluginConfig as unknown as Record<string, unknown>),
    containerTagUser: pickOptionalString("containerTagUser", `${prefix}CONTAINER_TAG_USER`, pluginConfig as unknown as Record<string, unknown>),
    containerTagProject: pickOptionalString("containerTagProject", `${prefix}CONTAINER_TAG_PROJECT`, pluginConfig as unknown as Record<string, unknown>),
  };
}

// ============================================================================
// Pi Config
// ============================================================================

const PI_DEFAULTS = {
  baseUrl: "http://localhost:3000",
  containerTag: `pi_${hostname()}`,
  autoRecall: true,
  autoCapture: true,
  maxRecallResults: 10,
  profileFrequency: 50,
  debug: false,
};

const PI_ENV_PREFIX = "MOMO_PI_";

function loadPiConfig(config: MomoPluginConfig): ResolvedPiPluginConfig {
  const pluginConfig = config.pi ?? {};
  const record = pluginConfig as unknown as Record<string, unknown>;
  const prefix = PI_ENV_PREFIX;

  return {
    baseUrl: pickString("baseUrl", `${prefix}BASE_URL`, record, PI_DEFAULTS.baseUrl),
    apiKey: pickOptionalString("apiKey", `${prefix}API_KEY`, record),
    containerTag: sanitizeContainerTag(
      pickString("containerTag", `${prefix}CONTAINER_TAG`, record, PI_DEFAULTS.containerTag),
    ),
    autoRecall: pickBoolean("autoRecall", `${prefix}AUTO_RECALL`, record, PI_DEFAULTS.autoRecall),
    autoCapture: pickBoolean("autoCapture", `${prefix}AUTO_CAPTURE`, record, PI_DEFAULTS.autoCapture),
    maxRecallResults: pickBoundedInt(
      "maxRecallResults",
      `${prefix}MAX_RECALL_RESULTS`,
      record,
      PI_DEFAULTS.maxRecallResults,
      1,
      20,
    ),
    profileFrequency: pickBoundedInt(
      "profileFrequency",
      `${prefix}PROFILE_FREQUENCY`,
      record,
      PI_DEFAULTS.profileFrequency,
      1,
      500,
    ),
    debug: pickBoolean("debug", `${prefix}DEBUG`, record, PI_DEFAULTS.debug),
  };
}

// ============================================================================
// Config Loader
// ============================================================================

export interface MomoPluginConfigLoaderMeta {
  cwd?: string;
  files: {
    project?: string;
    global?: string;
  };
}

function getConfigPaths(
  plugin: PluginType,
  cwd: string = process.cwd(),
  globalConfigDir?: string,
): { project?: string; global?: string } {
  switch (plugin) {
    case "opencode":
      return {
        project: join(cwd, ".momo.jsonc"),
        global: join(globalConfigDir ?? OPENCODE_CONFIG_DIR, "momo.jsonc"),
      };
    case "openclaw":
      return {
        project: join(cwd, ".momo.jsonc"),
        global: join(globalConfigDir ?? join(homedir(), ".openclaw"), "momo.jsonc"),
      };
    case "pi":
      return {
        project: join(cwd, ".momo.jsonc"),
        global: join(globalConfigDir ?? join(homedir(), ".pi"), "momo.jsonc"),
      };
  }
}

function mergeConfigs(...configs: (Record<string, unknown> | null | undefined)[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const config of configs) {
    if (!config) continue;
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result;
}

export interface MomoPluginConfigResult<T> {
  config: T;
  meta: MomoPluginConfigLoaderMeta;
}

export function loadPluginConfig<T>(
  plugin: PluginType,
  options?: MomoPluginConfigLoaderOptions,
): MomoPluginConfigResult<T> {
  const cwd = options?.cwd ?? process.cwd();
  const globalConfigDir = options?.globalConfigDir;
  const paths = getConfigPaths(plugin, cwd, globalConfigDir);

  const projectConfig = readJsoncFile(paths.project ?? "");
  const globalConfig = readJsoncFile(paths.global ?? "");

  const mergedConfig: MomoPluginConfig = {
    openclaw: mergeConfigs(
      globalConfig?.openclaw as Record<string, unknown> | undefined,
      projectConfig?.openclaw as Record<string, unknown> | undefined,
    ) as OpenClawPluginConfig | undefined,
    opencode: mergeConfigs(
      globalConfig?.opencode as Record<string, unknown> | undefined,
      projectConfig?.opencode as Record<string, unknown> | undefined,
    ) as OpenCodePluginConfig | undefined,
    pi: mergeConfigs(
      globalConfig?.pi as Record<string, unknown> | undefined,
      projectConfig?.pi as Record<string, unknown> | undefined,
    ) as PiPluginConfig | undefined,
  };

  let config: unknown;
  switch (plugin) {
    case "openclaw":
      config = loadOpenClawConfig(mergedConfig);
      break;
    case "opencode":
      config = loadOpenCodeConfig(mergedConfig);
      break;
    case "pi":
      config = loadPiConfig(mergedConfig);
      break;
  }

  return {
    config: config as T,
    meta: {
      cwd,
      files: {
        project: paths.project && existsSync(paths.project) ? paths.project : undefined,
        global: paths.global && existsSync(paths.global) ? paths.global : undefined,
      },
    },
  };
}

export function loadOpenClawPluginConfig(
  options?: MomoPluginConfigLoaderOptions,
): MomoPluginConfigResult<ResolvedOpenClawPluginConfig> {
  return loadPluginConfig<ResolvedOpenClawPluginConfig>("openclaw", options);
}

export function loadOpenCodePluginConfig(
  options?: MomoPluginConfigLoaderOptions,
): MomoPluginConfigResult<ResolvedOpenCodePluginConfig> {
  return loadPluginConfig<ResolvedOpenCodePluginConfig>("opencode", options);
}

export function loadPiPluginConfig(
  options?: MomoPluginConfigLoaderOptions,
): MomoPluginConfigResult<ResolvedPiPluginConfig> {
  return loadPluginConfig<ResolvedPiPluginConfig>("pi", options);
}

// ============================================================================
// Inline Config Parser (for when plugins receive config directly)
// ============================================================================

export function parseOpenClawInlineConfig(
  inlineConfig: Record<string, unknown> | undefined,
): ResolvedOpenClawPluginConfig {
  const pluginConfig: MomoPluginConfig = {
    openclaw: inlineConfig as OpenClawPluginConfig | undefined,
  };
  return loadOpenClawConfig(pluginConfig);
}

export function parseOpenCodeInlineConfig(
  inlineConfig: Record<string, unknown> | undefined,
): ResolvedOpenCodePluginConfig {
  const pluginConfig: MomoPluginConfig = {
    opencode: inlineConfig as OpenCodePluginConfig | undefined,
  };
  return loadOpenCodeConfig(pluginConfig);
}

export function parsePiInlineConfig(
  inlineConfig: Record<string, unknown> | undefined,
): ResolvedPiPluginConfig {
  const pluginConfig: MomoPluginConfig = {
    pi: inlineConfig as PiPluginConfig | undefined,
  };
  return loadPiConfig(pluginConfig);
}
