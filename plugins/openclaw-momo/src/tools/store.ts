import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";
import { buildDocumentId, detectCategory, toMemoryType } from "../memory";

const memoryTypeParam = Type.Union([
  Type.Literal("fact"),
  Type.Literal("preference"),
  Type.Literal("episode"),
]);

function shortText(value: string, limit = 80): string {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

export function registerStoreTool(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
  getSessionKey: () => string | undefined,
): void {
  api.registerTool(
    {
      name: "momo_store",
      label: "Store Memory",
      description: "Write an explicit memory item to Momo.",
      parameters: Type.Object({
        text: Type.String({ description: "Memory content" }),
        memoryType: Type.Optional(memoryTypeParam),
      }),
      async execute(
        _toolCallId: string,
        params: { text: string; memoryType?: "fact" | "preference" | "episode" },
      ) {
        const detected = detectCategory(params.text);
        const memoryType = params.memoryType ?? toMemoryType(detected);
        const sessionKey = getSessionKey();

        await client.addMemory({
          content: params.text,
          memoryType,
          metadata: {
            source: "openclaw_tool",
            category: detected,
          },
          customId: sessionKey ? buildDocumentId(sessionKey) : undefined,
        });

        log.debug(`tool momo_store type=${memoryType}`);

        return {
          content: [
            {
              type: "text" as const,
              text: `Stored memory: \"${shortText(params.text)}\"`,
            },
          ],
        };
      },
    },
    { name: "momo_store" },
  );
}
