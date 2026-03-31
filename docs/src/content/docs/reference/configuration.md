---
title: Configuration Reference
description: Complete environment variable reference for Momo.
---

Momo is configured entirely via environment variables. This page lists all available options organized by functional area.

The embedded C FFI under `momo/ffi` uses the same configuration model when `momo_engine_new` is called with `config_json = NULL`.

## Quick Start

```bash
# Minimal configuration
MOMO_API_KEYS=your-secret-key ./momo

# With external LLM for AI features
MOMO_API_KEYS=your-secret-key \
  LLM_MODEL=openai/gpt-4o-mini \
  LLM_API_KEY=sk-... \
  ./momo
```

---

## Server

| Variable | Description | Default |
|----------|-------------|---------|
| `MOMO_HOST` | Bind address | `0.0.0.0` |
| `MOMO_PORT` | Listen port | `3000` |
| `MOMO_API_KEYS` | Comma-separated API keys for authentication | *(empty)* |
| `MOMO_RUNTIME_MODE` | Runtime mode: `all`, `api`, or `worker` | `all` |
| `MOMO_SINGLE_PROCESS` | When `mode=all`, run API+workers in one process | `false` |

**Authentication behavior:**
- If `MOMO_API_KEYS` is empty/unset, protected routes return `401 Unauthorized`
- Public routes (`/api/v1/health`, `/api/v1/openapi.json`, `/api/v1/docs`) remain accessible
- Multiple keys can be provided for rotation: `key1,key2,key3`

---

## MCP (Built-in)

| Variable | Description | Default |
|----------|-------------|---------|
| `MOMO_MCP_ENABLED` | Enable the built-in MCP server | `true` |
| `MOMO_MCP_PATH` | Path for streamable HTTP MCP endpoint | `/mcp` |
| `MOMO_MCP_REQUIRE_AUTH` | Require Bearer auth for MCP requests | `true` |
| `MOMO_MCP_DEFAULT_CONTAINER_TAG` | Fallback container tag when none provided | `default` |
| `MOMO_MCP_PROJECT_HEADER` | Header for project scoping | `x-sm-project` |
| `MOMO_MCP_PUBLIC_URL` | Public base URL for OAuth discovery | *(none)* |
| `MOMO_MCP_AUTHORIZATION_SERVER` | OAuth issuer URL for discovery | *(none)* |

---

## Database

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite/LibSQL path or Turso URL | `file:momo.db` |
| `DATABASE_AUTH_TOKEN` | Auth token for Turso cloud DB | *(none)* |
| `DATABASE_LOCAL_PATH` | Local replica path for remote DB | *(none)* |
| `DATABASE_READ_URL` | Dedicated read replica URL | *(none)* |
| `DATABASE_READ_AUTH_TOKEN` | Auth token for read replica | *(none)* |
| `DATABASE_READ_LOCAL_PATH` | Local path for read replica | *(none)* |
| `DATABASE_READ_SYNC_INTERVAL_SECS` | Sync interval for read replica | `2` |
| `DATABASE_BUSY_TIMEOUT_MS` | Wait time when DB is locked | `5000` |
| `DATABASE_INIT_RETRY_ATTEMPTS` | Schema init retries | `8` |
| `DATABASE_INIT_RETRY_DELAY_MS` | Delay between init retries | `100` |
| `DATABASE_JOURNAL_MODE` | SQLite journal mode | `WAL` |
| `DATABASE_SYNCHRONOUS` | SQLite synchronous setting | `NORMAL` |
| `DATABASE_WRITE_BATCH_SIZE` | Chunk rows per transaction | `128` |
| `DATABASE_WRITE_BATCH_PAUSE_MS` | Pause between batches | `0` |

---

## Embeddings

