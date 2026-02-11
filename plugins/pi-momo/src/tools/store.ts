import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { MomoPiClient } from "../client";
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
  pi: ExtensionAPI,
  client: MomoPiClient,
  getSessionId: () => string | undefined,
): void {
  pi.registerTool({
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
      _signal: AbortSignal,
      _onUpdate: (update: unknown) => void,
      _ctx: ExtensionContext,
    ) {
      const detected = detectCategory(params.text);
      const memoryType = params.memoryType ?? toMemoryType(detected);
      const sessionId = getSessionId();

      await client.addMemory({
        content: params.text,
        memoryType,
        metadata: {
          source: "pi_tool",
          category: detected,
        },
        customId: sessionId ? buildDocumentId(sessionId) : undefined,
      });

      log.debug(`tool momo_store type=${memoryType}`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Stored memory: "${shortText(params.text)}"`,
          },
        ],
      };
    },
  });
}
