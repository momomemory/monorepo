import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";
import { MomoError } from "../error.js";

type CreateDocumentResponse = components["schemas"]["CreateDocumentResponse"];
type BatchCreateDocumentResponse =
  components["schemas"]["BatchCreateDocumentResponse"];
type DocumentResponse = components["schemas"]["DocumentResponse"];
type DocumentSummaryResponse =
  components["schemas"]["DocumentSummaryResponse"];
type IngestionStatusResponse =
  components["schemas"]["IngestionStatusResponse"];
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

export class DocumentsGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly config: MomoClientConfig,
  ) {}

  async create(
    body: {
      content: string;
      containerTag?: string;
      contentType?: string;
      customId?: string;
      extractMemories?: boolean;
      metadata?: Record<string, unknown>;
    },
    opts?: RequestOptions,
  ): Promise<CreateDocumentResponse> {
    const containerTag =
      body.containerTag ?? this.config.defaultContainerTag ?? undefined;
    const { data, error } = await this.raw.POST("/api/v1/documents", {
        body: {
          content: body.content,
          containerTag: containerTag ?? undefined,
          contentType: body.contentType ?? undefined,
          customId: body.customId ?? undefined,
          extractMemories: body.extractMemories ?? undefined,
          metadata: (body.metadata ?? {}) as Record<string, never>,
        },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    return data!;
  }

  async batchCreate(
    body: {
      documents: components["schemas"]["BatchDocumentItem"][];
      containerTag?: string;
      metadata?: Record<string, unknown>;
    },
    opts?: RequestOptions,
  ): Promise<BatchCreateDocumentResponse> {
    const containerTag =
      body.containerTag ?? this.config.defaultContainerTag ?? undefined;
    const { data, error } = await this.raw.POST("/api/v1/documents:batch", {
        body: {
          documents: body.documents,
          containerTag: containerTag ?? undefined,
          metadata: (body.metadata ?? {}) as Record<string, never>,
        },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    return data!;
  }

  async upload(
    file: Blob | File,
    body?: { containerTag?: string; metadata?: string },
    opts?: RequestOptions,
  ): Promise<CreateDocumentResponse> {
    const containerTag =
      body?.containerTag ?? this.config.defaultContainerTag ?? undefined;

    const formData = new FormData();
    formData.append("file", file);
    if (containerTag) formData.append("containerTag", containerTag);
    if (body?.metadata) formData.append("metadata", body.metadata);

    const headers: Record<string, string> = { ...(opts?.headers ?? {}) };
    const apiKey = this.config.getApiKey
      ? await this.config.getApiKey()
      : this.config.apiKey;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const fetchFn = this.config.fetch ?? globalThis.fetch;
    const url = `${this.config.baseUrl}/api/v1/documents:upload`;
    const response = await fetchFn(url, {
      method: "POST",
      body: formData,
      headers,
      signal: buildSignal(opts),
    });

    const json = await response.json();
    if (!response.ok || json.error) {
      throw new MomoError({
        status: response.status,
        code: json.error?.code ?? "internal_error",
        message: json.error?.message ?? response.statusText,
        path: "/api/v1/documents:upload",
        method: "POST",
      });
    }
    return json.data ?? json;
  }

  async uploadFromPath(
    filePath: string,
    body?: { containerTag?: string; metadata?: string },
    opts?: RequestOptions,
  ): Promise<CreateDocumentResponse> {
    const fs: { readFile(p: string): Promise<{ buffer: ArrayBuffer }> } =
      await (Function("return import('fs/promises')")() as Promise<never>);
    const pathMod: { basename(p: string): string } =
      await (Function("return import('path')")() as Promise<never>);
    const { buffer } = await fs.readFile(filePath);
    const blob = new Blob([new Uint8Array(buffer)]);
    const file = new File([blob], pathMod.basename(filePath));
    return this.upload(file, body, opts);
  }

  async get(
    documentId: string,
    opts?: RequestOptions,
  ): Promise<DocumentResponse> {
    const { data, error } = await this.raw.GET(
      "/api/v1/documents/{documentId}",
      {
        params: { path: { documentId } },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }

  async update(
    documentId: string,
    body: {
      title?: string;
      containerTags?: string[];
      metadata?: Record<string, unknown>;
    },
    opts?: RequestOptions,
  ): Promise<DocumentResponse> {
    const { data, error } = await this.raw.PATCH(
      "/api/v1/documents/{documentId}",
      {
        params: { path: { documentId } },
        body: {
          title: body.title ?? undefined,
          containerTags: body.containerTags ?? undefined,
          metadata: (body.metadata ?? {}) as Record<string, never>,
        },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }

  async delete(documentId: string, opts?: RequestOptions): Promise<void> {
    const { error } = await this.raw.DELETE(
      "/api/v1/documents/{documentId}",
      {
        params: { path: { documentId } },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
  }

  async list(
    query?: {
      containerTags?: string[];
      limit?: number;
      cursor?: string;
    },
    opts?: RequestOptions,
  ): Promise<{
    documents: DocumentSummaryResponse[];
    meta?: ResponseMeta;
  }> {
    const { data, error } = await this.raw.GET("/api/v1/documents", {
      params: {
        query: {
          containerTags: query?.containerTags ?? undefined,
          limit: query?.limit ?? undefined,
          cursor: query?.cursor ?? undefined,
        },
      },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    const result = data as unknown as {
      documents: DocumentSummaryResponse[];
      meta?: ResponseMeta;
    };
    return result;
  }

  async getIngestionStatus(
    ingestionId: string,
    opts?: RequestOptions,
  ): Promise<IngestionStatusResponse> {
    const { data, error } = await this.raw.GET(
      "/api/v1/ingestions/{ingestionId}",
      {
        params: { path: { ingestionId } },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }
}
