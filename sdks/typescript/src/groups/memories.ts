import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";

type MemoryResponse = components["schemas"]["MemoryResponse"];
type UpdateMemoryResponse = components["schemas"]["UpdateMemoryResponse"];
type ForgetMemoryResponse = components["schemas"]["ForgetMemoryResponse"];
type V1MemoryType = components["schemas"]["V1MemoryType"];
type ResponseMeta = components["schemas"]["ResponseMeta"];

function buildSignal(opts?: RequestOptions): AbortSignal | undefined {
  if (!opts) return undefined;
  const signals: AbortSignal[] = [];
  if (opts.signal) signals.push(opts.signal);
  if (opts.timeoutMs !== undefined)
    signals.push(AbortSignal.timeout(opts.timeoutMs));
  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];
  return AbortSignal.any(signals);
}

export class MemoriesGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly config: MomoClientConfig,
  ) {}

  async create(
    body: {
      content: string;
      containerTag: string;
      memoryType?: V1MemoryType;
      metadata?: Record<string, unknown>;
    },
    opts?: RequestOptions,
  ): Promise<MemoryResponse> {
    const containerTag =
      body.containerTag ?? this.config.defaultContainerTag ?? body.containerTag;
    const { data, error } = await this.raw.POST("/api/v1/memories", {
      body: {
        content: body.content,
        containerTag,
        memoryType: body.memoryType ?? null,
        metadata: (body.metadata ?? {}) as Record<string, never>,
      },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    return data!;
  }

  async get(
    memoryId: string,
    opts?: RequestOptions,
  ): Promise<MemoryResponse> {
    const { data, error } = await this.raw.GET(
      "/api/v1/memories/{memoryId}",
      {
        params: { path: { memoryId } },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }

  async update(
    memoryId: string,
    body: {
      content: string;
      isStatic?: boolean;
      metadata?: Record<string, unknown>;
    },
    opts?: RequestOptions,
  ): Promise<UpdateMemoryResponse> {
    const { data, error } = await this.raw.PATCH(
      "/api/v1/memories/{memoryId}",
      {
        params: { path: { memoryId } },
        body: {
          content: body.content,
          isStatic: body.isStatic ?? null,
          metadata: (body.metadata ?? {}) as Record<string, never>,
        },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }

  async list(
    query?: {
      containerTag?: string;
      limit?: number;
      cursor?: string;
    },
    opts?: RequestOptions,
  ): Promise<{
    memories: MemoryResponse[];
    meta?: ResponseMeta;
  }> {
    const containerTag =
      query?.containerTag ?? this.config.defaultContainerTag ?? undefined;
    const { data, error } = await this.raw.GET("/api/v1/memories", {
      params: {
        query: {
          containerTag: containerTag ?? null,
          limit: query?.limit ?? null,
          cursor: query?.cursor ?? null,
        },
      },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    const result = data as unknown as {
      memories: MemoryResponse[];
      meta?: ResponseMeta;
    };
    return result;
  }

  async forget(
    body: {
      content: string;
      containerTag: string;
      reason?: string;
    },
    opts?: RequestOptions,
  ): Promise<ForgetMemoryResponse> {
    const containerTag =
      body.containerTag ?? this.config.defaultContainerTag ?? body.containerTag;
    const { data, error } = await this.raw.POST("/api/v1/memories:forget", {
      body: {
        content: body.content,
        containerTag,
        reason: body.reason ?? null,
      },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    return data!;
  }

  async forgetById(
    memoryId: string,
    body?: { reason?: string },
    opts?: RequestOptions,
  ): Promise<ForgetMemoryResponse> {
    const { data, error } = await this.raw.DELETE(
      "/api/v1/memories/{memoryId}",
      {
        params: { path: { memoryId } },
        body: {
          reason: body?.reason ?? null,
        },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }
}
