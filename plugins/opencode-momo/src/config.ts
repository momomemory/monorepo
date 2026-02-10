import { readFileSync, existsSync } from "node:fs";
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
  return readJsoncConfigFile(configPath);
}

function readJsoncConfigFile(configPath: string): MomoConfigFile {
  try {
    const raw = readFileSync(configPath, "utf-8");
    const stripped = stripJsoncComments(raw);
    return JSON.parse(stripped) as MomoConfigFile;
  } catch {
    return {};
  }
}

function readProjectConfigFile(directory?: string): MomoConfigFile {
  if (!directory) return {};

  const dotPath = join(directory, ".momo.jsonc");
  if (existsSync(dotPath)) {
    return readJsoncConfigFile(dotPath);
  }

  const plainPath = join(directory, "momo.jsonc");
  if (existsSync(plainPath)) {
    return readJsoncConfigFile(plainPath);
  }

  return {};
}

export function loadConfig(directory?: string): MomoConfig {
  const globalConfig = readConfigFile();
  const projectConfig = readProjectConfigFile(directory);

  const envApiKey = process.env.MOMO_API_KEY;
  const envBaseUrl = process.env.MOMO_BASE_URL;
  const envContainerTagUser = process.env.MOMO_CONTAINER_TAG_USER;
  const envContainerTagProject = process.env.MOMO_CONTAINER_TAG_PROJECT;

  return {
    apiKey: envApiKey ?? projectConfig.apiKey ?? globalConfig.apiKey,
    baseUrl: envBaseUrl ?? projectConfig.baseUrl ?? globalConfig.baseUrl ?? DEFAULT_BASE_URL,
    containerTagUser:
      envContainerTagUser ?? projectConfig.containerTagUser ?? globalConfig.containerTagUser,
    containerTagProject:
      envContainerTagProject
      ?? projectConfig.containerTagProject
      ?? globalConfig.containerTagProject,
  };
}

export function isConfigured(directory?: string): boolean {
  const config = loadConfig(directory);
  return config.apiKey != null && config.apiKey.length > 0;
}
