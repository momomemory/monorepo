import { MomoClient, type V1MemoryType } from "@momomemory/sdk";
import { log } from "./logger";

export type SearchResult = {
  id: string;
  content: string;
  similarity?: number;
  updatedAt?: string;
};

export type ProfileSearchResult = {
  memory?: string;
  updatedAt?: string;
  similarity?: number;
};

export type ProfileResult = {
  narrative?: string;
  static: string[];
  dynamic: string[];
  searchResults: ProfileSearchResult[];
};

type AddMemoryInput = {
  content: string;
  memoryType: V1MemoryType;
  metadata?: Record<string, string | number | boolean>;
  customId?: string;
};

type ConversationRole = "user" | "assistant";

function limitText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export class MomoOpenClawClient {
  private readonly client: MomoClient;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly containerTag: string,
  ) {
    this.client = new MomoClient({
      baseUrl,
      apiKey,
      defaultContainerTag: containerTag,
    });

    log.info(`connected to ${baseUrl} (container: ${containerTag})`);
  }

  async addMemory(input: AddMemoryInput): Promise<{ id: string }> {
    const { content, memoryType, metadata, customId } = input;
    const payloadMetadata: Record<string, unknown> = {
      ...(metadata ?? {}),
    };
    if (customId) {
      payloadMetadata.customId = customId;
    }

    log.debugRequest("memories.create", {
      memoryType,
      contentLength: content.length,
      customId,
      metadata: payloadMetadata,
    });

    const result = await this.client.memories.create({
      content,
      containerTag: this.containerTag,
      memoryType,
      metadata: payloadMetadata,
    });

    log.debugResponse("memories.create", { memoryId: result.memoryId });
    return { id: result.memoryId };
  }

  async ingestConversation(
    messages: Array<{ role: ConversationRole; content: string }>,
    sessionId?: string,
    memoryType: V1MemoryType = "episode",
  ): Promise<void> {
    log.debugRequest("conversations.ingest", {
      messageCount: messages.length,
      sessionId,
      memoryType,
    });

    await this.client.conversations.ingest({
      messages,
      containerTag: this.containerTag,
      sessionId,
      memoryType,
    });

    log.debugResponse("conversations.ingest", { ok: true });
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    log.debugRequest("search.search", {
      query,
      limit,
      containerTag: this.containerTag,
    });

    const response = await this.client.search.search({
      q: query,
      containerTags: [this.containerTag],
      limit,
      scope: "hybrid",
    });

    const results: SearchResult[] = (response.results ?? [])
      .map((row) => {
        const data = row as Record<string, unknown>;
        const id =
          asString(data.memoryId) ??
          asString(data.documentId) ??
          asString(data.id) ??
          "unknown";
        const content =
          asString(data.content) ?? asString(data.memory) ?? asString(data.chunk) ?? "";
        const similarity = asNumber(data.similarity) ?? asNumber(data.score);
        const updatedAt = asString(data.updatedAt);

        return {
          id,
          content,
          similarity,
          updatedAt,
        };
      })
      .filter((item) => item.content.length > 0);

    log.debugResponse("search.search", { count: results.length });
    return results;
  }

  async getProfile(query?: string): Promise<ProfileResult> {
    log.debugRequest("profile.compute", {
      query,
      containerTag: this.containerTag,
    });

    const [profile, searchResults] = await Promise.all([
      this.client.profile.compute({
        containerTag: this.containerTag,
        q: query,
        includeDynamic: true,
        generateNarrative: true,
      }),
      query ? this.search(query, 20) : Promise.resolve([]),
    ]);

    const result: ProfileResult = {
      narrative: profile.narrative ?? undefined,
      static: profile.staticFacts.map((fact) => fact.content),
      dynamic: profile.dynamicFacts.map((fact) => fact.content),
      searchResults: searchResults.map((item) => ({
        memory: item.content,
        updatedAt: item.updatedAt,
        similarity: item.similarity,
      })),
    };

    log.debugResponse("profile.compute", {
      staticCount: result.static.length,
      dynamicCount: result.dynamic.length,
      searchCount: result.searchResults.length,
    });

    return result;
  }

  async deleteMemory(id: string): Promise<{ id: string; forgotten: boolean }> {
    log.debugRequest("memories.forgetById", { id, containerTag: this.containerTag });
    const result = await this.client.memories.forgetById(id, {});
    log.debugResponse("memories.forgetById", result);
    return { id: result.memoryId, forgotten: result.forgotten };
  }

  async forgetByQuery(
    query: string,
  ): Promise<{ success: boolean; message: string }> {
    const results = await this.search(query, 5);
    if (results.length === 0) {
      return { success: false, message: "No matching memory found to forget." };
    }

    const target = results[0];
    await this.deleteMemory(target.id);

    const preview = limitText(target.content, 100);
    return { success: true, message: `Forgot: \"${preview}\"` };
  }

  async wipeAllMemories(): Promise<{ deletedCount: number }> {
    log.debugRequest("memories.list", {
      containerTag: this.containerTag,
      mode: "wipe",
    });

    const memoryIds: string[] = [];
    let cursor: string | undefined;

    do {
      const { memories, meta } = await this.client.memories.list({
        containerTag: this.containerTag,
        limit: 100,
        cursor,
      });

      for (const memory of memories) {
        if (memory.memoryId) memoryIds.push(memory.memoryId);
      }

      cursor = meta?.nextCursor ?? undefined;
    } while (cursor);

    if (memoryIds.length === 0) {
      return { deletedCount: 0 };
    }

    let deletedCount = 0;
    for (let i = 0; i < memoryIds.length; i += 20) {
      const batch = memoryIds.slice(i, i + 20);
      const settled = await Promise.allSettled(
        batch.map((id) => this.client.memories.forgetById(id, {})),
      );
      for (const result of settled) {
        if (result.status === "fulfilled" && result.value.forgotten) {
          deletedCount += 1;
        }
      }
    }

    log.debugResponse("memories.wipe", { deletedCount });
    return { deletedCount };
  }

  getContainerTag(): string {
    return this.containerTag;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }
}
