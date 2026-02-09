# opencode-momo

OpenCode plugin for persistent memory using [Momo](https://github.com/momomemory/momo).

Your agent remembers what you tell it -- across sessions, across projects.

## Installation

### For Humans

1. Install the plugin:
   ```bash
   bunx @momomemory/opencode-momo install
   ```
2. Configure your Momo connection:
   ```bash
   opencode-momo configure --base-url http://localhost:3000 --api-key YOUR_KEY
   ```
   Alternatively, set the following environment variables:
   - `MOMO_BASE_URL` (default: `http://localhost:3000`)
   - `MOMO_API_KEY`

**Or let your agent do it** -- paste this into OpenCode:
```
Install opencode-momo by following https://raw.githubusercontent.com/momomemory/opencode-momo/main/README.md
```

### For LLM Agents

<details>
<summary>Instructions for LLM Agents (click to expand)</summary>

If you're an LLM agent helping set up opencode-momo, follow these steps:

#### Step 1: Run the installer

```bash
bunx @momomemory/opencode-momo install --yes
```

This will:
- Register the plugin in `~/.config/opencode/opencode.jsonc`
- Create the `/momo-init` and `/momo-configure` commands

#### Step 2: Verify the config

```bash
cat ~/.config/opencode/opencode.jsonc
```

Should contain:
```jsonc
{
  "plugin": [
    "@momomemory/opencode-momo@latest"
    // ... other plugins
  ]
}
```

If not, add it manually.

#### Step 3: Configure connection

Ask the user for their Momo server URL (default: `http://localhost:3000`) and optional API key.

Then configure via CLI:

```bash
opencode-momo configure --base-url http://localhost:3000 --api-key YOUR_KEY
```

Or set environment variables:

```bash
export MOMO_BASE_URL=http://localhost:3000
export MOMO_API_KEY=your-key
```

Or create `~/.config/opencode/momo.jsonc`:

```jsonc
{
  "baseUrl": "http://localhost:3000",
  "apiKey": "your-key"
}
```

#### Step 4: Verify setup

Tell the user to restart OpenCode. They should see `momo` in the tools list. If not, check:
1. Is `MOMO_API_KEY` set (or is the server running without auth)?
2. Is the plugin in `opencode.jsonc`?

#### Step 5: Initialize codebase memory (optional)

Run `/momo-init` to have the agent explore and memorize the codebase.

</details>

## Features

### Context Injection
Momo automatically injects relevant context into the first message of every chat session. This includes:
- **User Profile**: A computed narrative of your preferences and known facts.
- **User Memories**: Recent personal context across all projects.
- **Project Memories**: Specific knowledge related to the current codebase.

### Tool Modes
The `momo` tool supports 6 operational modes:
- **help**: Show usage information.
- **add**: Store a new memory with a specified scope and type.
- **search**: Perform a hybrid search across user and project memories.
- **profile**: View the computed user profile.
- **list**: List recent memories for a given scope.
- **forget**: Remove a specific memory by its ID.

### Codebase Indexing
The `/momo-init` command provides a structured workflow for agents to explore a new codebase and store its architecture, conventions, and key facts into project memory.

### Event Compaction
Momo listens for `session.compacted` events. When a session is compacted, the plugin automatically ingests the conversation history into Momo to ensure long-term retention of session insights. A 30-second cooldown is enforced per session to prevent redundant ingestion.

### Privacy
Momo supports the `<private>` tag. Any content wrapped in `<private>` tags is automatically stripped before being stored in memory. If a message consists entirely of private content, it will not be stored.

## Tool Usage

| Mode | Required Args | Optional Args | Description |
|------|--------------|---------------|-------------|
| help | — | — | Show help text |
| add | content | scope, memoryType | Store a memory |
| search | query | scope, limit | Search memories |
| profile | — | scope | View computed user profile |
| list | — | scope, limit | List recent memories |
| forget | memoryId | — | Forget a memory by ID |

**Scopes**: `user` (cross-project), `project` (current project, default)  
**Memory Types**: `fact`, `preference`, `episode`

## Memory Scoping

Memories are isolated using container tags derived from your environment:

| Scope | Description | Tag Derivation (djb2) |
|-------|-------------|-----------------------|
| **user** | Personal facts and preferences shared across all projects | `opencode-user-{hash(username)}` |
| **project** | Codebase-specific knowledge | `opencode-project-{hash(directory)}` |

## Configuration

Configuration is stored in `~/.config/opencode/momo.jsonc`:

```jsonc
{
  // Momo server URL
  "baseUrl": "http://localhost:3000",
  // API key for authentication
  "apiKey": "your-key-here"
}
```

### Environment Variables

The following variables can be used to override configuration:
- `MOMO_BASE_URL`: Overrides `baseUrl` in config.
- `MOMO_API_KEY`: Overrides `apiKey` in config.
- `MOMO_CONTAINER_TAG_USER`: Override the default user container tag.
- `MOMO_CONTAINER_TAG_PROJECT`: Override the default project container tag.

## Development

1. Install dependencies:
   ```bash
   bun install
   ```
2. Build the plugin:
   ```bash
   bun run build
   ```
3. Run typecheck:
   ```bash
   bun run typecheck
   ```
4. Run tests:
   ```bash
   bun test
   ```

### Local Installation

To test the plugin locally in OpenCode, add a file URL to your `opencode.jsonc`:

```jsonc
{
  "plugin": ["file:///path/to/opencode-momo"]
}
```

## License

MIT
