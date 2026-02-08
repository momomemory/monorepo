import createClient from "openapi-fetch";
import type { paths } from "./schema.js";

export type { paths };

export interface RawClientOptions {
  baseUrl: string;
  headers?: HeadersInit;
  fetch?: typeof globalThis.fetch;
}

export function createRawClient(options: RawClientOptions) {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    headers: options.headers,
    fetch: options.fetch,
  });
}

export type RawClient = ReturnType<typeof createRawClient>;
