import type { components } from "./generated/schema.js";

// Re-export useful schema types for consumer convenience
export type DocumentResponse = components["schemas"]["DocumentResponse"];
export type DocumentSummaryResponse =
  components["schemas"]["DocumentSummaryResponse"];
export type MemoryResponse = components["schemas"]["MemoryResponse"];
export type SearchResponse = components["schemas"]["SearchResponse"];
export type SearchResultItem = components["schemas"]["SearchResultItem"];
export type GraphResponse = components["schemas"]["GraphResponse"];
export type ProfileResponse = components["schemas"]["ProfileResponse"];
export type HealthData = components["schemas"]["HealthData"];
export type CreateDocumentResponse =
  components["schemas"]["CreateDocumentResponse"];
export type BatchCreateDocumentResponse =
  components["schemas"]["BatchCreateDocumentResponse"];
export type ConversationIngestResponse =
  components["schemas"]["ConversationIngestResponse"];
export type ForgetMemoryResponse =
  components["schemas"]["ForgetMemoryResponse"];
export type ForgettingRunResponse =
  components["schemas"]["ForgettingRunResponse"];
export type UpdateMemoryResponse =
  components["schemas"]["UpdateMemoryResponse"];
export type IngestionStatusResponse =
  components["schemas"]["IngestionStatusResponse"];
export type SearchScope = components["schemas"]["SearchScope"];
export type V1MemoryType = components["schemas"]["V1MemoryType"];
export type V1DocumentType = components["schemas"]["V1DocumentType"];

export interface MomoClientConfig {
  /** Base URL of the Momo server (e.g. "http://localhost:3000") */
  baseUrl: string;
  /** Static API key for authentication */
  apiKey?: string;
  /** Dynamic API key getter (takes precedence over apiKey if both provided) */
  getApiKey?: () => string | Promise<string>;
  /** Default container tag applied to methods that accept one */
  defaultContainerTag?: string;
  /** Custom fetch implementation */
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Timeout in milliseconds (creates an AbortSignal internally) */
  timeoutMs?: number;
  /** Additional headers for this request */
  headers?: Record<string, string>;
}

// ============================================================================
// Plugin Configuration Types
// ============================================================================

export type PluginType = "openclaw" | "opencode" | "pi";

export interface MomoPluginConfigBase {
  baseUrl?: string;
  apiKey?: string;
}

export interface OpenClawPluginConfig extends MomoPluginConfigBase {
  containerTag?: string;
  perAgentMemory?: boolean;
  autoRecall?: boolean;
  autoCapture?: boolean;
  maxRecallResults?: number;
  profileFrequency?: number;
  captureMode?: "everything" | "all";
  debug?: boolean;
}

export interface OpenCodePluginConfig extends MomoPluginConfigBase {
  containerTagUser?: string;
  containerTagProject?: string;
}

export interface PiPluginConfig extends MomoPluginConfigBase {
  containerTag?: string;
  autoRecall?: boolean;
  autoCapture?: boolean;
  maxRecallResults?: number;
  profileFrequency?: number;
  debug?: boolean;
}

export interface MomoPluginConfig {
  openclaw?: OpenClawPluginConfig;
  opencode?: OpenCodePluginConfig;
  pi?: PiPluginConfig;
}

export interface ResolvedOpenClawPluginConfig {
  baseUrl: string;
  apiKey?: string;
  containerTag: string;
  perAgentMemory: boolean;
  autoRecall: boolean;
  autoCapture: boolean;
  maxRecallResults: number;
  profileFrequency: number;
  captureMode: "everything" | "all";
  debug: boolean;
}

export interface ResolvedOpenCodePluginConfig {
  baseUrl: string;
  apiKey?: string;
  containerTagUser?: string;
  containerTagProject?: string;
}

export interface ResolvedPiPluginConfig {
  baseUrl: string;
  apiKey?: string;
  containerTag: string;
  autoRecall: boolean;
  autoCapture: boolean;
  maxRecallResults: number;
  profileFrequency: number;
  debug: boolean;
}

export type MomoPluginConfigLoaderOptions = {
  cwd?: string;
  globalConfigDir?: string;
  envPrefix?: string;
};
