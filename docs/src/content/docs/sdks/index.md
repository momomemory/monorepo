---
title: SDKs
description: Official client libraries for integrating with the Momo API.
---

Momo provides official SDKs for building applications on top of the Momo API.

| Language | Package | Status |
|----------|---------|--------|
| [TypeScript](/sdks/typescript) | `@momomemory/sdk` | Stable |
| [Python](/sdks/python) | `momo-sdk` | Beta |

## Design Philosophy

Both SDKs follow the same design:

- **Handwritten ergonomic client** on top of generated OpenAPI types
- **Grouped API methods** (`documents`, `memories`, `search`, etc.)
- **Automatic auth injection** via Bearer token
- **Response envelope unwrapping** (the `{ data, meta }` envelope is handled internally)
- **Typed errors** via `MomoError` with status code, error code, and message
- **Default container tag** applied automatically to scoped requests
- **Raw client access** for advanced use cases not covered by the high-level API

## Prerequisites

All SDKs require:

1. **A running Momo server** -- See [Self-Hosting](/guides/self-hosting) to set one up
2. **Momo server URL** -- Default is `http://localhost:3000`
3. **API key** -- Only if your server has `MOMO_API_KEYS` configured

## API Groups

Every SDK client exposes these resource groups:

| Group | Description |
|-------|-------------|
| `documents` | Create, upload, list, update, delete documents |
| `memories` | Create, list, update, forget memories |
| `search` | Hybrid search across documents and memories |
| `conversations` | Ingest conversation threads as memories |
| `graph` | Query the memory/document knowledge graph |
| `profile` | Compute container profiles |
| `admin` | Administrative operations (forgetting passes) |
| `health` | Server health checks |

## Next Steps

- [TypeScript SDK](/sdks/typescript)
- [Python SDK](/sdks/python)
- [API Reference](/reference/api)
