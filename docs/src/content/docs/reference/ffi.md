---
title: Embedded C FFI
description: Build, link, and use Momo's embedded C ABI from `momo/ffi`.
---

`momo/ffi` exposes a small C ABI over the embedded `MomoEngine` runtime. This is the embedded integration surface added alongside the server codebase. It is separate from the REST API and MCP.

## Overview

- Build target: `momo-ffi`
- Header: `momo/ffi/include/momo.h`
- Rust implementation: `momo/ffi/src/lib.rs`
- Example client: `momo/ffi/examples/c/main.c`

The FFI returns raw JSON strings from engine methods. It does not use the REST response envelope documented in [API Reference](/reference/api).

## Build

From `momo/`:

```bash
cargo build -p momo-ffi
```

This produces:

- `target/debug/libmomo_ffi.dylib`
- `target/debug/libmomo_ffi.a`
- `ffi/include/momo.h`

The crate is built as both `cdylib` and `staticlib`.

## Minimal C Example

Build the library first:

```bash
cd momo
cargo build -p momo-ffi
```

Then build the example:

```bash
cd ffi/examples/c
cc main.c -I../../include -L../../../target/debug -lmomo_ffi -o momo_ffi_example
```

Run it on macOS with the built library on the loader path:

```bash
DYLD_FALLBACK_LIBRARY_PATH=../../../target/debug ./momo_ffi_example
```

The example creates an engine, stores one memory, searches memories, then frees all returned pointers correctly.

## Engine Lifecycle

Typical call flow:

1. Create an engine with `momo_engine_new`
2. Optionally start workers with `momo_engine_start_workers`
3. Call one or more JSON APIs
4. Free every returned string with `momo_string_free`
5. Stop workers if you started them
6. Free the engine with `momo_engine_free`

## Exported ABI

```c
typedef struct MomoEngine MomoEngine;

void momo_string_free(char *ptr);

MomoEngine *momo_engine_new(const char *config_json, bool rebuild_embeddings, char **error_out);
void momo_engine_free(MomoEngine *engine);

bool momo_engine_start_workers(MomoEngine *engine, char **error_out);
void momo_engine_stop_workers(MomoEngine *engine);

char *momo_engine_create_memory_json(MomoEngine *engine, const char *request_json, char **error_out);
char *momo_engine_search_memories_json(MomoEngine *engine, const char *request_json, char **error_out);
char *momo_engine_search_documents_json(MomoEngine *engine, const char *request_json, char **error_out);
```

## Error Handling and Memory Management

- On success, JSON functions return a heap-allocated `char *`.
- On failure, JSON functions return `NULL` and write an error string to `error_out`.
- `momo_engine_new` returns `NULL` on failure.
- Free both successful responses and error strings with `momo_string_free`.
- Passing a null engine pointer to the JSON functions is treated as an error.

Minimal pattern:

```c
char *error = NULL;
char *response = momo_engine_search_memories_json(engine, request_json, &error);
if (response == NULL) {
    fprintf(stderr, "%s\n", error);
    momo_string_free(error);
    return 1;
}

puts(response);
momo_string_free(response);
```

## Configuration

`momo_engine_new` accepts either explicit config JSON or environment-driven config.

### Environment-driven configuration

Pass `NULL` for `config_json`:

```c
MomoEngine *engine = momo_engine_new(NULL, false, &error);
```

This uses the same `Config::from_env()` behavior as the server. Relevant variables include:

- `DATABASE_URL`
- `EMBEDDING_MODEL`
- `EMBEDDING_DIMENSIONS`
- `EMBEDDING_BATCH_SIZE`
- `EMBEDDING_INGEST_BATCH_SIZE`
- `EMBEDDING_DUAL_MODEL`
- `EMBEDDING_INGEST_BATCH_PAUSE_MS`
- `EMBEDDING_API_KEY`
- `EMBEDDING_BASE_URL`
- `EMBEDDING_TIMEOUT`
- `EMBEDDING_MAX_RETRIES`
- `EMBEDDING_RATE_LIMIT`
- `OCR_MODEL`
- `TRANSCRIPTION_MODEL`
- `TRANSCRIPTION_MODEL_PATH`
- `ENABLE_INFERENCES`

