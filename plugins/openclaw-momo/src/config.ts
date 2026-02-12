import { parseOpenClawInlineConfig, type ResolvedOpenClawPluginConfig } from "@momomemory/sdk";

export type { ResolvedOpenClawPluginConfig };

export type MomoOpenClawConfig = ResolvedOpenClawPluginConfig;

function ensureObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

export function parseConfig(raw: unknown): MomoOpenClawConfig {
  const config = ensureObject(raw);
  return parseOpenClawInlineConfig(config);
}

export const momoConfigSchema = {
  parse: parseConfig,
};
