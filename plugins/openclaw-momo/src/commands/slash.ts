import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";
import { buildDocumentId, detectCategory, toMemoryType } from "../memory";

export function registerCommands(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
  getSessionKey: () => string | undefined,
): void {
  api.registerCommand({
    name: "remember",
    description: "Save something to long-term memory",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: { args?: string }) => {
      const text = ctx.args?.trim();
      if (!text) {
        return { text: "Usage: /remember <text to remember>" };
      }

      log.debug(`/remember command: ${text.slice(0, 50)}`);

      try {
        const category = detectCategory(text);
        const sessionKey = getSessionKey();
        await client.addMemory(
          text,
          toMemoryType(category),
          { category, source: "openclaw_command" },
          sessionKey ? buildDocumentId(sessionKey) : undefined,
        );

        const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;
        return { text: `Remembered: \"${preview}\"` };
      } catch (err) {
        log.error("/remember failed", err);
        return { text: "Failed to save memory. Check logs for details." };
      }
    },
  });

  api.registerCommand({
    name: "recall",
    description: "Search your memories",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: { args?: string }) => {
      const query = ctx.args?.trim();
      if (!query) {
        return { text: "Usage: /recall <search query>" };
      }

      log.debug(`/recall command: ${query}`);

      try {
        const results = await client.search(query, 5);
        if (results.length === 0) {
          return { text: `No memories found for: \"${query}\"` };
        }

        const lines = results.map((row, idx) => {
          const score = row.similarity
            ? ` (${(row.similarity * 100).toFixed(0)}%)`
            : "";
          return `${idx + 1}. ${row.content}${score}`;
        });

        return {
          text: `Found ${results.length} memories:\n\n${lines.join("\n")}`,
        };
      } catch (err) {
        log.error("/recall failed", err);
        return { text: "Failed to search memories. Check logs for details." };
      }
    },
  });
}
