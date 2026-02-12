import { parsePiInlineConfig, loadPiPluginConfig, type ResolvedPiPluginConfig } from "@momomemory/sdk";

export type { ResolvedPiPluginConfig };

export type MomoPiConfig = ResolvedPiPluginConfig;

export type MomoPiConfigMeta = {
  cwd?: string;
  files: {
    project?: string;
    global?: string;
  };
} | undefined;

function ensureObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

export function parseConfig(raw: unknown): MomoPiConfig {
  const config = ensureObject(raw);
  return parsePiInlineConfig(config);
}

export function parseConfigWithMeta(raw: unknown): { config: MomoPiConfig; meta: MomoPiConfigMeta } {
  return { config: parseConfig(raw), meta: undefined };
}

export function loadConfig(cwd?: string): MomoPiConfig {
  return loadPiPluginConfig({ cwd }).config;
}

export function loadConfigWithMeta(cwd?: string): { config: MomoPiConfig; meta: MomoPiConfigMeta } {
  return { config: loadPiPluginConfig({ cwd }).config, meta: undefined };
}
