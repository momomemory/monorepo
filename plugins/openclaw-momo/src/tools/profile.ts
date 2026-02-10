import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

function section(title: string, items: string[]): string {
  return `## ${title}\n${items.map((item) => `- ${item}`).join("\n")}`;
}

export function registerProfileTool(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
): void {
  api.registerTool(
    {
      name: "momo_profile",
      label: "Memory Profile",
      description: "Retrieve known long-term and recent profile facts.",
      parameters: Type.Object({
        query: Type.Optional(Type.String({ description: "Optional profile focus query" })),
      }),
      async execute(_toolCallId: string, params: { query?: string }) {
        log.debug(`tool momo_profile query=${params.query ?? "(none)"}`);

        const profile = await client.getProfile(params.query);
        if (!profile.narrative && profile.static.length === 0 && profile.dynamic.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Profile is currently empty." }],
          };
        }

        const blocks: string[] = [];
        if (profile.narrative) blocks.push(`## Summary\n${profile.narrative}`);
        if (profile.static.length > 0) blocks.push(section("Persistent Facts", profile.static));
        if (profile.dynamic.length > 0) blocks.push(section("Recent Signals", profile.dynamic));

        return {
          content: [{ type: "text" as const, text: blocks.join("\n\n") }],
          details: {
            hasNarrative: Boolean(profile.narrative),
            staticCount: profile.static.length,
            dynamicCount: profile.dynamic.length,
          },
        };
      },
    },
    { name: "momo_profile" },
  );
}
