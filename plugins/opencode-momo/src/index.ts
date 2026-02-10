import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { MomoClient } from "@momomemory/sdk";
import { loadConfig, isConfigured } from "./config";
import { getTagsWithOverrides } from "./services/tags";
import { stripPrivateContent, isFullyPrivate } from "./services/privacy";
import { formatContextForPrompt } from "./services/context";
import { handleCompactionEvent } from "./services/compaction";

const z = tool.schema;
const DEFAULT_INGEST_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 1_500;

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

type IngestInputType = "auto" | "text" | "url" | "file";

function truncate(value: string, max = 600): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function inferInputType(input: string, inputType?: IngestInputType): Exclude<IngestInputType, "auto"> {
  if (inputType && inputType !== "auto") return inputType;
  if (input.startsWith("http://") || input.startsWith("https://")) return "url";
  if (existsSync(input)) return "file";
  return "text";
}

function parseMetadataJson(metadataJson?: string):
  | Record<string, unknown>
  | { error: string } {
  if (!metadataJson) return {};
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "metadataJson must be a JSON object" };
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Invalid metadataJson: ${message}` };
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const MomoPlugin: Plugin = async (ctx: PluginInput) => {
  const config = loadConfig(ctx.directory);
  const configured = isConfigured(ctx.directory);

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
        "Momo is not configured. Set MOMO_API_KEY or configure ~/.config/opencode/momo.jsonc (or project-local .momo.jsonc).",
      );
    }
    return momo;
  }

  function resolveContainerTag(scope?: string): string {
    if (scope === "user") return tags.user;
    return tags.project;
  }

  async function waitForIngestion(
    client: MomoClient,
    ingestionId: string,
    timeoutMs: number,
    pollIntervalMs: number,
  ): Promise<{ status: string; title?: string; documentId?: string }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await client.documents.getIngestionStatus(ingestionId, {
        timeoutMs,
      });
      if (status.status === "completed" || status.status === "failed") {
        return {
          status: status.status,
          title: status.title ?? undefined,
          documentId: status.documentId,
        };
      }
      await delay(pollIntervalMs);
    }

    return { status: "processing" };
  }

  async function formatDocumentResult(
    client: MomoClient,
    documentId: string,
    scope: "user" | "project",
    extractedBy?: string,
  ): Promise<string> {
    try {
      const doc = await client.documents.get(documentId);
      const lines = [
        `Document ready (scope: ${scope}).`,
        `- documentId: ${doc.documentId}`,
        `- docType: ${doc.docType}`,
        `- ingestionStatus: ${doc.ingestionStatus}`,
      ];
      if (extractedBy) lines.push(`- extractor: ${extractedBy}`);
      if (doc.title) lines.push(`- title: ${doc.title}`);
      if (doc.errorMessage) lines.push(`- notes: ${doc.errorMessage}`);
      if (doc.content) lines.push(`- extractedTextPreview: ${truncate(doc.content, 800)}`);
      return lines.join("\n");
    } catch {
      return [
        `Document ready (scope: ${scope}).`,
        `- documentId: ${documentId}`,
        extractedBy ? `- extractor: ${extractedBy}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  async function uploadDocumentFromPath(
    filePath: string,
    params: {
      containerTag: string;
      extractMemories: boolean;
      timeoutMs: number;
      contentType?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ documentId: string; ingestionId: string }> {
    const fs: { readFile(p: string): Promise<{ buffer: ArrayBuffer }> } =
      await (Function("return import('fs/promises')")() as Promise<never>);
    const { buffer } = await fs.readFile(filePath);
    const file = new File([new Blob([new Uint8Array(buffer)])], basename(filePath));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("containerTag", params.containerTag);
    formData.append("extractMemories", String(params.extractMemories));
    if (params.contentType) formData.append("contentType", params.contentType);
    if (params.metadata && Object.keys(params.metadata).length > 0) {
      formData.append("metadata", JSON.stringify(params.metadata));
    }

    const headers: Record<string, string> = {};
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

    const response = await fetch(`${config.baseUrl}/api/v1/documents:upload`, {
      method: "POST",
      body: formData,
      headers,
      signal: AbortSignal.timeout(params.timeoutMs),
    });

    const json = (await response.json()) as {
      data?: { documentId?: string; ingestionId?: string };
      error?: { message?: string };
    };
    if (!response.ok || json.error) {
      const message = json.error?.message ?? `Upload failed with status ${response.status}`;
      throw new Error(message);
    }

    const documentId = json.data?.documentId;
    const ingestionId = json.data?.ingestionId;
    if (!documentId || !ingestionId) {
      throw new Error("Upload response missing documentId/ingestionId");
    }

    return { documentId, ingestionId };
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
            profile.staticFacts.length === 0 &&
            profile.dynamicFacts.length === 0
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
          if (profile.dynamicFacts.length > 0) {
            parts.push(
              `**Recent Signals:**\n${profile.dynamicFacts.map((f) => `- ${f.content}`).join("\n")}`,
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

  const momoIngestTool = tool({
    description:
      "Ingest text, URLs, and files through Momo's document pipeline (RAG + optional memory extraction).",
    args: {
      input: z.string().describe("Text, URL, or local file path to ingest"),
      inputType: z
        .enum(["auto", "text", "url", "file"])
        .optional()
        .describe("How to interpret input (default: auto)"),
      scope: z
        .enum(["user", "project"])
        .optional()
        .describe("Memory/document scope (default: project)"),
      extractMemories: z
        .boolean()
        .optional()
        .describe("Whether to extract memories from ingested content (default: true)"),
      metadataJson: z
        .string()
        .optional()
        .describe("Optional JSON object string attached as metadata"),
      contentType: z
        .string()
        .optional()
        .describe("Optional content type hint (e.g. audio/mpeg, video/webm)"),
      wait: z
        .boolean()
        .optional()
        .describe("Wait for ingestion to finish before returning (default: true)"),
      timeoutMs: z
        .number()
        .optional()
        .describe("Max wait timeout in milliseconds (default: 120000)"),
      pollIntervalMs: z
        .number()
        .optional()
        .describe("Polling interval while waiting (default: 1500)"),
    },
    async execute(args, _context) {
      const client = requireMomo();
      const scope = args.scope ?? "project";
      const containerTag = resolveContainerTag(scope);
      const extractMemories = args.extractMemories ?? true;
      const wait = args.wait ?? true;
      const timeoutMs = args.timeoutMs ?? DEFAULT_INGEST_TIMEOUT_MS;
      const pollIntervalMs = args.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

      const parsedMetadata = parseMetadataJson(args.metadataJson);
      if ("error" in parsedMetadata) return `Error: ${parsedMetadata.error}`;

      const inferred = inferInputType(args.input, args.inputType);

      const ingestResult =
        inferred === "file"
          ? await uploadDocumentFromPath(args.input, {
              containerTag,
              metadata: parsedMetadata,
              extractMemories,
              contentType: args.contentType,
              timeoutMs,
            })
          : await client.documents.create(
              {
                content: args.input,
                containerTag,
                extractMemories,
                contentType: args.contentType,
                metadata: parsedMetadata,
              },
              { timeoutMs },
            );

      const documentId = ingestResult.documentId;
      const ingestionId = ingestResult.ingestionId;
      if (!wait) {
        return [
          `Ingestion queued (scope: ${scope}).`,
          `- inputType: ${inferred}`,
          `- documentId: ${documentId}`,
          `- ingestionId: ${ingestionId}`,
          `- extractMemories: ${extractMemories}`,
        ].join("\n");
      }

      const status = await waitForIngestion(client, ingestionId, timeoutMs, pollIntervalMs);
      if (status.status !== "completed") {
        return [
          `Ingestion status: ${status.status} (scope: ${scope}).`,
          `- inputType: ${inferred}`,
          `- documentId: ${documentId}`,
          `- ingestionId: ${ingestionId}`,
          status.title ? `- title: ${status.title}` : undefined,
        ]
          .filter(Boolean)
          .join("\n");
      }

      return formatDocumentResult(client, documentId, scope);
    },
  });

  const momoOcrTool = tool({
    description:
      "OCR an image file via Momo ingestion, then return extracted text preview and memory extraction status.",
    args: {
      filePath: z.string().describe("Local path to an image file"),
      scope: z
        .enum(["user", "project"])
        .optional()
        .describe("Memory/document scope (default: project)"),
      extractMemories: z
        .boolean()
        .optional()
        .describe("Extract memories from OCR text (default: true)"),
      wait: z
        .boolean()
        .optional()
        .describe("Wait for OCR ingestion to finish (default: true)"),
      timeoutMs: z.number().optional().describe("Max wait timeout in milliseconds"),
      pollIntervalMs: z.number().optional().describe("Polling interval in milliseconds"),
      contentType: z
        .string()
        .optional()
        .describe("Optional content type hint (e.g. image/png)"),
    },
    async execute(args, _context) {
      const client = requireMomo();
      const scope = args.scope ?? "project";
      const containerTag = resolveContainerTag(scope);
      const extractMemories = args.extractMemories ?? true;
      const wait = args.wait ?? true;
      const timeoutMs = args.timeoutMs ?? DEFAULT_INGEST_TIMEOUT_MS;
      const pollIntervalMs = args.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

      const ingest = await uploadDocumentFromPath(args.filePath, {
          containerTag,
          metadata: undefined,
          extractMemories,
          contentType: args.contentType,
          timeoutMs,
        });

      if (!wait) {
        return [
          `OCR ingestion queued (scope: ${scope}).`,
          `- documentId: ${ingest.documentId}`,
          `- ingestionId: ${ingest.ingestionId}`,
          `- extractMemories: ${extractMemories}`,
        ].join("\n");
      }

      const status = await waitForIngestion(client, ingest.ingestionId, timeoutMs, pollIntervalMs);
      if (status.status !== "completed") {
        return [
          `OCR ingestion status: ${status.status} (scope: ${scope}).`,
          `- documentId: ${ingest.documentId}`,
          `- ingestionId: ${ingest.ingestionId}`,
          status.title ? `- title: ${status.title}` : undefined,
        ]
          .filter(Boolean)
          .join("\n");
      }

      return formatDocumentResult(client, ingest.documentId, scope, "ocr");
    },
  });

  const momoTranscribeTool = tool({
    description:
      "Transcribe audio/video files via Momo ingestion, then return transcript preview and memory extraction status.",
    args: {
      filePath: z.string().describe("Local path to an audio or video file"),
      scope: z
        .enum(["user", "project"])
        .optional()
        .describe("Memory/document scope (default: project)"),
      extractMemories: z
        .boolean()
        .optional()
        .describe("Extract memories from transcript (default: true)"),
      wait: z
        .boolean()
        .optional()
        .describe("Wait for transcription ingestion to finish (default: true)"),
      timeoutMs: z.number().optional().describe("Max wait timeout in milliseconds"),
      pollIntervalMs: z.number().optional().describe("Polling interval in milliseconds"),
      contentType: z
        .string()
        .optional()
        .describe("Optional content type hint (e.g. audio/mpeg, video/mp4)"),
    },
    async execute(args, _context) {
      const client = requireMomo();
      const scope = args.scope ?? "project";
      const containerTag = resolveContainerTag(scope);
      const extractMemories = args.extractMemories ?? true;
      const wait = args.wait ?? true;
      const timeoutMs = args.timeoutMs ?? DEFAULT_INGEST_TIMEOUT_MS;
      const pollIntervalMs = args.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

      const ingest = await uploadDocumentFromPath(args.filePath, {
          containerTag,
          metadata: undefined,
          extractMemories,
          contentType: args.contentType,
          timeoutMs,
        });

      if (!wait) {
        return [
          `Transcription queued (scope: ${scope}).`,
          `- documentId: ${ingest.documentId}`,
          `- ingestionId: ${ingest.ingestionId}`,
          `- extractMemories: ${extractMemories}`,
        ].join("\n");
      }

      const status = await waitForIngestion(client, ingest.ingestionId, timeoutMs, pollIntervalMs);
      if (status.status !== "completed") {
        return [
          `Transcription status: ${status.status} (scope: ${scope}).`,
          `- documentId: ${ingest.documentId}`,
          `- ingestionId: ${ingest.ingestionId}`,
          status.title ? `- title: ${status.title}` : undefined,
        ]
          .filter(Boolean)
          .join("\n");
      }

      return formatDocumentResult(client, ingest.documentId, scope, "transcription");
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
      momo_ingest: momoIngestTool,
      momo_ocr: momoOcrTool,
      momo_transcribe: momoTranscribeTool,
    },
    "chat.message": chatMessageHook,
    event: eventHook,
  };
};