### Explicit config JSON

Pass a serialized Rust `Config` object as JSON if you want the embedding runtime to be configured directly by the host application instead of the process environment.

### `rebuild_embeddings`

The `rebuild_embeddings` argument controls dimension mismatch handling during startup:

- `false`: reject startup when stored vectors do not match the configured embedding dimensions
- `true`: rebuild when dimensions do not match

If you choose rebuild mode, worker-backed processing may matter for how quickly queued re-embedding work is completed.

## Worker Behavior

`momo_engine_start_workers` starts Momo's background workers for the embedded engine. Use this when your host application needs worker-driven behavior such as background processing or re-embedding flows.

`momo_engine_stop_workers` shuts them down cleanly.

For simple synchronous memory creation and search calls, you can create an engine and use the JSON APIs without starting workers.

## JSON APIs

The FFI JSON contracts are engine-level contracts, not REST DTOs. Naming is mostly snake_case, with a few fields preserved from existing search request models such as `rewriteQuery` and `forgottenMemories`.

### Create Memory

Function:

```c
char *momo_engine_create_memory_json(MomoEngine *engine, const char *request_json, char **error_out);
```

Request:

```json
{
  "content": "User prefers dark mode",
  "container_tag": "ffi-example",
  "is_static": false,
  "memory_type": "fact"
}
```

Response:

```json
{
  "id": "V1StGXR8_Z5jdHi6B-myT",
  "memory": "User prefers dark mode",
  "space_id": "default",
  "container_tag": "ffi-example",
  "version": 1,
  "is_latest": true,
  "parent_memory_id": null,
  "root_memory_id": null,
  "memory_relations": {},
  "source_count": 0,
  "is_inference": false,
  "is_forgotten": false,
  "is_static": false,
  "forget_after": null,
  "forget_reason": null,
  "memory_type": "fact",
  "last_accessed": null,
  "confidence": null,
  "metadata": {},
  "created_at": "2026-03-30T00:00:00Z",
  "updated_at": "2026-03-30T00:00:00Z"
}
```

Notes:

- The request uses `content`.
- The returned domain object uses `memory` for the stored text.
- The response is a raw serialized `Memory`, not `{ "data": ... }`.

### Search Memories

Function:

```c
char *momo_engine_search_memories_json(MomoEngine *engine, const char *request_json, char **error_out);
```

Request:

```json
{
  "q": "dark mode",
  "container_tag": "ffi-example",
  "threshold": 0.7,
  "limit": 5,
  "rerank": true,
  "rewriteQuery": true,
  "include": {
    "documents": true,
    "summaries": true,
    "related_memories": true,
    "forgottenMemories": false
  }
}
```

Response shape:

```json
{
  "results": [],
  "total": 0,
  "timing": 12,
  "rewritten_query": "dark mode preferences"
}
```

### Search Documents

Function:

```c
char *momo_engine_search_documents_json(MomoEngine *engine, const char *request_json, char **error_out);
```

Request:

```json
{
  "q": "dark mode",
  "container_tags": ["ffi-example"],
  "limit": 5,
  "rerank": true,
  "rewriteQuery": true
}
```

Response shape:

```json
{
  "results": [],
  "total": 0,
  "timing": 8,
  "rewritten_query": "dark mode preferences"
}
```

## Important Differences From REST

- No HTTP transport
- No Bearer auth layer
- No REST response envelope
- Domain JSON is returned directly
- FFI requests are mostly snake_case
- Some existing request-model fields still use camelCase, such as `rewriteQuery` and `forgottenMemories`

If you need HTTP integration, use the REST endpoints in [API Reference](/reference/api) instead.

## Caveats

- `momo/ffi` is an embedded-engine API, not a direct vector-generation API.
- The included example currently sets `OCR_MODEL=openai/vision`; the documented OCR provider name elsewhere in the project is `openai/gpt-4o`.
- The example also sets `TRANSCRIPTION_MODEL=openai/whisper-1`; if you use cloud OCR or transcription providers, configure the matching API keys as well.
