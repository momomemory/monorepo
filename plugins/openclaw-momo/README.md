# openclaw-momo

OpenClaw plugin for persistent memory using [Momo](https://github.com/momomemory/momo).

Long-term memory for OpenClaw. Automatically recalls relevant context, captures conversation turns, and gives your bot memory tools and commands.

## Install

```bash
openclaw plugins install @momomemory/openclaw-momo
```

Restart OpenClaw after installing.

## Configuration

You only need your Momo server URL. API key is optional (required only if your Momo server enforces auth).

Set environment variables:

```bash
export MOMO_OPENCLAW_BASE_URL="http://localhost:3000"
export MOMO_OPENCLAW_API_KEY="your-key" # optional
```

Or configure in `openclaw.json`:

```json5
{
  "plugins": {
    "entries": {
      "openclaw-momo": {
        "enabled": true,
        "config": {
          "baseUrl": "${MOMO_OPENCLAW_BASE_URL}",
          "apiKey": "${MOMO_OPENCLAW_API_KEY}"
        }
      }
    }
  }
}
```

### Advanced options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `containerTag` | `string` | `openclaw_{hostname}` | Memory namespace. All channels share this tag. |
| `autoRecall` | `boolean` | `true` | Inject relevant memories before every AI turn. |
| `autoCapture` | `boolean` | `true` | Automatically ingest the latest user/assistant turn after every successful agent run. |
| `maxRecallResults` | `number` | `10` | Max memories injected into context per turn. |
| `profileFrequency` | `number` | `50` | Inject full profile every N user turns. Search matches are injected every turn. |
| `captureMode` | `string` | `"all"` | `"all"` filters short text and injected context. `"everything"` captures all text. |
| `debug` | `boolean` | `false` | Verbose debug logging. |

## How it works

- Auto-Recall: before each AI turn, the plugin queries Momo and injects profile + relevant memories.
- Auto-Capture: after each successful AI turn, the plugin ingests the latest turn into Momo conversation memory.
- Namespacing: all memory operations are scoped by a container tag.

## Slash commands

| Command | Description |
|---------|-------------|
| `/remember <text>` | Manually save something to memory. |
| `/recall <query>` | Search memories and return ranked matches. |

## AI tools

| Tool | Description |
|------|-------------|
| `momo_store` | Save information to long-term memory. |
| `momo_search` | Search memories by query. |
| `momo_forget` | Delete a memory by id or query. |
| `momo_profile` | View the user profile (persistent + recent context). |

## CLI commands

```bash
openclaw momo search <query>    # Search memories
openclaw momo profile           # View profile
openclaw momo wipe              # Delete all memories in container (destructive)
```

## Development

```bash
bun install
bun run check-types
bun test
bun run build
```

## License

MIT
