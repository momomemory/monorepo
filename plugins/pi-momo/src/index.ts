import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { MomoPiClient } from "./client";
import { registerCommands } from "./commands/slash";
import { loadPiPluginConfig } from "@momomemory/sdk";
import { buildCaptureHandler } from "./hooks/capture";
import { buildRecallHandler } from "./hooks/recall";
import { initLogger, log } from "./logger";
import { registerForgetTool } from "./tools/forget";
import { registerProfileTool } from "./tools/profile";
import { registerSearchTool } from "./tools/search";
import { registerStoreTool } from "./tools/store";

// Create a logger backend using console
const consoleLogger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[INFO] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => console.debug(`[DEBUG] ${msg}`, ...args),
};

export default function (pi: ExtensionAPI) {
  // Load config from files + env vars
  const { config: cfg } = loadPiPluginConfig({ cwd: process.cwd() });

  initLogger(consoleLogger, cfg.debug);

  const client = new MomoPiClient(
    cfg.baseUrl,
    cfg.apiKey,
    cfg.containerTag,
  );

  let sessionId: string | undefined;
  const getSessionId = () => sessionId;

  // Register tools
  registerSearchTool(pi, client);
  registerStoreTool(pi, client, getSessionId);
  registerForgetTool(pi, client);
  registerProfileTool(pi, client);

  // Track session for capture
  pi.on("session_start", async (_event, ctx) => {
    const sessionFile = ctx.sessionManager.getSessionFile();
    if (sessionFile) {
      sessionId = sessionFile.replace(/[^A-Za-z0-9_]+/g, "_");
    }
  });

  // Auto-recall before agent starts
  if (cfg.autoRecall) {
    pi.on("before_agent_start", async (event, _ctx) => {
      const recallHandler = buildRecallHandler(client, cfg);
      return recallHandler(event);
    });
  }

  // Auto-capture after agent ends
  if (cfg.autoCapture) {
    pi.on("agent_end", async (event, _ctx) => {
      const captureHandler = buildCaptureHandler(client, cfg, getSessionId);
      await captureHandler(event);
    });
  }

  // Register slash commands
  registerCommands(pi, client, getSessionId, cfg);

  log.info(`momo: connected (baseUrl=${client.getBaseUrl()}, container=${client.getContainerTag()})`);
}
