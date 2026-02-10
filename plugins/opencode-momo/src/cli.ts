#!/usr/bin/env node

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { getConfigDir } from "./config";
import { stripJsoncComments } from "./services/jsonc";

const PLUGIN_NAME = "@momomemory/opencode-momo@latest";

// ─── Markdown Command Content ───

const MOMO_INIT_MD = `---
description: Initialize Momo with comprehensive codebase knowledge
---

# Initializing Momo Memory

You are initializing persistent memory for this codebase. Your goal is to explore the project thoroughly and store key information so that future sessions have full context without re-exploration.

## Steps

1. **Explore the project structure** — Understand the directory layout, key files, and architecture.
2. **Identify conventions** — Note coding style, naming patterns, testing approach, and tooling.
3. **Record architectural decisions** — Store how the codebase is organized and why.
4. **Save key facts** — Store important facts about the project using Momo.

## How to Store Memories

Use the \`momo\` tool to save what you learn:

\`\`\`
momo({ mode: "add", content: "This project uses a monorepo with Cargo workspaces", scope: "project", memoryType: "fact" })
momo({ mode: "add", content: "User prefers concise code comments", scope: "user", memoryType: "preference" })
\`\`\`

### Scopes
- **\`user\`** — Personal preferences and facts that apply across all projects
- **\`project\`** — Information specific to this codebase

### Memory Types
- **\`fact\`** — Objective information (architecture, tech stack, file locations)
- **\`preference\`** — Subjective preferences (coding style, tool choices)
- **\`episode\`** — Events or interactions worth remembering

## What to Capture

- Programming languages and frameworks used
- Build system and development commands
- Project structure and key directories
- Testing patterns and test locations
- Deployment and CI/CD configuration
- Important conventions and patterns
- Key dependencies and their purposes
- Any README or documentation highlights

Start by listing the top-level files and directories, then progressively explore the most important areas of the codebase. Store each significant finding as a memory.
`;

const MOMO_CONFIGURE_MD = `---
description: Configure Momo memory connection
---

# Configure Momo

Run this command to configure the Momo connection:

\`\`\`bash
bunx @momomemory/opencode-momo configure
\`\`\`

Or set environment variables:
- \`MOMO_BASE_URL\` - Momo server URL (default: http://localhost:3000)
- \`MOMO_API_KEY\` - API key for authentication

After configuration, restart OpenCode to activate.
`;

// ─── Helpers ───

function parseArgs(argv: string[]): {
  command: string | undefined;
  flags: Record<string, string | boolean>;
} {
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      flags["help"] = true;
    } else if (arg === "--yes" || arg === "-y") {
      flags["yes"] = true;
    } else if (arg === "--no-prompt") {
      flags["no-prompt"] = true;
    } else if (arg === "--base-url" && i + 1 < argv.length) {
      i++;
      flags["base-url"] = argv[i]!;
    } else if (arg === "--api-key" && i + 1 < argv.length) {
      i++;
      flags["api-key"] = argv[i]!;
    } else if (!arg.startsWith("-") && !command) {
      command = arg;
    }
  }

  return { command, flags };
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

async function promptInput(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

// ─── Exported Core Logic (testable) ───

/**
 * Register the plugin in OpenCode's opencode.jsonc config.
 * Returns true if a change was made, false if already registered.
 */
export function registerPluginInConfig(configDir: string): boolean {
  const configPath = join(configDir, "opencode.jsonc");

  if (existsSync(configPath)) {
    const content = readFileSync(configPath, "utf-8");

    if (content.includes(PLUGIN_NAME)) {
      return false;
    }

    if (content.includes('"plugin"')) {
      const newContent = content.replace(
        /("plugin"\s*:\s*\[)([^\]]*?)(\])/,
        (_match: string, start: string, middle: string, end: string) => {
          const trimmed = middle.trim();
          if (trimmed === "") {
            return `${start}\n    "${PLUGIN_NAME}"\n  ${end}`;
          }
          return `${start}${middle.trimEnd()},\n    "${PLUGIN_NAME}"\n  ${end}`;
        },
      );
      writeFileSync(configPath, newContent, "utf-8");
      return true;
    }

    const beforeBrace = content.trimEnd().slice(0, -1).trimEnd();
    if (beforeBrace.endsWith(",") || beforeBrace.endsWith("{")) {
      const insertContent = content.replace(
        /\}\s*$/,
        `  "plugin": [\n    "${PLUGIN_NAME}"\n  ]\n}`,
      );
      writeFileSync(configPath, insertContent, "utf-8");
    } else {
      const withComma = content.replace(
        /(\S)\s*\}\s*$/,
        `$1,\n  "plugin": [\n    "${PLUGIN_NAME}"\n  ]\n}`,
      );
      writeFileSync(configPath, withComma, "utf-8");
    }
    return true;
  }

  mkdirSync(configDir, { recursive: true });
  const newConfig = `{\n  "plugin": [\n    "${PLUGIN_NAME}"\n  ]\n}\n`;
  writeFileSync(configPath, newConfig, "utf-8");
  return true;
}

/**
 * Write the markdown command files into the command directory.
 * Returns an object indicating which files were written.
 */
export function writeCommandFiles(configDir: string): {
  initWritten: boolean;
  configureWritten: boolean;
} {
  const commandDir = join(configDir, "command");
  mkdirSync(commandDir, { recursive: true });

  const initPath = join(commandDir, "momo-init.md");
  const configurePath = join(commandDir, "momo-configure.md");

  writeFileSync(initPath, MOMO_INIT_MD, "utf-8");
  writeFileSync(configurePath, MOMO_CONFIGURE_MD, "utf-8");

  return { initWritten: true, configureWritten: true };
}

