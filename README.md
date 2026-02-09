# Momo

### Self-hostable AI memory for your agents.

> *"You, my friend, are just a few plumbs short of a fruit pie."* — Momo

Momo is a self-hostable AI memory system designed to give agents long-term persistent memory. It is a single Rust binary that uses LibSQL's native vector search, meaning no external vector database like Pinecone or Weaviate is required.

Give your agents a brain that actually remembers.

## Key Features

- **Zero-Config Vector DB**: Native LibSQL vector support — no external dependencies required.
- **Local AI Pipeline**: Built-in support for local embeddings (FastEmbed) and transcription (Whisper).
- **Universal Ingestion**: Extract from URLs, PDFs, DOCX, Images (OCR), and Audio/Video out of the box.
- **Contradiction Management**: Automatically detect and resolve conflicting memories over time.
- **Memory Graph**: Visualize and traverse relationships between disparate pieces of information.
- **Multi-Tenant by Design**: Scalable container-based isolation for multi-user applications.
- **Autonomous Synthesis**: Optional background engine that derives new insights from existing data.
- **Intelligent Decay**: Relevance scoring that automatically prunes stale or irrelevant memories.

## Quick Start

The fastest way to get Momo running is via Docker:

```bash
docker run -p 3000:3000 -v ./data:/data momomemory/momo
```

### Add a Memory
```bash
curl -X POST http://localhost:3000/api/v1/conversations:ingest \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "I prefer dark mode"}], "containerTag": "user_1"}'
```

### Search Everything
```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"q": "What are the user preferences?", "containerTags": ["user_1"], "scope": "hybrid"}'
```

## SDKs

| Language | Package | Status |
|----------|---------|--------|
| **TypeScript** | [`@momomemory/sdk`](https://github.com/momomemory/sdk-typescript) | Stable |
| **Python** | `momomemory-sdk` | Coming Soon |
| **Rust** | `momo-sdk` | Coming Soon |
| **Go** | `momo-go` | Coming Soon |

## Plugins

| Platform | Package | Description |
|----------|---------|-------------|
| **OpenCode** | [`@momomemory/opencode-momo`](https://github.com/momomemory/opencode-momo) | Persistent memory for coding agents — context injection, tool modes, event compaction |

## Repositories

- **[momomemory/momo](https://github.com/momomemory/momo)**: Core server (Rust).
- **[momomemory/sdk-typescript](https://github.com/momomemory/sdk-typescript)**: Official TypeScript/JavaScript SDK.
- **[momomemory/opencode-momo](https://github.com/momomemory/opencode-momo)**: OpenCode plugin for persistent agent memory.

## Credits

Inspired by [Supermemory](https://supermemory.ai). Named after Momo, Aang's loyal flying lemur companion.

[MIT](LICENSE) © Momo Contributors
