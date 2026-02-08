# @momomemory/sdk

TypeScript SDK for [Momo](https://github.com/momomemory/momo) — the self-hostable AI memory system.

## Installation

```bash
npm install @momomemory/sdk
# or
bun add @momomemory/sdk
```

## Quick Start

```typescript
import { MomoClient } from "@momomemory/sdk";

const momo = new MomoClient({
  baseUrl: "http://localhost:3000",
  apiKey: "your-api-key",
  defaultContainerTag: "my-app",
});

// Create a document
const doc = await momo.documents.create({
  content: "TypeScript was released in 2012 by Microsoft.",
});

// Search memories
const results = await momo.search.search({
  q: "When was TypeScript created?",
  limit: 5,
});

// Get a specific document
const fetched = await momo.documents.get(doc.id);

// List memories
const { memories } = await momo.memories.list({ limit: 10 });

// Forget a memory
await momo.memories.forgetById("mem-id", { reason: "outdated" });
```

## Error Handling

All API errors are thrown as `MomoError` with typed `status`, `code`, and `message` fields:

```typescript
import { MomoClient, MomoError } from "@momomemory/sdk";

const momo = new MomoClient({ baseUrl: "http://localhost:3000" });

try {
  await momo.documents.get("nonexistent");
} catch (e) {
  if (e instanceof MomoError) {
    console.error(e.code);    // "not_found" | "unauthorized" | "invalid_request" | ...
    console.error(e.status);  // 404
    console.error(e.message); // Human-readable message
    console.error(e.path);    // "/api/v1/documents/nonexistent"
    console.error(e.method);  // "GET"
  }
}
```

## Advanced: Raw Client

Every `MomoClient` instance exposes `client.raw` — a fully-typed `openapi-fetch` client for direct API access:

```typescript
const momo = new MomoClient({
  baseUrl: "http://localhost:3000",
  apiKey: "key",
});

// Use openapi-fetch methods directly
const { data, error } = await momo.raw.GET("/api/v1/health");

// POST with typed body
const { data: doc } = await momo.raw.POST("/api/v1/documents", {
  body: {
    content: "raw access",
    containerTag: null,
    contentType: null,
    customId: null,
    extractMemories: null,
    metadata: {},
  },
});
```

The raw client shares the same auth and envelope-unwrapping middleware as the high-level groups.

## API Reference

Full API documentation: https://github.com/momomemory/momo/blob/main/docs/api.md
