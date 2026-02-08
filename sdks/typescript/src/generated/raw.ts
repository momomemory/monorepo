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
    querySerializer(queryParams) {
      const search: string[] = [];
      for (const name in queryParams) {
        const value = (queryParams as Record<string, any>)[name];
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            search.push(`${encodeURIComponent(name)}[]=${encodeURIComponent(String(item))}`);
          }
        } else {
          search.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
        }
      }
      return search.join("&");
    },
  });
}

export type RawClient = ReturnType<typeof createRawClient>;
