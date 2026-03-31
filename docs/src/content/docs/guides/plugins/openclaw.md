---
title: OpenClaw Plugin
description: Install and configure Momo for OpenClaw.
---

Persistent memory for [OpenClaw](https://github.com/openclaw-ai/openclaw). Automatically recalls relevant context before every AI turn and captures conversation turns as memories.

## Installation

```bash
openclaw plugins install @momomemory/openclaw-momo
```

Restart OpenClaw after installation.

## Configuration

### Environment Variables (Recommended)

```bash
export MOMO_OPENCLAW_BASE_URL="http://localhost:3000"
export MOMO_OPENCLAW_API_KEY="your-api-key"
```

**Important:** OpenClaw does **not** fall back to generic `MOMO_*` environment variables. You must use the `MOMO_OPENCLAW_*` prefix.

### Config File

Add to `openclaw.json`:

```json5
{
  "plugins": {
    "entries": {
      "openclaw-momo": {
        "enabled": true,
        "config": {
          "baseUrl": "http://localhost:3000",
          "apiKey": "your-api-key"
        }
      }
    }
  }
}
```

You can also use `${ENV_VAR}` placeholders:

```json5
{
  "config": {
    "baseUrl": "${MOMO_OPENCLAW_BASE_URL}",
    "apiKey": "${MOMO_OPENCLAW_API_KEY}"
  }
}
```

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `containerTag` | `string` | `oclw_{hostname}` | Memory namespace. All channels share this tag. |
| `autoRecall` | `boolean` | `true` | Inject relevant memories before every AI turn |
| `autoCapture` | `boolean` | `true` | Automatically ingest conversation turns |
| `maxRecallResults` | `number` | `10` | Max memories injected into context per turn (1-20) |
| `profileFrequency` | `number` | `50` | Inject full profile every N user turns |
| `captureMode` | `string` | `"all"` | `"all"` filters short text; `"everything"` captures all |
| `debug` | `boolean` | `false` | Verbose debug logging |

## Features

### Auto-Recall

Before each AI turn, the plugin:
1. Fetches your computed profile (static facts + recent signals)
2. Searches for memories relevant to the current prompt
3. Injects context with similarity scores

Full profile is injected every `profileFrequency` turns; search results are injected every turn.

### Auto-Capture

After each successful AI turn, the plugin:
1. Collects the user/assistant message pair
2. Strips previously injected context blocks
3. Ingests the conversation as an episode memory

### AI Tools

| Tool | Description |
|------|-------------|
| `momo_store` | Save information to long-term memory |
| `momo_search` | Search memories by query |
| `momo_forget` | Delete a memory by ID or query |
| `momo_profile` | View the user profile |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/remember <text>` | Manually save something to memory |
| `/recall <query>` | Search memories and return ranked matches |

### CLI Commands

```bash
# Search memories
openclaw momo search "database schema"

# View profile
openclaw momo profile

# Delete all memories in container (destructive)
openclaw momo wipe
```

## Container Tags

All memory operations are scoped by a container tag (default: `oclw_{hostname}`). This namespace isolates your OpenClaw memories from other agents or projects.

To customize:

```bash
export MOMO_OPENCLAW_CONTAINER_TAG="my-team-shared"
```

Or in `openclaw.json`:

```json5
{
  "config": {
    "containerTag": "my-project"
  }
}
```

## Troubleshooting

**Plugin not loading:**
1. Verify `openclaw.json` has the plugin enabled
2. Check OpenClaw logs for configuration errors
3. Ensure you're using `MOMO_OPENCLAW_*` env vars (not generic `MOMO_*`)

**Memories not recalling:**
1. Check that `autoRecall` is not disabled in config
2. Verify the Momo server is accessible
3. Enable `debug: true` to see API calls in logs

**No profile data:**
1. Add some memories first using `/remember` or `momo_store`
2. Wait for profile computation (happens automatically)
3. Run `openclaw momo profile` to verify
