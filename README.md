# Momo

### Self-hostable AI memory for agents.

> *"You, my friend, are just a few plumbs short of a fruit pie."* — Momo

Momo is a self-hostable AI memory system built as a single Rust binary. It gives agents long-term memory with LibSQL native vector search, so you do not need an external vector database.

## Quick Start

Run the latest container image:

```bash
docker run --name momo -d --restart unless-stopped -p 3000:3000 -v momo-data:/data ghcr.io/momomemory/momo:latest
```

Then open:

- Web console: `http://localhost:3000/`
- API docs: `http://localhost:3000/api/v1/docs`
- OpenAPI spec: `http://localhost:3000/api/v1/openapi.json`
- MCP endpoint: `http://localhost:3000/mcp`
- MCP guide: [`momo/docs/mcp.md`](./momo/docs/mcp.md)

Add memory:

```bash
curl -X POST http://localhost:3000/api/v1/conversations:ingest \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "I prefer dark mode"}], "containerTag": "user_1"}'
```

Search memory:

```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"q": "What are the user preferences?", "containerTags": ["user_1"], "scope": "hybrid"}'
```

## Features

- Native LibSQL vector search (no external vector DB)
- Embedded Bun + Preact web console served from `/`
- Local AI pipeline: FastEmbed embeddings, Whisper transcription, Tesseract OCR
- External model integrations: OpenAI, OpenRouter, Ollama, and LM Studio
- Universal ingestion for URLs, PDF, HTML, DOCX, images, and audio/video
- Memory graph traversal, contradiction handling, and memory versioning
- Optional background inference and profile refresh services
- Multi-tenant memory isolation via `container_tag`
- Reranking support for higher search relevance

## Monorepo Layout

- `momo/`: Core Rust server, embedded frontend, API, background services
- `sdks/typescript/`: Official TypeScript SDK (`@momomemory/sdk`)
- `plugins/opencode-momo/`: OpenCode plugin
- `plugins/openclaw-momo/`: OpenClaw plugin

## Development

Common workflows from the repo root:

```bash
just dev            # backend + frontend dev servers
just build          # build backend with embedded frontend
just test           # run Rust tests
just lint           # clippy with warnings as errors
just fmt            # format Rust code
just sdk-ts-build   # build TypeScript SDK
```

See full command list in `justfile`.

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
| **OpenCode** | [`@momomemory/opencode-momo`](https://github.com/momomemory/opencode-momo) | Persistent memory for coding agents with context injection and tool modes |
| **OpenClaw** | [`@momomemory/openclaw-momo`](https://github.com/momomemory/openclaw-momo) | Persistent memory for OpenClaw with auto-recall, capture, and slash commands |

## Documentation

- [`momo/docs/README.md`](./momo/docs/README.md)
- [`momo/docs/api.md`](./momo/docs/api.md)
- [`momo/docs/mcp.md`](./momo/docs/mcp.md)
- [`momo/docs/self-hosting.md`](./momo/docs/self-hosting.md)

## Repositories

- **[momomemory/momo](https://github.com/momomemory/momo)**: Core server mirror (Rust).
- **[momomemory/sdk-typescript](https://github.com/momomemory/sdk-typescript)**: TypeScript SDK mirror.
- **[momomemory/opencode-momo](https://github.com/momomemory/opencode-momo)**: OpenCode plugin.
- **[momomemory/openclaw-momo](https://github.com/momomemory/openclaw-momo)**: OpenClaw plugin.

## Credits

Inspired by [Supermemory](https://supermemory.ai). Named after Momo, Aang's loyal flying lemur companion.

[MIT](./momo/LICENSE) © Momo Contributors
`plugins/pi-momo/`: Pi plugin
| **Pi** | [`@momomemory/pi-momo`](https://github.com/momomemory/pi-momo) | Persistent memory for Pi coding agent with auto-recall, capture, and tools |
