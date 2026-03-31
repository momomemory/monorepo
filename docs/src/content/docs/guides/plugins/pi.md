---
title: Pi Plugin
description: Install and configure Momo for Pi.
---

Persistent memory for [Pi](https://pi.dev), the terminal-based coding agent. Automatically recalls context before agent turns and captures conversations as episode memories.

## Installation

```bash
pi install npm:@momomemory/pi-momo
```

Or add to `~/.pi/settings.json`:

```json
{
  "packages": ["npm:@momomemory/pi-momo"]
}
```

## Configuration

### Config Precedence

1. **Environment variables** (`MOMO_PI_*`)
2. **Project config** (`.momo.jsonc` in current directory)
3. **Global Pi config** (`~/.pi/momo.jsonc`)
4. **Defaults**

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOMO_PI_BASE_URL` | `http://localhost:3000` | Momo server URL |
| `MOMO_PI_API_KEY` | — | API key (optional) |
| `MOMO_PI_CONTAINER_TAG` | `pi_{hostname}` | Memory namespace |
| `MOMO_PI_AUTO_RECALL` | `true` | Inject memories before agent turns |
| `MOMO_PI_AUTO_CAPTURE` | `true` | Store conversation turns |
| `MOMO_PI_MAX_RECALL_RESULTS` | `10` | Max memories per injection (1-20) |
| `MOMO_PI_PROFILE_FREQUENCY` | `50` | Full profile every N turns (1-500) |
| `MOMO_PI_DEBUG` | `false` | Verbose logging |

Generic `MOMO_*` variables are not used by the Pi plugin config loader. Use the `MOMO_PI_*` prefix.

### Global Config File

Create `~/.pi/momo.jsonc`:

```jsonc
{
  "pi": {
    "baseUrl": "http://localhost:3000",
    "apiKey": "your-api-key",
    "containerTag": "pi_global",
    "autoRecall": true,
    "autoCapture": true,
    "maxRecallResults": 10,
    "profileFrequency": 50,
    "debug": false
  }
}
```

### Project-Local Config

Create `.momo.jsonc` in your project directory:

```jsonc
{
  "pi": {
    "baseUrl": "http://localhost:3000",
    "apiKey": "project-api-key",
    "containerTag": "pi_myproject"
  }
}
```

**Note:** Project-local config uses a nested `pi` key. Only `.momo.jsonc` (with leading dot) is loaded for project config.

The global config file also uses the nested `pi` key.

## Features

### Auto-Recall

Before each agent turn, the plugin:
1. Fetches your profile (static facts + recent signals)
2. Searches for memories relevant to the current prompt
3. Injects a `<momo-context>` block with:
   - Long-term profile facts
   - Recent signals
   - Relevant memory matches with similarity scores

Full profile is injected every `profileFrequency` turns; only search results on other turns.

### Auto-Capture

After each successful agent turn, the plugin:
1. Collects the user/assistant message pair
2. Strips previously injected context blocks
3. Ingests the conversation as an episode memory

### AI Tools

| Tool | Description | Example |
|------|-------------|---------|
| `momo_search` | Search memories by query | `Search for my project preferences` |
| `momo_store` | Store an explicit memory | `Remember that I prefer TypeScript` |
| `momo_forget` | Delete a memory by ID or query | `Forget the memory about X` |
| `momo_profile` | View your memory profile | `Show me my profile` |

### Slash Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/remember` | Persist an explicit memory | `/remember I prefer dark mode` |
| `/recall` | Find memories by query | `/recall project preferences` |
| `/momo-profile` | Show your memory profile | `/momo-profile` |
| `/momo-debug` | Show effective configuration | `/momo-debug` |

The `/momo-debug` command displays the current effective configuration values, with the API key redacted for security.

## Container Tags

Memories are isolated by container tag (default: `pi_{hostname}`). This prevents different projects or users from mixing memories.

Customize via:
- `MOMO_PI_CONTAINER_TAG` environment variable
- `containerTag` in config file

Tags are sanitized: spaces and special characters become underscores.

## Troubleshooting

**Plugin not loading:**
1. Check `~/.pi/settings.json` has the package listed
2. Run `pi doctor` to verify extension loading
3. Check Pi logs for errors

**Configuration issues:**
1. Run `/momo-debug` to see the effective config values
2. Verify you're using `.momo.jsonc` (with dot) for project config
3. Check that `MOMO_PI_*` env vars are set correctly

**No memories recalling:**
1. Verify the Momo server is running and accessible
2. Add some memories with `/remember` first
3. Check `autoRecall` is enabled in `/momo-debug` output

**Env vars not working:**
1. Use `MOMO_PI_*` variable names only
2. Export variables in your shell profile or before running `pi`
3. Restart Pi after changing env vars

## Requirements

- Pi 0.50.0+
- Momo server running and accessible
