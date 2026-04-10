# Hermes Agent Plugin for Momo

Hermes Agent integration for Momo — a self-hostable AI memory system written in Rust.

> This plugin is part of the [Momo monorepo](https://github.com/momomemory/momo). For the latest version, see `plugins/hermes/`.

## Features

- **Auto-recall**: Automatically injects relevant memories and user profile before each agent turn
- **Auto-capture**: Stores conversation turns as episode memories
- **Vector search**: Native LibSQL vector embeddings (no external vector DB needed)
- **Self-hostable**: Run your own memory server or use Momo Cloud
- **Container-based isolation**: Separate memory namespaces per profile/project

## Prerequisites

- Momo server running (local or cloud)
  - Docker: `docker run --name momo -d -p 3000:3000 -v momo-data:/data ghcr.io/momomemory/momo:latest`
  - Or visit [app.usemomo.com](https://app.usemomo.com) for cloud

## Setup

### Quick Setup

```bash
hermes memory setup    # select "momo"
```

### Plugin Installation

Copy this directory to your Hermes Agent plugins:

```bash
cp -r plugins/hermes ~/.hermes/hermes-agent/plugins/memory/momo
```

### Manual Setup

```bash
hermes config set memory.provider momo
echo "MOMO_API_KEY=***" >> ~/.hermes/.env  # if using auth
```

### Configuration File

Create `~/.hermes/momo.json`:

```json
{
  "base_url": "http://localhost:3000",
  "api_key": "your-api-key",
  "container_tag": "hermes-{identity}",
  "auto_recall": true,
  "auto_capture": true,
  "max_recall_results": 10,
  "profile_frequency": 50,
  "api_timeout": 5.0
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `base_url` | string | `http://localhost:3000` | Momo server URL |
| `api_key` | string | - | API key for authentication (optional) |
| `container_tag` | string | `hermes` | Memory namespace. Use `{identity}` for profile-scoped tags |
| `auto_recall` | boolean | `true` | Inject memories before agent turns |
| `auto_capture` | boolean | `true` | Store conversation turns as memories |
| `max_recall_results` | number | `10` | Max memories per injection (1-20) |
| `profile_frequency` | number | `50` | Inject full profile every N turns |
| `api_timeout` | number | `5.0` | API request timeout in seconds |

## Environment Variables

All config options can be set via environment variables (takes priority over config file):

| Variable | Description |
|----------|-------------|
| `MOMO_BASE_URL` | Momo server URL |
| `MOMO_API_KEY` | API key for authentication |
| `MOMO_CONTAINER_TAG` | Memory namespace |
| `MOMO_AUTO_RECALL` | Enable auto-recall (`true`/`false`) |
| `MOMO_AUTO_CAPTURE` | Enable auto-capture (`true`/`false`) |
| `MOMO_MAX_RECALL_RESULTS` | Max memories per recall |
| `MOMO_PROFILE_FREQUENCY` | Profile injection frequency |

## Tools

When enabled, the following tools are available to the agent:

### `momo_search`

Search your memory for relevant information.

```
Search for information about my project preferences
```

Parameters:
- `query` (required): Search query
- `limit` (optional): Max results (1-20, default: 10)

### `momo_store`

Store a new memory explicitly.

```
Remember that I prefer TypeScript over JavaScript
```

Parameters:
- `content` (required): Memory content
- `type` (optional): `fact`, `preference`, or `episode` (auto-detected when omitted)
- `metadata` (optional): Extra structured metadata to attach to the memory

### `momo_forget`

Delete a memory by ID.

```
Forget memory mem_abc123
```

Parameters:
- `id` (optional): Exact memory ID to delete
- `query` (optional): Best-match query to find and forget a memory

### `momo_profile`

View your computed memory profile.

```
Show me my Momo profile
```

## How It Works

### Auto-Recall

Before each agent turn, if `auto_recall` is enabled:

1. Fetches your profile (static facts + recent signals)
2. Searches for memories relevant to the current message
3. Injects a `<momo-context>` block with:
   - Your key facts
   - Recent activity
   - Relevant memory matches

The full profile is injected on the first turn and every `profile_frequency` turns.

### Auto-Capture

After each successful agent turn, if `auto_capture` is enabled:

1. Strips previously injected context blocks
2. Stores the cleaned user/assistant exchange as an `episode` memory
3. Skips trivial messages ("ok", "thanks", etc.)

### Built-In Memory Mirroring

When Hermes writes to its built-in memory store, Momo mirrors `add` operations as `fact` memories so explicit user facts persist in both systems.

## Profile-Scoped Containers

Use `{identity}` in `container_tag` for profile-specific memory isolation:

```json
{
  "container_tag": "hermes-{identity}"
}
```

- Default profile → `hermes-default`
- Profile "work" → `hermes-work`
- Profile "personal" → `hermes-personal`

## Troubleshooting

### "Failed to fetch Momo context"

- Check if Momo server is running: `curl http://localhost:3000/api/v1/health`
- Verify `base_url` in config
- Check API key if authentication is required

### Memories not being stored

- Verify `auto_capture` is enabled
- Check that messages aren't being filtered as trivial
- Look for errors in logs: `~/.hermes/logs/gateway.log`

### No memories found in search

- Ensure memories have been stored
- Check container tag matches
- Verify vector search is working in Momo web UI

## Comparison with Other Memory Providers

| Feature | Momo | Supermemory | Honcho |
|---------|------|-------------|--------|
| Self-hostable | ✅ Yes | ❌ No | ✅ Yes |
| Vector DB required | ❌ No (LibSQL) | ❌ No | ✅ Yes |
| Dialectic Q&A | ❌ No | ❌ No | ✅ Yes |
| Knowledge graph | ❌ No | ❌ No | ✅ Yes |
| Profile cards | ✅ Yes | ✅ Yes | ✅ Yes |
| Multi-container | ✅ Yes | ✅ Yes | ✅ Yes |

## Links

- [Momo GitHub](https://github.com/momomemory/momo)
- [Momo Documentation](https://docs.usemomo.com)
- [Momo Cloud](https://app.usemomo.com)
- [Hermes Memory Providers Docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers)

## License

MIT
