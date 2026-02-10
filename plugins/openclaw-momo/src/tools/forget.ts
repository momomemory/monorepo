import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

export function registerForgetTool(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
): void {
  api.registerTool(
    {
      name: "momo_forget",
      label: "Memory Forget",
      description:
        "Forget/delete a specific memory. Searches for the closest match and removes it.",
      parameters: Type.Object({
        query: Type.Optional(Type.String({ description: "Describe the memory to forget" })),
        memoryId: Type.Optional(Type.String({ description: "Direct memory ID to delete" })),
      }),
      async execute(
        _toolCallId: string,
        params: { query?: string; memoryId?: string },
      ) {
        if (params.memoryId) {
          log.debug(`forget tool: direct delete id=${params.memoryId}`);
          await client.deleteMemory(params.memoryId);
          return {
            content: [{ type: "text" as const, text: "Memory forgotten." }],
          };
        }

        if (params.query) {
          log.debug(`forget tool: search-then-delete query=${params.query}`);
          const result = await client.forgetByQuery(params.query);
          return {
            content: [{ type: "text" as const, text: result.message }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: "Provide a query or memoryId to forget.",
            },
          ],
        };
      },
    },
    { name: "momo_forget" },
  );
}
