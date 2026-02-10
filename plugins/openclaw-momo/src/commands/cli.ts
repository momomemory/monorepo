import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

function formatSimilarity(score?: number): string {
  if (typeof score !== "number") return "";
  return ` (${Math.round(score * 100)}%)`;
}

function printProfile(profile: {
  narrative?: string;
  static: string[];
  dynamic: string[];
}): void {
  if (profile.narrative) {
    console.log("Summary:");
    console.log(`  ${profile.narrative}`);
  }

  if (profile.static.length > 0) {
    console.log("Stable Facts:");
    for (const item of profile.static) console.log(`  - ${item}`);
  }

  if (profile.dynamic.length > 0) {
    console.log("Recent Signals:");
    for (const item of profile.dynamic) console.log(`  - ${item}`);
  }
}

export function registerCli(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
): void {
  api.registerCli(
    // OpenClaw CLI "program" type is not exported yet.
    ({ program }: { program: any }) => {
      const momo = program
        .command("momo")
        .description("Momo memory helper commands");

      momo
        .command("search")
        .argument("<query>", "Query to search for")
        .option("--limit <n>", "Max rows", "5")
        .action(async (query: string, options: { limit: string }) => {
          const limit = Number.parseInt(options.limit, 10) || 5;
          const rows = await client.search(query, limit);

          if (rows.length === 0) {
            console.log("No memories found.");
            return;
          }

          for (const row of rows) {
            console.log(`- ${row.content}${formatSimilarity(row.similarity)}`);
          }
        });

      momo
        .command("profile")
        .option("--query <q>", "Optional profile focus query")
        .action(async (options: { query?: string }) => {
          log.debug(`cli profile query=${options.query ?? "(none)"}`);
          const profile = await client.getProfile(options.query);

          if (!profile.narrative && profile.static.length === 0 && profile.dynamic.length === 0) {
            console.log("No profile data available yet.");
            return;
          }

          printProfile(profile);
        });

      momo
        .command("wipe")
        .description("Forget every memory in the current container")
        .action(async () => {
          const containerTag = client.getContainerTag();
          const readline = await import("node:readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(
              `Delete all memories for \"${containerTag}\"? Type yes to continue: `,
              resolve,
            );
          });
          rl.close();

          if (answer.trim().toLowerCase() !== "yes") {
            console.log("Canceled.");
            return;
          }

          const { deletedCount } = await client.wipeAllMemories();
          console.log(`Deleted ${deletedCount} memories from ${containerTag}.`);
        });
    },
    { commands: ["momo"] },
  );
}
