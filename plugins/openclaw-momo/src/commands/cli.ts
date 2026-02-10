import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

export function registerCli(
  api: OpenClawPluginApi,
  client: MomoOpenClawClient,
  _cfg: MomoOpenClawConfig,
): void {
  api.registerCli(
    // openclaw SDK does not currently ship strict CLI program types.
    ({ program }: { program: any }) => {
      const cmd = program.command("momo").description("Momo long-term memory commands");

      cmd
        .command("search")
        .argument("<query>", "Search query")
        .option("--limit <n>", "Max results", "5")
        .action(async (query: string, opts: { limit: string }) => {
          const limit = Number.parseInt(opts.limit, 10) || 5;
          log.debug(`cli search: query=${query} limit=${limit}`);

          const results = await client.search(query, limit);
          if (results.length === 0) {
            console.log("No memories found.");
            return;
          }

          for (const row of results) {
            const score = row.similarity
              ? ` (${(row.similarity * 100).toFixed(0)}%)`
              : "";
            console.log(`- ${row.content}${score}`);
          }
        });

      cmd
        .command("profile")
        .option("--query <q>", "Optional query to focus profile retrieval")
        .action(async (opts: { query?: string }) => {
          log.debug(`cli profile: query=${opts.query ?? "(none)"}`);

          const profile = await client.getProfile(opts.query);
          if (profile.static.length === 0 && profile.dynamic.length === 0) {
            console.log("No profile information available yet.");
            return;
          }

          if (profile.narrative) {
            console.log("Summary:");
            console.log(`  ${profile.narrative}`);
          }

          if (profile.static.length > 0) {
            console.log("Stable Facts:");
            for (const fact of profile.static) console.log(`  - ${fact}`);
          }

          if (profile.dynamic.length > 0) {
            console.log("Recent Context:");
            for (const fact of profile.dynamic) console.log(`  - ${fact}`);
          }
        });

      cmd
        .command("wipe")
        .description("Delete ALL memories for this container tag")
        .action(async () => {
          const tag = client.getContainerTag();
          const readline = await import("node:readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(
              `This will permanently delete all memories in \"${tag}\". Type \"yes\" to confirm: `,
              resolve,
            );
          });
          rl.close();

          if (answer.trim().toLowerCase() !== "yes") {
            console.log("Aborted.");
            return;
          }

          log.debug(`cli wipe: container=${tag}`);
          const result = await client.wipeAllMemories();
          console.log(`Wiped ${result.deletedCount} memories from \"${tag}\".`);
        });
    },
    { commands: ["momo"] },
  );
}
