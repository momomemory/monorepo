import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

export function registerProfileTool(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
): void {
  api.registerTool(
    {
      name: "momo_profile",
      label: "User Profile",
      description:
        "Get a summary of what is known about the user — stable preferences and recent context.",
      parameters: Type.Object({
        query: Type.Optional(
          Type.String({
            description: "Optional query to focus profile retrieval",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: { query?: string }) {
        log.debug(`profile tool: query=${params.query ?? "(none)"}`);

        const profile = await client.getProfile(params.query);

        if (profile.static.length === 0 && profile.dynamic.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No profile information available yet.",
              },
            ],
          };
        }

        const sections: string[] = [];

        if (profile.narrative) {
          sections.push(`## Summary\n${profile.narrative}`);
        }

        if (profile.static.length > 0) {
          sections.push(
            "## User Profile (Persistent)\n" +
              profile.static.map((fact) => `- ${fact}`).join("\n"),
          );
        }

        if (profile.dynamic.length > 0) {
          sections.push(
            "## Recent Context\n" +
              profile.dynamic.map((fact) => `- ${fact}`).join("\n"),
          );
        }

        return {
          content: [{ type: "text" as const, text: sections.join("\n\n") }],
          details: {
            staticCount: profile.static.length,
            dynamicCount: profile.dynamic.length,
          },
        };
      },
    },
    { name: "momo_profile" },
  );
}