/**
 * Write or update the momo.jsonc config file.
 */
export function writeMomoConfig(
  configDir: string,
  options: { baseUrl?: string; apiKey?: string },
): void {
  const configPath = join(configDir, "momo.jsonc");
  mkdirSync(configDir, { recursive: true });

  let existing: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const stripped = stripJsoncComments(raw);
      existing = JSON.parse(stripped) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  const priorBaseUrl = typeof existing.baseUrl === "string" ? existing.baseUrl : undefined;
  const priorApiKey = typeof existing.apiKey === "string" ? existing.apiKey : undefined;
  const priorContainerTagUser =
    typeof existing.containerTagUser === "string" ? existing.containerTagUser : undefined;
  const priorContainerTagProject =
    typeof existing.containerTagProject === "string" ? existing.containerTagProject : undefined;

  const config = {
    baseUrl: options.baseUrl ?? priorBaseUrl ?? "http://localhost:3000",
    apiKey: options.apiKey ?? priorApiKey ?? "",
    containerTagUser: priorContainerTagUser ?? "",
    containerTagProject: priorContainerTagProject ?? "",
  };

  const lines: string[] = ["{"];
  lines.push("  // Momo server URL");
  lines.push(`  "baseUrl": ${JSON.stringify(config.baseUrl)},`);
  lines.push("  // API key for authentication (leave empty if your server has auth disabled)");
  lines.push(`  "apiKey": ${JSON.stringify(config.apiKey)},`);
  lines.push("  // Optional override for user memory container tag (default: auto-derived from username)");
  lines.push(`  "containerTagUser": ${JSON.stringify(config.containerTagUser)},`);
  lines.push("  // Optional override for project memory container tag (default: auto-derived from project directory)");
  lines.push(`  "containerTagProject": ${JSON.stringify(config.containerTagProject)}`);
  lines.push("}");
  lines.push("");

  writeFileSync(configPath, lines.join("\n"), "utf-8");
}

// ─── Commands ───

async function runInstall(flags: Record<string, string | boolean>): Promise<void> {
  const autoYes = flags["yes"] === true || flags["no-prompt"] === true;
  const configDir = getConfigDir();

  console.log("\n🔧 Step 1: Register plugin in OpenCode config\n");

  if (!autoYes) {
    const ok = await confirm("Register @momomemory/opencode-momo in OpenCode config?");
    if (!ok) {
      console.log("  Skipped.");
      return;
    }
  }

  const changed = registerPluginInConfig(configDir);
  if (changed) {
    console.log(`  ✓ Plugin registered in ${join(configDir, "opencode.jsonc")}`);
  } else {
    console.log("  ✓ Plugin already registered in config");
  }

  console.log("\n📝 Step 2: Create command files\n");

  if (!autoYes) {
    const ok = await confirm("Create momo-init.md and momo-configure.md command files?");
    if (!ok) {
      console.log("  Skipped.");
      return;
    }
  }

  writeCommandFiles(configDir);
  console.log(`  ✓ Created ${join(configDir, "command", "momo-init.md")}`);
  console.log(`  ✓ Created ${join(configDir, "command", "momo-configure.md")}`);

  console.log(`
✅ Installation complete!

Next steps:
  1. Set your Momo API key:
     $ opencode-momo configure --base-url http://localhost:3000 --api-key YOUR_KEY

     Or set environment variables:
     $ export MOMO_API_KEY=your-key
     $ export MOMO_BASE_URL=http://localhost:3000

  2. Restart OpenCode to activate the plugin.

  3. Use /momo-init to initialize memory for your codebase.
`);
}

async function runConfigure(flags: Record<string, string | boolean>): Promise<void> {
  const configDir = getConfigDir();
  let baseUrl = typeof flags["base-url"] === "string" ? flags["base-url"] : undefined;
  let apiKey = typeof flags["api-key"] === "string" ? flags["api-key"] : undefined;

  if (baseUrl === undefined && apiKey === undefined) {
    const isTTY = process.stdin.isTTY;
    if (isTTY) {
      baseUrl = await promptInput("Momo server URL", "http://localhost:3000");
      apiKey = await promptInput("API key");
    } else {
      console.error(
        "No --base-url or --api-key provided, and stdin is not a TTY.\n" +
          "Usage: opencode-momo configure --base-url URL --api-key KEY",
      );
      process.exit(1);
    }
  }

  writeMomoConfig(configDir, { baseUrl, apiKey });
  console.log(`\n✓ Configuration written to ${join(configDir, "momo.jsonc")}`);

  if (apiKey) {
    console.log("  ✓ API key set");
  }
  if (baseUrl) {
    console.log(`  ✓ Base URL: ${baseUrl}`);
  }

  console.log("\nRestart OpenCode to apply changes.");
}

// ─── CLI Entry ───

function printHelp(): void {
  console.log(`opencode-momo v0.1.1

OpenCode plugin that gives coding agents persistent memory using Momo.

USAGE:
  opencode-momo <command> [options]

COMMANDS:
  install       Install and configure the plugin for OpenCode
  configure     Update Momo connection settings
  help          Show this help message

INSTALL OPTIONS:
  --yes, -y     Skip confirmation prompts
  --no-prompt   Same as --yes

CONFIGURE OPTIONS:
  --base-url    Momo server URL (default: http://localhost:3000)
  --api-key     API key for authentication

GENERAL OPTIONS:
  -h, --help    Show this help message
`);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || flags["help"] === true) {
    printHelp();
    process.exit(0);
  }

  if (command === "install") {
    await runInstall(flags);
    return;
  }

  if (command === "configure") {
    await runConfigure(flags);
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error('Run "opencode-momo --help" for usage.');
  process.exit(1);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
