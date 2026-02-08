import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";

type HealthData = components["schemas"]["HealthData"];

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

export class HealthGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly _config: MomoClientConfig,
  ) {}

  async check(opts?: RequestOptions): Promise<HealthData> {
    const { data, error } = await this.raw.GET("/api/v1/health", {
      signal: buildSignal(opts),
      headers: opts?.headers,
    });
    if (error) throw error;
    return data!;
  }
}
