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
      label: "Forget Memory",
      description: "Delete a memory by id or by search query.",
      parameters: Type.Object({
        memoryId: Type.Optional(Type.String({ description: "Exact memory id" })),
        query: Type.Optional(Type.String({ description: "Query to locate memory" })),
      }),
      async execute(
        _toolCallId: string,
        params: { memoryId?: string; query?: string },
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
    },
    { name: "momo_forget" },
  );
}
