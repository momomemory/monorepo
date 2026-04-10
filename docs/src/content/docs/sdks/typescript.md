---
title: TypeScript SDK
description: Install and use the official TypeScript SDK for Momo.
---

Official TypeScript client for [Momo](https://github.com/momomemory/momo). Published as `@momomemory/sdk` on npm.

## Installation

```bash
npm install @momomemory/sdk
# or
bun add @momomemory/sdk
```

Requires Node.js 18+ or Bun. ESM-only.

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

// Search
const results = await momo.search.search({
  q: "When was TypeScript created?",
  limit: 5,
});

// List memories
const { memories } = await momo.memories.list({ limit: 10 });

// Forget a memory
await momo.memories.forgetById("mem-id", { reason: "outdated" });
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `baseUrl` | `string` | Momo server URL |
| `apiKey` | `string` | Static API key for Bearer auth |
| `getApiKey` | `() => string \| Promise<string>` | Dynamic key provider |
| `defaultContainerTag` | `string` | Container tag applied to all scoped requests |
| `fetch` | `typeof fetch` | Custom fetch implementation |

## Error Handling

All API errors are thrown as `MomoError`:

```typescript
import { MomoClient, MomoError } from "@momomemory/sdk";

const momo = new MomoClient({ baseUrl: "http://localhost:3000" });

try {
  await momo.documents.get("nonexistent");
} catch (e) {
  if (e instanceof MomoError) {
    console.error(e.code);    // "not_found" | "unauthorized" | ...
    console.error(e.status);  // 404
    console.error(e.message); // Human-readable message
    console.error(e.path);    // "/api/v1/documents/nonexistent"
    console.error(e.method);  // "GET"
  }
}
```

Error codes: `invalid_request`, `unauthorized`, `not_found`, `conflict`, `internal_error`, `not_implemented`.

## API Reference

### `client.documents`

| Method | Description |
|--------|-------------|
| `create(body)` | Create a text document |
| `batchCreate(body)` | Create multiple documents |
| `upload(file, options?)` | Upload a file |
| `uploadFromPath(path, options?)` | Upload from a file path (Node/Bun) |
| `get(documentId, options?)` | Fetch a document |
| `update(documentId, body, options?)` | Update document metadata |
| `delete(documentId, options?)` | Delete a document |
| `list(params?, options?)` | List documents |
| `getIngestionStatus(ingestionId, options?)` | Poll ingestion status |

### `client.memories`

| Method | Description |
|--------|-------------|
| `create(body, options?)` | Create a memory |
| `get(memoryId, options?)` | Fetch a memory |
| `update(memoryId, body, options?)` | Update a memory |
| `list(params?, options?)` | List memories |
| `forget(body, options?)` | Content-based forget |
| `forgetById(memoryId, body?, options?)` | Forget by ID |

### `client.search`

| Method | Description |
|--------|-------------|
| `search(body, options?)` | Hybrid search across documents and memories |

### `client.conversations`

| Method | Description |
|--------|-------------|
| `ingest(body, options?)` | Ingest a conversation thread |

### `client.graph`

| Method | Description |
|--------|-------------|
| `getMemoryGraph(memoryId, params?, options?)` | Graph for a memory |
| `getContainerGraph(tag, params?, options?)` | Graph for a container |

### `client.profile`

| Method | Description |
|--------|-------------|
| `compute(body, options?)` | Compute a container profile |

### `client.admin`

| Method | Description |
|--------|-------------|
| `runForgetting(options?)` | Trigger a forgetting pass |

### `client.health`

| Method | Description |
|--------|-------------|
| `check(options?)` | Check server health |

## Raw Client

The underlying `openapi-fetch` client is exposed for direct API access:

```typescript
const { data, error } = await momo.raw.GET("/api/v1/health");
```

The raw client shares the same auth and envelope-unwrapping middleware.

## Source

- Package: [@momomemory/sdk](https://www.npmjs.com/package/@momomemory/sdk)
- Repository: [momomemory/sdk-typescript](https://github.com/momomemory/sdk-typescript)
