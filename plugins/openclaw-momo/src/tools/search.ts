import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

function renderRows(rows: Array<{ content: string; similarity?: number }>): string {
  return rows
    .map((row, index) => {
      const score = typeof row.similarity === "number"
        ? ` (${Math.round(row.similarity * 100)}%)`
        : "";
      return `${index + 1}. ${row.content}${score}`;
    })
    .join("\n");
}

export function registerSearchTool(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
): void {
  api.registerTool(
    {
      name: "momo_search",
      label: "Memory Search",
      description: "Find memory entries relevant to a query.",
      parameters: Type.Object({
        query: Type.String({ description: "Search text" }),
        limit: Type.Optional(Type.Number({ description: "Maximum number of results" })),
      }),
      async execute(_toolCallId: string, params: { query: string; limit?: number }) {
        const limit = typeof params.limit === "number" ? params.limit : 5;
        log.debug(`tool momo_search query=${params.query} limit=${limit}`);

        const rows = await client.search(params.query, limit);
        if (rows.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No memory matches found." }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${rows.length} matching memories:\n\n${renderRows(rows)}`,
            },
          ],
          details: {
            count: rows.length,
            rows: rows.map((row) => ({
              id: row.id,
              similarity: row.similarity,
            })),
          },
        };
      },
    },
    { name: "momo_search" },
  );
}
