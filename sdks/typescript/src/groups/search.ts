import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";

type SearchResponse = components["schemas"]["SearchResponse"];
type SearchScope = components["schemas"]["SearchScope"];

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

export class SearchGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly config: MomoClientConfig,
  ) {}

  async search(
    body: {
      q: string;
      containerTags?: string[];
      limit?: number;
      threshold?: number;
      scope?: SearchScope;
      rerank?: boolean;
      include?: { documents?: boolean; chunks?: boolean };
    },
    opts?: RequestOptions,
  ): Promise<SearchResponse> {
    const containerTags =
      body.containerTags ??
      (this.config.defaultContainerTag
        ? [this.config.defaultContainerTag]
        : undefined);
    const { data, error } = await this.raw.POST("/api/v1/search", {
      body: {
        q: body.q,
        containerTags: containerTags ?? null,
        limit: body.limit ?? null,
        threshold: body.threshold ?? null,
        scope: body.scope,
        rerank: body.rerank ?? null,
        include: body.include,
      },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    return data!;
  }
}
