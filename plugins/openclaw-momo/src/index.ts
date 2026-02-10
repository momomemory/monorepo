import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { MomoOpenClawClient } from "./client";
import { registerCli } from "./commands/cli";
import { registerCommands } from "./commands/slash";
import { parseConfig, momoConfigSchema } from "./config";
import { buildCaptureHandler } from "./hooks/capture";
import { buildRecallHandler } from "./hooks/recall";
import { initLogger } from "./logger";
import { registerForgetTool } from "./tools/forget";
import { registerProfileTool } from "./tools/profile";
import { registerSearchTool } from "./tools/search";
import { registerStoreTool } from "./tools/store";

export default {
  id: "openclaw-momo",
  name: "Momo",
  description: "OpenClaw plugin for persistent memory using Momo",
  kind: "memory" as const,
  configSchema: momoConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig);

    initLogger(api.logger, cfg.debug);

    const client = new MomoOpenClawClient(
      cfg.baseUrl,
      cfg.apiKey,
      cfg.containerTag,
    );

    let sessionKey: string | undefined;
    const getSessionKey = () => sessionKey;

    registerSearchTool(api, client, cfg);
    registerStoreTool(api, client, cfg, getSessionKey);
    registerForgetTool(api, client, cfg);
    registerProfileTool(api, client, cfg);

    const handleBeforeAgentStart = (
      event: Record<string, unknown>,
      context: Record<string, unknown>,
      handler: (event: Record<string, unknown>) => unknown,
    ) => {
      if (context?.sessionKey) {
        sessionKey = String(context.sessionKey);
      }
      return handler(event);
    };

    if (cfg.autoRecall) {
      const recallHandler = buildRecallHandler(client, cfg);
      api.on("before_agent_start", (event: Record<string, unknown>, ctx: Record<string, unknown>) =>
        handleBeforeAgentStart(event, ctx, recallHandler),
      );
    }

    if (cfg.autoCapture) {
      api.on("agent_end", buildCaptureHandler(client, cfg, getSessionKey));
    }

    registerCommands(api, client, cfg, getSessionKey);
    registerCli(api, client, cfg);

    api.registerService({
      id: "openclaw-momo",
      start: () => {
        api.logger.info(
          `momo: connected (baseUrl=${client.getBaseUrl()}, container=${client.getContainerTag()})`,
        );
      },
      stop: () => {
        api.logger.info("momo: stopped");
      },
    });
  },
};
