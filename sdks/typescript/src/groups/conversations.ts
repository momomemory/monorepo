import type { RawClient } from "../generated/raw.js";
import type { MomoClientConfig, RequestOptions } from "../types.js";
import type { components } from "../generated/schema.js";

type ConversationIngestResponse =
  components["schemas"]["ConversationIngestResponse"];
type ConversationMessageDto = components["schemas"]["ConversationMessageDto"];
type V1MemoryType = components["schemas"]["V1MemoryType"];

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

export class ConversationsGroup {
  constructor(
    private readonly raw: RawClient,
    private readonly config: MomoClientConfig,
  ) {}

  async ingest(
    body: {
      messages: ConversationMessageDto[];
      containerTag: string;
      sessionId?: string;
      memoryType?: V1MemoryType;
    },
    opts?: RequestOptions,
  ): Promise<ConversationIngestResponse> {
    const containerTag =
      body.containerTag ?? this.config.defaultContainerTag ?? body.containerTag;
    const { data, error } = await this.raw.POST(
      "/api/v1/conversations:ingest",
      {
        body: {
          messages: body.messages,
          containerTag,
          sessionId: body.sessionId ?? undefined,
          memoryType: body.memoryType ?? undefined,
        },
        signal: buildSignal(opts),
        headers: opts?.headers,
      },
    );
    if (error) throw error;
    return data!;
  }
}