### Local (FastEmbed)

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_MODEL` | Model name | `BAAI/bge-small-en-v1.5` |
| `EMBEDDING_DIMENSIONS` | Vector dimensions | `384` |
| `EMBEDDING_BATCH_SIZE` | Batch size for queries | `256` |
| `EMBEDDING_INGEST_BATCH_SIZE` | Batch size for ingestion | `32` |
| `EMBEDDING_DUAL_MODEL` | Use separate instances for query/ingest | `true` |
| `EMBEDDING_INGEST_BATCH_PAUSE_MS` | Pause between ingest batches | `0` |

### External API

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_MODEL` | Use `provider/model` format | *(none)* |
| `EMBEDDING_API_KEY` | API key for the provider | *(none)* |
| `EMBEDDING_BASE_URL` | Custom base URL | *(none)* |
| `EMBEDDING_TIMEOUT` | Request timeout (seconds) | `30` |
| `EMBEDDING_MAX_RETRIES` | Max retry attempts | `3` |
| `EMBEDDING_RATE_LIMIT` | Requests per second | *(none)* |

**Supported providers:** `openai`, `openrouter`, `ollama`, `lmstudio`, `deepseek`

---

## Processing

| Variable | Description | Default |
|----------|-------------|---------|
| `CHUNK_SIZE` | Chunk size in tokens | `512` |
| `CHUNK_OVERLAP` | Overlap between chunks | `50` |
| `PROCESSING_POLL_INTERVAL_SECS` | Worker polling interval | `10` |

**Note:** File uploads are limited to 25MB (hardcoded). Use the documents API for larger content.

---

## OCR (Image Text Extraction)

| Variable | Description | Default |
|----------|-------------|---------|
| `OCR_MODEL` | OCR provider | `local/tesseract` |
| `OCR_API_KEY` | API key for cloud providers | *(none)* |
| `OCR_BASE_URL` | Custom base URL | *(none)* |
| `OCR_LANGUAGES` | Comma-separated language codes | `eng` |
| `OCR_TIMEOUT` | Timeout in seconds | `60` |
| `OCR_MAX_DIMENSION` | Max image dimension (pixels) | `4096` |
| `OCR_MIN_DIMENSION` | Min image dimension (pixels) | `50` |

**Supported providers:** `local/tesseract`, `mistral/pixtral-12b`, `deepseek/deepseek-vl`, `openai/gpt-4o`

---

## Transcription (Audio/Video)

| Variable | Description | Default |
|----------|-------------|---------|
| `TRANSCRIPTION_MODEL` | Model | `local/whisper-small` |
| `TRANSCRIPTION_API_KEY` | API key for cloud providers | *(none)* |
| `TRANSCRIPTION_BASE_URL` | Custom base URL | *(none)* |
| `TRANSCRIPTION_MODEL_PATH` | Path to local whisper model | *(none)* |
| `TRANSCRIPTION_TIMEOUT` | Timeout in seconds | `300` (5min) |
| `TRANSCRIPTION_MAX_FILE_SIZE` | Max file size in bytes | `104857600` (100MB) |
| `TRANSCRIPTION_MAX_DURATION` | Max duration in seconds | `7200` (2h) |

**Supported providers:** `local/whisper-small`, `openai/whisper-1`

---

## LLM (AI Features)

