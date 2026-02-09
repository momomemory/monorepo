import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { MomoClient } from "@momomemory/sdk";
import { loadConfig, isConfigured } from "./config";
import { getTagsWithOverrides } from "./services/tags";
import { stripPrivateContent, isFullyPrivate } from "./services/privacy";
import { formatContextForPrompt } from "./services/context";
import { handleCompactionEvent } from "./services/compaction";

const z = tool.schema;

// Track which sessions have already had memory context injected
const injectedSessions = new Set<string>();

const HELP_TEXT = `**Momo Memory Commands**

| Mode | Description |
|------|-------------|
| \`help\` | Show this help message |
| \`add\` | Store a memory (requires \`content\`) |
| \`search\` | Search memories (requires \`query\`) |
| \`profile\` | View your computed user profile |
| \`list\` | List recent memories |
| \`forget\` | Forget a memory by ID (requires \`memoryId\`) |

**Scopes:** \`user\` (personal across projects) or \`project\` (current project only). Defaults vary by mode.

**Memory Types (for add):** \`fact\`, \`preference\`, \`episode\`

**Examples:**
- \`momo({ mode: "add", content: "User prefers dark mode", scope: "user", memoryType: "preference" })\`
- \`momo({ mode: "search", query: "database schema" })\`
- \`momo({ mode: "forget", memoryId: "mem_abc123" })\`
`;

/** Reset injected sessions tracking. Visible for testing. */
export function _resetInjectedSessions(): void {
  injectedSessions.clear();
}

