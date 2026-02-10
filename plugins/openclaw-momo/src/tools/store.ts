import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";
import { buildDocumentId, detectCategory, toMemoryType } from "../memory";

const memoryTypeSchema = Type.Union([
  Type.Literal("fact"),
  Type.Literal("preference"),
  Type.Literal("episode"),
]);

export function registerStoreTool(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
  getSessionKey: () => string | undefined,
): void {
  api.registerTool(
    {
      name: "momo_store",
      label: "Memory Store",
      description: "Save important information to long-term memory.",
      parameters: Type.Object({
        text: Type.String({ description: "Information to remember" }),
        memoryType: Type.Optional(memoryTypeSchema),
      }),
      async execute(
        _toolCallId: string,
        params: { text: string; memoryType?: "fact" | "preference" | "episode" },
      ) {
        const inferredCategory = detectCategory(params.text);
        const memoryType = params.memoryType ?? toMemoryType(inferredCategory);

        const sessionKey = getSessionKey();
        const customId = sessionKey ? buildDocumentId(sessionKey) : undefined;

        log.debug(`store tool: memoryType=${memoryType} customId=${customId}`);

        await client.addMemory(
          params.text,
          memoryType,
          { source: "openclaw_tool", category: inferredCategory },
          customId,
        );

        const preview = params.text.length > 80 ? `${params.text.slice(0, 80)}...` : params.text;

        return {
          content: [{ type: "text" as const, text: `Stored: \"${preview}\"` }],
        };
      },
    },
    { name: "momo_store" },
  );
}
