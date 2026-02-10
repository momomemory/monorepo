import type { ProfileSearchResult, MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

function formatRelativeTime(isoTimestamp: string): string {
  try {
    const dt = new Date(isoTimestamp);
    const now = new Date();
    const seconds = (now.getTime() - dt.getTime()) / 1000;
    const minutes = seconds / 60;
    const hours = seconds / 3600;
    const days = seconds / 86400;

    if (minutes < 30) return "just now";
    if (minutes < 60) return `${Math.floor(minutes)}mins ago`;
    if (hours < 24) return `${Math.floor(hours)} hrs ago`;
    if (days < 7) return `${Math.floor(days)}d ago`;

    const month = dt.toLocaleString("en", { month: "short" });
    if (dt.getFullYear() === now.getFullYear()) {
      return `${dt.getDate()} ${month}`;
    }

    return `${dt.getDate()} ${month}, ${dt.getFullYear()}`;
  } catch {
    return "";
  }
}

function deduplicateMemories(
  staticFacts: string[],
  dynamicFacts: string[],
  searchResults: ProfileSearchResult[],
): {
  static: string[];
  dynamic: string[];
  searchResults: ProfileSearchResult[];
} {
  const seen = new Set<string>();

  const uniqueStatic = staticFacts.filter((memory) => {
    if (seen.has(memory)) return false;
    seen.add(memory);
    return true;
  });

  const uniqueDynamic = dynamicFacts.filter((memory) => {
    if (seen.has(memory)) return false;
    seen.add(memory);
    return true;
  });

  const uniqueSearch = searchResults.filter((row) => {
    const memory = row.memory ?? "";
    if (!memory || seen.has(memory)) return false;
    seen.add(memory);
    return true;
  });

  return {
    static: uniqueStatic,
    dynamic: uniqueDynamic,
    searchResults: uniqueSearch,
  };
}

function formatContext(
  staticFacts: string[],
  dynamicFacts: string[],
  searchResults: ProfileSearchResult[],
  maxResults: number,
): string | null {
  const deduped = deduplicateMemories(staticFacts, dynamicFacts, searchResults);
  const statics = deduped.static.slice(0, maxResults);
  const dynamics = deduped.dynamic.slice(0, maxResults);
  const search = deduped.searchResults.slice(0, maxResults);

  if (statics.length === 0 && dynamics.length === 0 && search.length === 0) {
    return null;
  }

  const sections: string[] = [];

  if (statics.length > 0) {
    sections.push(
      "## User Profile (Persistent)\n" +
        statics.map((fact) => `- ${fact}`).join("\n"),
    );
  }

  if (dynamics.length > 0) {
    sections.push(
      `## Recent Context\n${dynamics.map((fact) => `- ${fact}`).join("\n")}`,
    );
  }

  if (search.length > 0) {
    const lines = search.map((row) => {
      const memory = row.memory ?? "";
      const timeStr = row.updatedAt ? formatRelativeTime(row.updatedAt) : "";
      const pct = row.similarity != null ? `[${Math.round(row.similarity * 100)}%]` : "";
      const prefix = timeStr ? `[${timeStr}]` : "";
      return `- ${prefix}${memory} ${pct}`.trim();
    });

    sections.push(`## Relevant Memories\n${lines.join("\n")}`);
  }

  const intro =
    "The following is recalled context about the user. Reference it only when relevant to the conversation.";
  const disclaimer =
    "Use these memories naturally when relevant, but do not force them into every response.";

  return `<momo-context>\n${intro}\n\n${sections.join("\n\n")}\n\n${disclaimer}\n</momo-context>`;
}

function countUserTurns(messages: unknown[]): number {
  let count = 0;
  for (const row of messages) {
    if (
      row &&
      typeof row === "object" &&
      (row as Record<string, unknown>).role === "user"
    ) {
      count += 1;
    }
  }
  return count;
}

export function buildRecallHandler(
  client: MomoOpenClawClient,
  cfg: MomoOpenClawConfig,
) {
  return async (event: Record<string, unknown>) => {
    const prompt = event.prompt as string | undefined;
    if (!prompt || prompt.length < 5) {
      return;
    }

    const messages = Array.isArray(event.messages) ? event.messages : [];
    const turn = countUserTurns(messages);
    const includeProfile = turn <= 1 || turn % cfg.profileFrequency === 0;

    log.debug(`recalling for turn ${turn} (profile: ${includeProfile})`);

    try {
      const profile = await client.getProfile(prompt);
      const context = formatContext(
        includeProfile ? profile.static : [],
        includeProfile ? profile.dynamic : [],
        profile.searchResults,
        cfg.maxRecallResults,
      );

      if (!context) {
        log.debug("no profile data to inject");
        return;
      }

      log.debug(`injecting context (${context.length} chars, turn ${turn})`);
      return { prependContext: context };
    } catch (err) {
      log.error("recall failed", err);
      return;
    }
  };
}
