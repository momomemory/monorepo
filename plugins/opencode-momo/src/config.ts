import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stripJsoncComments } from "./services/jsonc";

export interface MomoConfig {
  apiKey?: string;
  baseUrl: string;
  containerTagUser?: string;
  containerTagProject?: string;
}

interface MomoConfigFile {
  apiKey?: string;
  baseUrl?: string;
  containerTagUser?: string;
  containerTagProject?: string;
}

const DEFAULT_BASE_URL = "http://localhost:3000";

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    return join(xdg, "opencode");
  }
  return join(homedir(), ".config", "opencode");
}

function readConfigFile(): MomoConfigFile {
  const configPath = join(getConfigDir(), "momo.jsonc");
  try {
    const raw = readFileSync(configPath, "utf-8");
    const stripped = stripJsoncComments(raw);
    return JSON.parse(stripped) as MomoConfigFile;
  } catch {
    return {};
  }
}

export function loadConfig(): MomoConfig {
  const fileConfig = readConfigFile();

  const envApiKey = process.env.MOMO_API_KEY;
  const envBaseUrl = process.env.MOMO_BASE_URL;

  return {
    apiKey: envApiKey ?? fileConfig.apiKey,
    baseUrl: envBaseUrl ?? fileConfig.baseUrl ?? DEFAULT_BASE_URL,
    containerTagUser: fileConfig.containerTagUser,
    containerTagProject: fileConfig.containerTagProject,
  };
}

export function isConfigured(): boolean {
  const config = loadConfig();
  return config.apiKey != null && config.apiKey.length > 0;
}
