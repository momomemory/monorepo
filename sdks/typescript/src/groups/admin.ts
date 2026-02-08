import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";

type ForgettingRunResponse = components["schemas"]["ForgettingRunResponse"];

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

export class AdminGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly _config: MomoClientConfig,
  ) {}

  async runForgetting(opts?: RequestOptions): Promise<ForgettingRunResponse> {
    const { data, error } = await this.raw.POST(
      "/api/v1/admin/forgetting:run",
      {
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }
}
