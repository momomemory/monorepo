/**
 * Context formatting for injecting Momo memory into chat sessions.
 */

interface MemoryItem {
  content?: string;
  memoryType?: string;
  id?: string;
  createdAt?: string;
}

interface ProfileData {
  summary?: string;
  traits?: string[];
  preferences?: Record<string, unknown>;
}

export function formatContextForPrompt(
  profile: ProfileData | null | undefined,
  userMemories: MemoryItem[],
  projectMemories: MemoryItem[],
): string {
  const sections: string[] = [];

  // User profile section
  if (profile?.summary) {
    sections.push(`## User Profile\n${profile.summary}`);
  }

  if (profile?.traits && profile.traits.length > 0) {
    sections.push(
      `## Known Preferences\n${profile.traits.map((t) => `- ${t}`).join("\n")}`,
    );
  }

  // User memories section
  if (userMemories.length > 0) {
    const formatted = userMemories
      .map((m) => {
        const typeLabel = m.memoryType ? ` [${m.memoryType}]` : "";
        return `- ${m.content}${typeLabel}`;
      })
      .join("\n");
    sections.push(`## Recent User Context\n${formatted}`);
  }

  // Project memories section
  if (projectMemories.length > 0) {
    const formatted = projectMemories
      .map((m) => {
        const typeLabel = m.memoryType ? ` [${m.memoryType}]` : "";
        return `- ${m.content}${typeLabel}`;
      })
      .join("\n");
    sections.push(`## Project Knowledge\n${formatted}`);
  }

  if (sections.length === 0) {
    return "";
  }

  return `[MOMO MEMORY - Context from previous sessions]\n\n${sections.join("\n\n")}\n\n[END MOMO MEMORY]`;
}
