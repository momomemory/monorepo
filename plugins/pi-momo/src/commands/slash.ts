import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { MomoPiClient } from "../client";
import type { MomoPiConfig, MomoPiConfigMeta } from "../config";
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

function maskSecret(secret?: string): string {
  if (!secret) return "(not set)";
  if (secret.length <= 8) return `${secret[0]}***${secret[secret.length - 1]} (${secret.length} chars)`;
  return `${secret.slice(0, 4)}...${secret.slice(-4)} (${secret.length} chars)`;
}

function output(ctx: ExtensionContext, message: string, level: "info" | "success" | "warning" | "error" = "info"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
    return;
  }

  if (level === "error") {
    console.error(message);
    return;
  }

  console.log(message);
}

export function registerCommands(
  pi: ExtensionAPI,
  client: MomoPiClient,
  getSessionId: () => string | undefined,
  cfg: MomoPiConfig,
  cfgMeta: MomoPiConfigMeta,
): void {
  pi.registerCommand("remember", {
    description: "Persist an explicit memory",
    handler: async (args: string, ctx: ExtensionContext) => {
      const payload = args.trim();
      if (!payload) {
        output(ctx, "Usage: /remember <text>", "error");
        return;
      }

      try {
        const category = detectCategory(payload);
        const sessionId = getSessionId();
        await client.addMemory({
          content: payload,
          memoryType: toMemoryType(category),
          metadata: {
            source: "pi_command",
            category,
          },
          customId: sessionId ? buildDocumentId(sessionId) : undefined,
        });

        output(ctx, `Saved to memory: \"${rememberPreview(payload)}\"`, "success");
      } catch (err) {
        log.error("/remember failed", err);
        output(ctx, "Could not save that memory.", "error");
      }
    },
  });

  pi.registerCommand("recall", {
    description: "Find memories related to your query",
    handler: async (args: string, ctx: ExtensionContext) => {
      const query = args.trim();
      if (!query) {
        output(ctx, "Usage: /recall <query>", "error");
        return;
      }

      try {
        const rows = await client.search(query, 5);
        if (rows.length === 0) {
          output(ctx, `No memory matches for \"${query}\".`, "info");
          return;
        }

        output(ctx, `Memory matches (${rows.length}):\n\n${formatSearchRows(rows)}`, "info");
      } catch (err) {
        log.error("/recall failed", err);
        output(ctx, "Could not run memory search.", "error");
      }
    },
  });

  pi.registerCommand("momo-profile", {
    description: "Show your memory profile summary",
    handler: async (_args: string, ctx: ExtensionContext) => {
      try {
        const profile = await client.getProfile();

        if (!profile.narrative && profile.static.length === 0 && profile.dynamic.length === 0) {
          output(ctx, "Profile is currently empty.", "info");
          return;
        }

        const parts: string[] = [];
        if (profile.narrative) {
          parts.push(`Summary: ${profile.narrative}`);
        }
        if (profile.static.length > 0) {
          parts.push(`Persistent Facts (${profile.static.length}):\n${profile.static.map((f) => `  - ${f}`).join("\n")}`);
        }
        if (profile.dynamic.length > 0) {
          parts.push(`Recent Signals (${profile.dynamic.length}):\n${profile.dynamic.map((f) => `  - ${f}`).join("\n")}`);
        }

        output(ctx, parts.join("\n\n"), "info");
      } catch (err) {
        log.error("/momo-profile failed", err);
        output(ctx, "Could not retrieve profile.", "error");
      }
    },
  });

  pi.registerCommand("momo-debug", {
    description: "Show effective momo config and where each value came from",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const lines = [
        "Momo debug",
        "",
        `cwd: ${cfgMeta.cwd ?? "(unknown)"}`,
        "",
        "Config files discovered:",
        `- project: ${cfgMeta.files.project ?? "(none)"}`,
        `- ~/.omp/momo.jsonc: ${cfgMeta.files.ompGlobal ?? "(none)"}`,
        `- ~/.pi/momo.jsonc: ${cfgMeta.files.piGlobal ?? "(none)"}`,
        "",
        "Effective values:",
        `- baseUrl: ${cfg.baseUrl} [${cfgMeta.sources.baseUrl}]`,
        `- apiKey: ${maskSecret(cfg.apiKey)} [${cfgMeta.sources.apiKey}]`,
        `- containerTag: ${cfg.containerTag} [${cfgMeta.sources.containerTag}]`,
        `- autoRecall: ${String(cfg.autoRecall)} [${cfgMeta.sources.autoRecall}]`,
        `- autoCapture: ${String(cfg.autoCapture)} [${cfgMeta.sources.autoCapture}]`,
        `- maxRecallResults: ${String(cfg.maxRecallResults)} [${cfgMeta.sources.maxRecallResults}]`,
        `- profileFrequency: ${String(cfg.profileFrequency)} [${cfgMeta.sources.profileFrequency}]`,
        `- debug: ${String(cfg.debug)} [${cfgMeta.sources.debug}]`,
      ];

      output(ctx, lines.join("\n"), "info");
    },
  });
}
