import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";

type GraphResponse = components["schemas"]["GraphResponse"];

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

export class GraphGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly _config: MomoClientConfig,
  ) {}

  async getMemoryGraph(
    memoryId: string,
    query?: {
      depth?: number;
      maxNodes?: number;
      relationTypes?: string;
    },
    opts?: RequestOptions,
  ): Promise<GraphResponse> {
    const { data, error } = await this.raw.GET(
      "/api/v1/memories/{memoryId}/graph",
      {
        params: {
          path: { memoryId },
          query: {
            depth: query?.depth ?? null,
            maxNodes: query?.maxNodes ?? null,
            relationTypes: query?.relationTypes ?? null,
          },
        },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }

  async getContainerGraph(
    tag: string,
    query?: { maxNodes?: number },
    opts?: RequestOptions,
  ): Promise<GraphResponse> {
    const { data, error } = await this.raw.GET(
      "/api/v1/containers/{tag}/graph",
      {
        params: {
          path: { tag },
          query: {
            maxNodes: query?.maxNodes ?? null,
          },
        },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }
}
