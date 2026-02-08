import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";

type ProfileResponse = components["schemas"]["ProfileResponse"];

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

export class ProfileGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly config: MomoClientConfig,
  ) {}

  async compute(
    body: {
      containerTag: string;
      q?: string;
      threshold?: number;
      limit?: number;
      includeDynamic?: boolean;
      generateNarrative?: boolean;
    },
    opts?: RequestOptions,
  ): Promise<ProfileResponse> {
    const containerTag =
      body.containerTag ?? this.config.defaultContainerTag ?? body.containerTag;
    const { data, error } = await this.raw.POST("/api/v1/profile:compute", {
      body: {
        containerTag,
        q: body.q ?? null,
        threshold: body.threshold ?? null,
        limit: body.limit ?? null,
        includeDynamic: body.includeDynamic ?? null,
        generateNarrative: body.generateNarrative ?? null,
      },
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    return data!;
  }
}
