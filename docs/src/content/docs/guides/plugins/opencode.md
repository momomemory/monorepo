---
title: OpenCode Plugin
description: Install and configure Momo for OpenCode.
---

Persistent memory for [OpenCode](https://opencode.ai). Automatically injects relevant context at session start and provides tools for memory management.

## Installation

```bash
bunx @momomemory/opencode-momo install
```

Or with automatic confirmation:

```bash
bunx @momomemory/opencode-momo install --yes
```

This registers the plugin in `~/.config/opencode/opencode.jsonc` and creates command files.

## Configuration

### Environment Variables (Recommended)

```bash
export MOMO_OPENCODE_BASE_URL="http://localhost:3000"
export MOMO_OPENCODE_API_KEY="your-api-key"
```

Optional overrides:

```bash
export MOMO_OPENCODE_CONTAINER_TAG_USER="my-user-tag"
export MOMO_OPENCODE_CONTAINER_TAG_PROJECT="my-project-tag"
```

### Config File

Create `~/.config/opencode/momo.jsonc`:

```jsonc
{
  "opencode": {
    "baseUrl": "http://localhost:3000",
    "apiKey": "your-api-key",
    "containerTagUser": "",
    "containerTagProject": ""
  }
}
```

Or use the CLI:

```bash
opencode-momo configure --base-url http://localhost:3000 --api-key YOUR_KEY
```

### Project-Local Config

Create `.momo.jsonc` in your project root:

```jsonc
{
  "opencode": {
    "baseUrl": "http://localhost:3000",
    "containerTagProject": "my-stable-project-tag"
  }
}
```

### Config Precedence

1. Environment variables (`MOMO_OPENCODE_*`)
2. Project-local `.momo.jsonc`
3. Global `~/.config/opencode/momo.jsonc`
4. Built-in defaults

## Features

### Context Injection

Momo automatically injects context into the first message of every session:
- **User Profile** — Computed narrative of preferences and known facts
- **User Memories** — Recent personal context across all projects
- **Project Memories** — Knowledge specific to the current codebase

### Memory Tools

| Mode | Description |
|------|-------------|
| `help` | Show usage information |
| `add` | Store a new memory |
| `search` | Hybrid search across memories |
| `profile` | View computed user profile |
| `list` | List recent memories |
| `forget` | Remove a memory by ID |

**Example usage:**

```
momo({ mode: "add", content: "User prefers dark mode", scope: "user", memoryType: "preference" })
momo({ mode: "search", query: "database schema", limit: 5 })
momo({ mode: "forget", memoryId: "mem_abc123" })
```

### Ingestion Tools

| Tool | Purpose |
|------|---------|
| `momo_ingest` | Ingest text, URLs, or files into the document pipeline |
| `momo_ocr` | OCR image files and extract text |
| `momo_transcribe` | Transcribe audio/video files |

**Example usage:**

```
momo_ingest({ input: "https://example.com/docs", inputType: "url", scope: "project" })
momo_ocr({ filePath: "/path/to/image.png", extractMemories: true })
momo_transcribe({ filePath: "/path/to/audio.mp3", scope: "user" })
```

### Slash Commands

| Command | Purpose |
|---------|---------|
| `/momo-init` | Initialize codebase memory — guides the agent to explore and store project knowledge |
| `/momo-configure` | Shows configuration help |

### Memory Scoping

| Scope | Description | Container Tag |
|-------|-------------|---------------|
| `user` | Personal facts across all projects | `opencode-user-{hash(username)}` |
| `project` | Codebase-specific knowledge | `ocp-{slug(projectName)}-{hash(directory)}` |

### Privacy

Wrap content in `<private>` tags to prevent storage:

```
<private>This will not be stored in memory</private>
```

## Troubleshooting

**Plugin not appearing in tools list:**
1. Check `~/.config/opencode/opencode.jsonc` contains the plugin
2. Verify `MOMO_OPENCODE_API_KEY` is set (or server has auth disabled)
3. Restart OpenCode

**Configuration not loading:**
1. Verify config file syntax (JSONC with comments is supported)
2. Check that you're using `MOMO_OPENCODE_*` env vars, not generic `MOMO_*`
3. Run `opencode-momo configure` to reset configuration

**Context not injecting:**
1. Ensure the Momo server is accessible at your configured `baseUrl`
2. Check that memories exist for the current container tag (both user and project scopes)
3. Check plugin logs for memory injection errors