export const MomoPlugin: Plugin = async (ctx: PluginInput) => {
  const config = loadConfig();
  const configured = isConfigured();

  // Initialize Momo client if configured
  let momo: MomoClient | undefined;
  if (configured) {
    momo = new MomoClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  const tags = getTagsWithOverrides(ctx.directory, {
    containerTagUser: config.containerTagUser,
    containerTagProject: config.containerTagProject,
  });

  function requireMomo(): MomoClient {
    if (!momo) {
      throw new Error(
        "Momo is not configured. Set MOMO_API_KEY environment variable or create ~/.config/opencode/momo.jsonc",
      );
    }
    return momo;
  }

  function resolveContainerTag(scope?: string): string {
    if (scope === "user") return tags.user;
    return tags.project;
  }

  // ─── Tool Hook ───

  const momoTool = tool({
    description:
      "Interact with Momo long-term memory. Modes: help, add, search, profile, list, forget.",
    args: {
      mode: z
        .enum(["help", "add", "search", "profile", "list", "forget"])
        .describe("The action to perform"),
      content: z
        .string()
        .optional()
        .describe("Content to store (required for 'add' mode)"),
      query: z
        .string()
        .optional()
        .describe("Search query (required for 'search' mode)"),
      scope: z
        .enum(["user", "project"])
        .optional()
        .describe(
          "Memory scope: 'user' (personal) or 'project' (current project). Defaults vary by mode.",
        ),
      memoryType: z
        .enum([
          "fact",
          "preference",
          "episode",
        ])
        .optional()
        .describe("Memory classification (for 'add' mode): fact, preference, or episode"),
      memoryId: z
        .string()
        .optional()
        .describe("Memory ID to forget (required for 'forget' mode)"),
      limit: z
        .number()
        .optional()
        .describe("Max results to return (for 'search' and 'list' modes)"),
    },
    async execute(args, _context) {
      switch (args.mode) {
        case "help":
          return HELP_TEXT;

        case "add": {
          const client = requireMomo();
          if (!args.content) {
            return "Error: 'content' is required for add mode.";
          }
          const cleaned = stripPrivateContent(args.content);
          if (isFullyPrivate(args.content)) {
            return "Error: Content is entirely private (wrapped in <private> tags). Nothing to store.";
          }
          const containerTag = resolveContainerTag(args.scope ?? "project");
          const result = await client.memories.create({
            content: cleaned,
            containerTag,
            memoryType: args.memoryType,
          });
          return `Memory stored successfully (ID: ${result.memoryId}, scope: ${args.scope ?? "project"}).`;
        }

        case "search": {
          const client = requireMomo();
          if (!args.query) {
            return "Error: 'query' is required for search mode.";
          }
          const containerTags = args.scope
            ? [resolveContainerTag(args.scope)]
            : [tags.user, tags.project];
          const results = await client.search.search({
            q: args.query,
            containerTags,
            limit: args.limit ?? 10,
            scope: "hybrid",
          });
          if (!results.results || results.results.length === 0) {
            return "No memories found matching your query.";
          }
          const formatted = results.results
            .map((r, i) => {
              const relevance =
                r.type === "memory" ? r.similarity : r.score;
              const scoreStr = ` (score: ${relevance.toFixed(2)})`;
              return `${i + 1}. ${r.content ?? "(no content)"}${scoreStr}`;
            })
            .join("\n");
          return `Found ${results.results.length} memories:\n\n${formatted}`;
        }

        case "profile": {
          const client = requireMomo();
          const containerTag = resolveContainerTag(args.scope ?? "user");
          const profile = await client.profile.compute({
            containerTag,
            includeDynamic: true,
            generateNarrative: true,
          });
          if (
            !profile.narrative &&
            profile.staticFacts.length === 0
          ) {
            return "No profile data available yet. Add some memories first.";
          }
          const parts: string[] = [];
          if (profile.narrative) {
            parts.push(`**Summary:**\n${profile.narrative}`);
          }
          if (profile.staticFacts.length > 0) {
            parts.push(
              `**Known Facts:**\n${profile.staticFacts.map((f) => `- ${f.content}`).join("\n")}`,
            );
          }
          return parts.join("\n\n");
        }

        case "list": {
          const client = requireMomo();
          const containerTag = resolveContainerTag(args.scope ?? "project");
          const { memories } = await client.memories.list({
            containerTag,
            limit: args.limit ?? 20,
          });
          if (memories.length === 0) {
            return `No memories found for scope '${args.scope ?? "project"}'.`;
          }
          const formatted = memories
            .map((m, i) => {
              const type = m.memoryType ? ` [${m.memoryType}]` : "";
              return `${i + 1}. ${m.content}${type} (${m.memoryId})`;
            })
            .join("\n");
          return `${memories.length} memories (scope: ${args.scope ?? "project"}):\n\n${formatted}`;
        }

        case "forget": {
          const client = requireMomo();
          if (!args.memoryId) {
            return "Error: 'memoryId' is required for forget mode.";
          }
          await client.memories.forgetById(args.memoryId);
          return `Memory ${args.memoryId} has been forgotten.`;
        }

        default:
          return "Unknown mode. Use 'help' to see available commands.";
      }
    },
  });

  // ─── Chat Message Hook ───

  const chatMessageHook = async (
    input: {
      sessionID: string;
      agent?: string;
      model?: { providerID: string; modelID: string };
      messageID?: string;
      variant?: string;
    },
    output: {
      message: import("@opencode-ai/sdk").UserMessage;
      parts: Part[];
    },
  ): Promise<void> => {
    // Only inject once per session
    if (injectedSessions.has(input.sessionID)) return;
    // Must be configured
    if (!momo) return;

    injectedSessions.add(input.sessionID);

    try {
      // Fetch profile and memories in parallel
      const [profile, userMemories, projectMemories] = await Promise.all([
        momo.profile
          .compute({
            containerTag: tags.user,
            includeDynamic: true,
            generateNarrative: true,
          })
          .catch(() => null),
        momo.search
          .search({
            q: "recent context",
            containerTags: [tags.user],
            limit: 5,
            scope: "hybrid",
          })
          .then((r) => r.results ?? [])
          .catch(() => []),
        momo.search
          .search({
            q: "project context",
            containerTags: [tags.project],
            limit: 5,
            scope: "hybrid",
          })
          .then((r) => r.results ?? [])
          .catch(() => []),
      ]);

      const contextText = formatContextForPrompt(
        profile
          ? {
              summary: profile.narrative ?? undefined,
              traits: profile.staticFacts.map((f) => f.content),
            }
          : null,
        userMemories.map((m) => ({
          content: m.content ?? undefined,
        })),
        projectMemories.map((m) => ({
          content: m.content ?? undefined,
        })),
      );

      if (!contextText) return;

      // Prepend a synthetic text part with memory context
      const syntheticPart: Part = {
        id: `momo-context-${input.sessionID}`,
        sessionID: input.sessionID,
        messageID: input.messageID ?? "",
        type: "text" as const,
        text: contextText,
        synthetic: true,
        metadata: { source: "momo-memory" },
      };

      output.parts.unshift(syntheticPart);
    } catch {
      // Silently fail — memory injection is best-effort
    }
  };

  // ─── Event Hook ───

  const eventHook = async (input: {
    event: import("@opencode-ai/sdk").Event;
  }): Promise<void> => {
    if (!momo) return;
    await handleCompactionEvent(input.event, momo, tags.project);
  };

  return {
    tool: {
      momo: momoTool,
    },
    "chat.message": chatMessageHook,
    event: eventHook,
  };
};
