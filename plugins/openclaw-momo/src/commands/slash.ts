import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";
import { buildDocumentId, detectCategory, toMemoryType } from "../memory";

function formatSearchRows(
  rows: Array<{ content: string; similarity?: number }>,
): string {
  return rows
    .map((row, index) => {
      const pct = typeof row.similarity === "number"
        ? ` (${Math.round(row.similarity * 100)}%)`
        : "";
      return `${index + 1}. ${row.content}${pct}`;
    })
    .join("\n");
}

function rememberPreview(text: string): string {
  const max = 64;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function registerCommands(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
  getSessionKey: () => string | undefined,
): void {
  api.registerCommand({
    name: "remember",
    description: "Persist an explicit memory",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: { args?: string }) => {
      const payload = ctx.args?.trim();
      if (!payload) {
        return { text: "Usage: /remember <text>" };
      }

      try {
        const category = detectCategory(payload);
        const sessionKey = getSessionKey();
        await client.addMemory({
          content: payload,
          memoryType: toMemoryType(category),
          metadata: {
            source: "openclaw_command",
            category,
          },
          customId: sessionKey ? buildDocumentId(sessionKey) : undefined,
        });

        return { text: `Saved to memory: \"${rememberPreview(payload)}\"` };
      } catch (err) {
        log.error("/remember failed", err);
        return { text: "Could not save that memory." };
      }
    },
  });

  api.registerCommand({
    name: "recall",
    requireAuth: true,
    acceptsArgs: true,
    description: "Find memories related to your query",
    handler: async (ctx: { args?: string }) => {
      const query = ctx.args?.trim();
      if (!query) {
        return { text: "Usage: /recall <query>" };
      }

      try {
        const rows = await client.search(query, 5);
        if (rows.length === 0) {
          return { text: `No memory matches for \"${query}\".` };
        }

        return {
          text: `Memory matches (${rows.length}):\n\n${formatSearchRows(rows)}`,
        };
      } catch (err) {
        log.error("/recall failed", err);
        return { text: "Could not run memory search." };
      }
    },
  });
}
