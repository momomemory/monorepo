import type { V1MemoryType } from "@momomemory/sdk";

export const MEMORY_CATEGORIES = [
  "preference",
  "fact",
  "decision",
  "entity",
  "other",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

type CategoryRule = {
  category: MemoryCategory;
  tests: RegExp[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "preference",
    tests: [
      /\b(prefer|preference|like|love|hate)\b/i,
      /\b(i want|we want|please use|avoid)\b/i,
    ],
  },
  {
    category: "decision",
    tests: [
      /\b(decided|decision|going with|choose|chosen)\b/i,
      /\b(will use|won't use|standardize on)\b/i,
    ],
  },
  {
    category: "entity",
    tests: [
      /\b([\w.-]+@[\w.-]+\.[A-Za-z]{2,})\b/,
      /\b(\+\d{10,})\b/,
      /\b(named|called|owner is|maintainer is)\b/i,
    ],
  },
  {
    category: "fact",
    tests: [
      /\b(is|are|has|have|contains|uses)\b/i,
      /\b(located in|runs on|depends on)\b/i,
    ],
  },
];

export function detectCategory(text: string): MemoryCategory {
  if (!text || text.trim().length === 0) {
    return "other";
  }

  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.tests) {
      if (pattern.test(text)) {
        return rule.category;
      }
    }
  }

  return "other";
}

export function toMemoryType(category: MemoryCategory): V1MemoryType {
  if (category === "preference") return "preference";
  if (category === "fact" || category === "entity") return "fact";
  return "episode";
}

function normalizeSessionKey(input: string): string {
  return input
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildDocumentId(sessionKey: string): string {
  const normalized = normalizeSessionKey(sessionKey);
  return `session_${normalized}`;
}
