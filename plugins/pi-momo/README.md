# @momomemory/pi-momo

Persistent memory for [Pi](https://pi.dev) coding agent using [Momo](https://github.com/momomemory/momo).

## Features

- **Auto-recall**: Automatically injects relevant memories and user profile before each agent turn
- **Auto-capture**: Automatically stores conversation turns as episode memories
- **Manual tools**: `momo_search`, `momo_store`, `momo_forget`, `momo_profile`
- **Slash commands**: `/remember`, `/recall`, `/momo-profile`, `/momo-debug`
- **Flexible config**: Supports JSONC config files at global and project level, plus environment variables

## Installation

```bash
pi install npm:@momomemory/pi-momo
```

Or add to your `~/.pi/settings.json`:

```json
{
  "packages": ["npm:@momomemory/pi-momo"]
}
```

## Configuration

Config is loaded with the following precedence (highest to lowest):

1. **Environment variables** (`MOMO_PI_*` or `MOMO_*`)
2. **Project config** (`.momo.jsonc` or `momo.jsonc` in current directory)
3. **Global oh-my-pi config** (`~/.omp/momo.jsonc`)
4. **Global Pi config** (`~/.pi/momo.jsonc`)
5. **Defaults**

### Config Files

Create `~/.pi/momo.jsonc` for global config:

```jsonc
{
  "baseUrl": "http://localhost:7638",
  "apiKey": "your-api-key",
  "containerTag": "pi_global",
  "autoRecall": true,
  "autoCapture": true,
  "maxRecallResults": 10,
  "profileFrequency": 50,
  "debug": false
}
```

Or create `.momo.jsonc` in your project directory:

```jsonc
{
  // Project-specific Momo config
  "baseUrl": "http://localhost:7638",
  "apiKey": "project-api-key",
  "containerTag": "pi_myproject"
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOMO_PI_BASE_URL` / `MOMO_BASE_URL` | `http://localhost:3000` | Momo server URL |
| `MOMO_PI_API_KEY` / `MOMO_API_KEY` | - | Optional API key |
| `MOMO_PI_CONTAINER_TAG` / `MOMO_CONTAINER_TAG` | `pi_{hostname}` | Memory namespace |
| `MOMO_PI_AUTO_RECALL` / `MOMO_AUTO_RECALL` | `true` | Inject memories before agent turns |
| `MOMO_PI_AUTO_CAPTURE` / `MOMO_AUTO_CAPTURE` | `true` | Store conversation turns |
| `MOMO_PI_MAX_RECALL_RESULTS` / `MOMO_MAX_RECALL_RESULTS` | `10` | Max memories per injection (1-20) |
| `MOMO_PI_PROFILE_FREQUENCY` / `MOMO_PROFILE_FREQUENCY` | `50` | Inject full profile every N turns (1-500) |
| `MOMO_PI_DEBUG` / `MOMO_DEBUG` | `false` | Enable verbose logging |

**Note:** `MOMO_PI_*` variables take precedence over `MOMO_*` variables.

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | `http://localhost:3000` | Momo server URL |
| `apiKey` | string | - | Optional API key for authentication |
| `containerTag` | string | `pi_{hostname}` | Memory namespace for isolation |
| `autoRecall` | boolean | `true` | Inject memories before agent turns |
| `autoCapture` | boolean | `true` | Store conversation turns as memories |
| `maxRecallResults` | number | `10` | Max memories per injection (1-20) |
| `profileFrequency` | number | `50` | Inject full profile every N turns (1-500) |
| `debug` | boolean | `false` | Enable verbose logging |

## Tools

### momo_search

Search memories by query:

```
Search for information about my project preferences
```

### momo_store

Store an explicit memory:

```
Remember that I prefer TypeScript over JavaScript
```

### momo_forget

Delete a memory by ID or query:

```
Forget the memory about X
```

### momo_profile

View your memory profile:

```
Show me my profile
```

## Commands

### /remember

```
/remember I prefer dark mode in all editors
```

### /recall

```
/recall project preferences
```

### /momo-profile

```
/momo-profile
```

### /momo-debug

Shows effective configuration plus per-field source (env/project/global/default), with API key redacted.

```
/momo-debug
```

## How It Works

### Auto-Recall

Before each agent turn, the plugin:

1. Fetches your profile (static facts + recent signals)
2. Searches for memories relevant to the current prompt
3. Injects a `<momo-context>` block with:
   - Long-term profile facts
   - Recent signals
   - Relevant memory matches with similarity scores

The full profile is injected every `profileFrequency` turns; on other turns, only relevant search results are injected.

### Auto-Capture

After each successful agent turn, the plugin:

1. Collects the user/assistant message pair
2. Strips previously injected context blocks
3. Ingests the conversation as an episode memory

## Requirements

- Pi 0.50.0+
- Momo server running and accessible

## License

MIT
