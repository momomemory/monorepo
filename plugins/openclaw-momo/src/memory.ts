import type { V1MemoryType } from "@momomemory/sdk";

export const MEMORY_CATEGORIES = [
  "preference",
  "fact",
  "decision",
  "entity",
  "other",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export function detectCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();
  if (/prefer|like|love|hate|want/i.test(lower)) return "preference";
  if (/decided|will use|going with/i.test(lower)) return "decision";
  if (/\+\d{10,}|@[\w.-]+\.\w+|is called/i.test(lower)) return "entity";
  if (/is|are|has|have/i.test(lower)) return "fact";
  return "other";
}

export function toMemoryType(category: MemoryCategory): V1MemoryType {
  switch (category) {
    case "preference":
      return "preference";
    case "fact":
    case "entity":
      return "fact";
    case "decision":
    case "other":
      return "episode";
  }
}

export function buildDocumentId(sessionKey: string): string {
  const sanitized = sessionKey
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `session_${sanitized}`;
}
