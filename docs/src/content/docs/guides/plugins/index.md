---
title: Agent Plugins
description: Install and configure Momo plugins for OpenCode, OpenClaw, and Pi.
---

Momo provides official plugins for OpenCode, OpenClaw, and Pi.

| Agent | Plugin Package | Best For |
|-------|---------------|----------|
| [OpenCode](/guides/plugins/opencode) | `@momomemory/opencode-momo` | VS Code extension users, context injection per session |
| [OpenClaw](/guides/plugins/openclaw) | `@momomemory/openclaw-momo` | CLI-first workflows, auto recall/capture |
| [Pi](/guides/plugins/pi) | `@momomemory/pi-momo` | Terminal-based coding agent users |

## Prerequisites

All plugins require:

1. **A running Momo server** — See [Self-Hosting](/guides/self-hosting) to set one up
2. **Momo server URL** — Default is `http://localhost:3000`
3. **API key** — Only if your Momo server has `MOMO_API_KEYS` configured

## Quick Comparison

### OpenCode
- **Install**: `bunx @momomemory/opencode-momo install`
- **Config**: `~/.config/opencode/momo.jsonc` (nested under `opencode` key)
- **Env vars**: `MOMO_OPENCODE_BASE_URL`, `MOMO_OPENCODE_API_KEY`
- **Key feature**: Context injection at session start, ingestion tools for OCR/transcription

### OpenClaw
- **Install**: `openclaw plugins install @momomemory/openclaw-momo`
- **Config**: `openclaw.json` under `plugins.entries.openclaw-momo.config`
- **Env vars**: `MOMO_OPENCLAW_BASE_URL`, `MOMO_OPENCLAW_API_KEY` (no generic fallback)
- **Key feature**: Auto-recall before every AI turn, auto-capture after each response

### Pi
- **Install**: `pi install npm:@momomemory/pi-momo`
- **Config**: `.momo.jsonc` (project) or `~/.pi/momo.jsonc` (global), nested under `pi` key
- **Env vars**: `MOMO_PI_BASE_URL`, `MOMO_PI_API_KEY`, and related `MOMO_PI_*` settings
- **Key feature**: Terminal-native, debug command for troubleshooting

## Common Features

All plugins share these capabilities:

- **Memory storage** — Save facts, preferences, and episode memories
- **Memory search** — Find relevant context by query
- **User profiles** — Computed narratives of user preferences
- **Container tags** — Namespace isolation per project/user

## Choosing a Plugin

**Choose OpenCode if:**
- You use the OpenCode VS Code extension
- You want automatic context injection at the start of each session
- You need OCR and transcription ingestion tools

**Choose OpenClaw if:**
- You prefer CLI-first workflows
- You want continuous memory (auto-recall before every turn)
- You use OpenClaw as your primary agent framework

**Choose Pi if:**
- You use the Pi terminal-based coding agent
- You want project-local config via `.momo.jsonc`
- You prefer a simple, terminal-native experience

## Next Steps

- [Install OpenCode Plugin](/guides/plugins/opencode)
- [Install OpenClaw Plugin](/guides/plugins/openclaw)
- [Install Pi Plugin](/guides/plugins/pi)
