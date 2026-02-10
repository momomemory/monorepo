import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

export function registerSearchTool(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
): void {
  api.registerTool(
    {
      name: "momo_search",
      label: "Memory Search",
      description: "Search through long-term memories for relevant information.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(Type.Number({ description: "Max results (default: 5)" })),
      }),
      async execute(
        _toolCallId: string,
        params: { query: string; limit?: number },
      ) {
        const limit = params.limit ?? 5;
        log.debug(`search tool: query=${params.query} limit=${limit}`);

        const results = await client.search(params.query, limit);

        if (results.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No relevant memories found." }],
          };
        }

        const text = results
          .map((row, idx) => {
            const score = row.similarity
              ? ` (${(row.similarity * 100).toFixed(0)}%)`
              : "";
            return `${idx + 1}. ${row.content}${score}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${results.length} memories:\n\n${text}`,
            },
          ],
          details: {
            count: results.length,
            memories: results.map((row) => ({
              id: row.id,
              content: row.content,
              similarity: row.similarity,
            })),
          },
        };
      },
    },
    { name: "momo_search" },
  );
}
