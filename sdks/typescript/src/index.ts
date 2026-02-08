export const VERSION = "0.0.1";

export { MomoClient } from "./client.js";

export { MomoError, type ErrorCode } from "./error.js";

export type {
  MomoClientConfig,
  RequestOptions,
  DocumentResponse,
  DocumentSummaryResponse,
  MemoryResponse,
  SearchResponse,
  SearchResultItem,
  GraphResponse,
  ProfileResponse,
  HealthData,
  CreateDocumentResponse,
  BatchCreateDocumentResponse,
  ConversationIngestResponse,
  ForgetMemoryResponse,
  ForgettingRunResponse,
  UpdateMemoryResponse,
  IngestionStatusResponse,
  SearchScope,
  V1MemoryType,
  V1DocumentType,
} from "./types.js";

export {
  createRawClient,
  type RawClient,
  type RawClientOptions,
} from "./generated/raw.js";
export type { paths } from "./generated/schema.js";
