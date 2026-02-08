import type { Middleware } from "openapi-fetch";
import { createRawClient, type RawClient } from "./generated/raw.js";
import type { MomoClientConfig } from "./types.js";
import { MomoError, type ErrorCode } from "./error.js";
import { DocumentsGroup } from "./groups/documents.js";
import { MemoriesGroup } from "./groups/memories.js";
import { SearchGroup } from "./groups/search.js";
import { GraphGroup } from "./groups/graph.js";
import { ConversationsGroup } from "./groups/conversations.js";
import { ProfileGroup } from "./groups/profile.js";
import { AdminGroup } from "./groups/admin.js";
import { HealthGroup } from "./groups/health.js";

function statusToErrorCode(status: number): ErrorCode {
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 501) return "not_implemented";
  return "internal_error";
}

export class MomoClient {
  readonly raw: RawClient;
  readonly documents: DocumentsGroup;
  readonly memories: MemoriesGroup;
  readonly search: SearchGroup;
  readonly graph: GraphGroup;
  readonly conversations: ConversationsGroup;
  readonly profile: ProfileGroup;
  readonly admin: AdminGroup;
  readonly health: HealthGroup;

  constructor(private readonly config: MomoClientConfig) {
    if (!config.baseUrl) {
      throw new Error("MomoClient requires a baseUrl");
    }

    this.raw = createRawClient({
      baseUrl: config.baseUrl,
      fetch: config.fetch,
    });

    const authMiddleware: Middleware = {
      async onRequest({ request }) {
        const apiKey = config.getApiKey
          ? await config.getApiKey()
          : config.apiKey;
        if (apiKey) {
          request.headers.set("Authorization", `Bearer ${apiKey}`);
        }
        return request;
      },
    };

    const envelopeMiddleware: Middleware = {
      async onResponse({ request, response }) {
        if (!response.ok) {
          const cloned = response.clone();
          try {
            const json = await cloned.json();
            if (json.error) {
              throw new MomoError({
                status: response.status,
                code: json.error.code ?? statusToErrorCode(response.status),
                message: json.error.message ?? response.statusText,
                path: new URL(request.url).pathname,
                method: request.method,
              });
            }
          } catch (e) {
            if (e instanceof MomoError) throw e;
          }
          throw new MomoError({
            status: response.status,
            code: statusToErrorCode(response.status),
            message: response.statusText,
            path: new URL(request.url).pathname,
            method: request.method,
          });
        }

        const cloned = response.clone();
        try {
          const json = await cloned.json();
          if (json && typeof json === "object" && "data" in json) {
            return new Response(JSON.stringify(json.data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          }
        } catch {
        }
        return response;
      },
    };

    this.raw.use(authMiddleware, envelopeMiddleware);

    this.documents = new DocumentsGroup(this.raw, config);
    this.memories = new MemoriesGroup(this.raw, config);
    this.search = new SearchGroup(this.raw, config);
    this.graph = new GraphGroup(this.raw, config);
    this.conversations = new ConversationsGroup(this.raw, config);
    this.profile = new ProfileGroup(this.raw, config);
    this.admin = new AdminGroup(this.raw, config);
    this.health = new HealthGroup(this.raw, config);
  }
}
