import type { ProfileSearchResult, MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

type RecallItem = {
  value: string;
  updatedAt?: string;
  similarity?: number;
};

function humanizeTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "";

  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60_000);
  const hours = Math.floor(deltaMs / 3_600_000);
  const days = Math.floor(deltaMs / 86_400_000);

  if (minutes < 30) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function mergeDeduped(...groups: RecallItem[][]): RecallItem[] {
  const seen = new Set<string>();
  const merged: RecallItem[] = [];

  for (const group of groups) {
    for (const item of group) {
      const key = item.value.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

function toSearchItems(rows: ProfileSearchResult[]): RecallItem[] {
  return rows
    .map((row) => ({
      value: row.memory ?? "",
      updatedAt: row.updatedAt,
      similarity: row.similarity,
    }))
    .filter((row) => row.value.length > 0);
}

function asFacts(values: string[]): RecallItem[] {
  return values.map((value) => ({ value }));
}

function shouldIncludeProfile(turnCount: number, frequency: number): boolean {
  if (turnCount <= 1) return true;
  return turnCount % frequency === 0;
}

function buildContextEnvelope(
  profileFacts: RecallItem[],
  recentFacts: RecallItem[],
  relevantFacts: RecallItem[],
  limit: number,
): string | null {
  const merged = mergeDeduped(profileFacts, recentFacts, relevantFacts);
  if (merged.length === 0) return null;

  const profileSection = profileFacts
    .slice(0, limit)
    .map((item) => `- ${item.value}`)
    .join("\n");

  const recentSection = recentFacts
    .slice(0, limit)
    .map((item) => `- ${item.value}`)
    .join("\n");

  const relevantSection = relevantFacts
    .slice(0, limit)
    .map((item) => {
      const pct = typeof item.similarity === "number" ? ` ${Math.round(item.similarity * 100)}%` : "";
      const age = item.updatedAt ? ` (${humanizeTime(item.updatedAt)})` : "";
      return `- ${item.value}${pct}${age}`;
    })
    .join("\n");

  const sections: string[] = [];
  if (profileSection) sections.push(`## Long-term Profile\n${profileSection}`);
  if (recentSection) sections.push(`## Recent Signals\n${recentSection}`);
  if (relevantSection) sections.push(`## Relevant Matches\n${relevantSection}`);

  if (sections.length === 0) return null;

  return [
    "<momo-context>",
    "Use this context only when it clearly helps answer the user.",
    "",
    sections.join("\n\n"),
    "",
    "Do not claim memories that are not explicitly listed.",
    "</momo-context>",
  ].join("\n");
}

function countUserTurns(messages: unknown[]): number {
  return messages.reduce<number>((acc, row) => {
    if (!row || typeof row !== "object") return acc;
    return (row as Record<string, unknown>).role === "user" ? acc + 1 : acc;
  }, 0);
}

export function buildRecallHandler(client: MomoOpenClawClient, cfg: MomoOpenClawConfig) {
  return async (event: Record<string, unknown>) => {
    const prompt = typeof event.prompt === "string" ? event.prompt.trim() : "";
    if (prompt.length < 5) return;

    const messages = Array.isArray(event.messages) ? event.messages : [];
    const turnCount = countUserTurns(messages);
    const includeProfile = shouldIncludeProfile(turnCount, cfg.profileFrequency);

    log.debug(`recall: turn=${turnCount} includeProfile=${includeProfile}`);

    try {
      const profile = await client.getProfile(prompt);
      const profileFacts = includeProfile ? asFacts(profile.static) : [];
      const recentFacts = includeProfile ? asFacts(profile.dynamic) : [];
      const relevantFacts = toSearchItems(profile.searchResults);

      const context = buildContextEnvelope(
        profileFacts,
        recentFacts,
        relevantFacts,
        cfg.maxRecallResults,
      );

      if (!context) return;

      log.debug(`recall: injecting ${context.length} chars`);
      return { prependContext: context };
    } catch (err) {
      log.error("recall failed", err);
      return;
    }
  };
}