LLM is optional. Without it, core search/storage work but advanced features are disabled.

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_MODEL` | Model (format: `provider/model`) | *(none)* |
| `LLM_API_KEY` | API key | *(none)* |
| `LLM_BASE_URL` | Custom base URL | *(none)* |
| `LLM_TIMEOUT` | Timeout in seconds | `30` |
| `LLM_MAX_RETRIES` | Max retry attempts | `3` |
| `ENABLE_QUERY_REWRITE` | Enable query expansion | `false` |
| `QUERY_REWRITE_CACHE_SIZE` | Cache size for rewrites | `1000` |
| `QUERY_REWRITE_TIMEOUT_SECS` | Rewrite timeout | `2` |
| `ENABLE_AUTO_RELATIONS` | Auto-detect relationships | `true` |
| `ENABLE_CONTRADICTION_DETECTION` | Enable contradiction logic | `false` |
| `DEFAULT_FILTER_PROMPT` | Custom LLM filter prompt | *(none)* |

**Supported providers:** `openai`, `openrouter`, `ollama`, `lmstudio`

---

## Reranking

Reranking is disabled by default.

| Variable | Description | Default |
|----------|-------------|---------|
| `RERANK_ENABLED` | Enable reranking | `false` |
| `RERANK_MODEL` | Reranker model | `bge-reranker-base` |
| `RERANK_CACHE_DIR` | Model cache directory | `.fastembed_cache` |
| `RERANK_BATCH_SIZE` | Batch size | `64` |
| `RERANK_DOMAIN_MODELS` | Domain-specific models (format: `domain:model,domain2:model2`) | *(none)* |

---

## Memory & Decay

| Variable | Description | Default |
|----------|-------------|---------|
| `EPISODE_DECAY_DAYS` | Half-life for episode decay | `30.0` |
| `EPISODE_DECAY_FACTOR` | Decay multiplier per period | `0.9` |
| `EPISODE_DECAY_THRESHOLD` | Forgetting candidate threshold | `0.3` |
| `EPISODE_FORGET_GRACE_DAYS` | Grace period before permanent forget | `7` |
| `FORGETTING_CHECK_INTERVAL` | Check interval in seconds | `3600` (1h) |
| `PROFILE_REFRESH_INTERVAL_SECS` | Profile refresh interval | `86400` (24h) |

### Inference Engine (Background)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_INFERENCES` | Enable background inference | `false` |
| `INFERENCE_INTERVAL_SECS` | Run interval | `86400` (24h) |
| `INFERENCE_CONFIDENCE_THRESHOLD` | Min confidence for inferred memories | `0.7` |
| `INFERENCE_MAX_PER_RUN` | Max inferences per cycle | `50` |
| `INFERENCE_CANDIDATE_COUNT` | Candidates per seed | `5` |
| `INFERENCE_SEED_LIMIT` | Max seed memories | `50` |
| `INFERENCE_EXCLUDE_EPISODES` | Exclude episodes from seeds | `true` |

---

## Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level filter | `momo=info,tower_http=debug` |

Common patterns:
- `RUST_LOG=momo=debug` — Debug logging
- `RUST_LOG=momo=trace` — Trace logging (verbose)
- `RUST_LOG=error` — Errors only

---

## Provider Format

Momo uses a `provider/model` format for external services:

```
openai/gpt-4o-mini
openrouter/anthropic/claude-3-5-sonnet
ollama/llama3.2
lmstudio/bge-small-en-v1.5
```

If no provider prefix is given, defaults to `local` (embedded models via FastEmbed/Whisper/Tesseract).

---

## Example: Full Configuration

```bash
# Server
export MOMO_HOST=0.0.0.0
export MOMO_PORT=3000
export MOMO_API_KEYS=prod-key-1,prod-key-2

# Database (Turso)
export DATABASE_URL=libsql://my-db.turso.io
export DATABASE_AUTH_TOKEN=my-token

# Embeddings (OpenAI)
export EMBEDDING_MODEL=openai/text-embedding-3-small
export EMBEDDING_API_KEY=sk-...

# LLM (OpenRouter)
export LLM_MODEL=openrouter/anthropic/claude-3-5-sonnet
export LLM_API_KEY=sk-or-...
export ENABLE_CONTRADICTION_DETECTION=true
export ENABLE_QUERY_REWRITE=true

# OCR (Tesseract local)
export OCR_MODEL=local/tesseract
export OCR_LANGUAGES=eng,deu

# Transcription (OpenAI)
export TRANSCRIPTION_MODEL=openai/whisper-1
export TRANSCRIPTION_API_KEY=sk-...

# Reranking
export RERANK_ENABLED=true
export RERANK_MODEL=bge-reranker-base

# Logging
export RUST_LOG=momo=info
```

---

## Embedded C FFI Notes

If you are linking against `momo-ffi` instead of running the HTTP server:

- `momo_engine_new(NULL, ...)` loads config from the environment using the same rules as the server.
- Passing `rebuild_embeddings=true` tells the engine to rebuild when stored vector dimensions do not match the configured embedding model.
- Background work is optional. Start workers with `momo_engine_start_workers` if your embedded integration needs the same worker-driven behavior as the server runtime.
- The FFI crate is built with local embeddings support enabled.

See [Embedded C FFI Reference](/reference/ffi) for the exported ABI and JSON contracts.
