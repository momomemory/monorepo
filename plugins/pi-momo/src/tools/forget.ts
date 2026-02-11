import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { MomoPiClient } from "../client";
import { log } from "../logger";

export function registerForgetTool(
  pi: ExtensionAPI,
  client: MomoPiClient,
): void {
  pi.registerTool({
    name: "momo_forget",
    label: "Forget Memory",
    description: "Delete a memory by id or by search query.",
    parameters: Type.Object({
      memoryId: Type.Optional(Type.String({ description: "Exact memory id" })),
      query: Type.Optional(Type.String({ description: "Query to locate memory" })),
    }),
    async execute(
      _toolCallId: string,
      params: { memoryId?: string; query?: string },
      _signal: AbortSignal,
      _onUpdate: (update: unknown) => void,
      _ctx: ExtensionContext,
    ) {
      if (params.memoryId) {
        log.debug(`tool momo_forget memoryId=${params.memoryId}`);
        await client.deleteMemory(params.memoryId);
        return {
          content: [{ type: "text" as const, text: "Deleted memory entry." }],
        };
      }

      if (params.query) {
        log.debug(`tool momo_forget query=${params.query}`);
        const result = await client.forgetByQuery(params.query);
        return {
          content: [{ type: "text" as const, text: result.message }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "Specify either memoryId or query.",
          },
        ],
      };
    },
  });
}
