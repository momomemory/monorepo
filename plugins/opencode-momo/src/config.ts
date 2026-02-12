import { loadOpenCodePluginConfig, type ResolvedOpenCodePluginConfig } from "@momomemory/sdk";

export type { ResolvedOpenCodePluginConfig };

export type MomoConfig = ResolvedOpenCodePluginConfig & { baseUrl: string };

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    return `${xdg}/opencode`;
  }
  return `${process.env.HOME}/.config/opencode`;
}

export function loadConfig(directory?: string): MomoConfig {
  const { config } = loadOpenCodePluginConfig({
    cwd: directory ?? process.cwd(),
    globalConfigDir: getConfigDir(),
  });
  return config;
}

export function isConfigured(directory?: string): boolean {
  const config = loadConfig(directory);
  return config.apiKey != null && config.apiKey.length > 0;
}
