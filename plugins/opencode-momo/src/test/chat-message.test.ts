import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Part, UserMessage } from "@opencode-ai/sdk";
import { _resetInjectedSessions } from "../index";

const savedEnv: Record<string, string | undefined> = {};

function setEnv(vars: Record<string, string | undefined>): void {
  for (const key of Object.keys(vars)) {
    savedEnv[key] = process.env[key];
    if (vars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vars[key];
    }
  }
}

function restoreEnv(): void {
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

function makeMockCtx(): PluginInput {
  return {
    client: {} as PluginInput["client"],
    project: {} as PluginInput["project"],
    directory: "/tmp/test-project",
    worktree: "/tmp/test-project",
    serverUrl: new URL("http://localhost:3001"),
    $: (() => {}) as unknown as PluginInput["$"],
  };
}

describe("chat.message hook", () => {
  beforeEach(() => {
    _resetInjectedSessions();
    setEnv({
      MOMO_API_KEY: undefined,
      MOMO_BASE_URL: undefined,
      XDG_CONFIG_HOME: "/tmp/nonexistent-config-dir",
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("does nothing when not configured", async () => {
    const { MomoPlugin } = await import("../index");
    const hooks = await MomoPlugin(makeMockCtx());
    const parts: Part[] = [];
    await hooks["chat.message"]!(
      { sessionID: "s1", messageID: "m1" },
      { message: {} as UserMessage, parts },
    );
    expect(parts).toHaveLength(0);
  });

  it("skips second call for same session", async () => {
    const { MomoPlugin } = await import("../index");
    const hooks = await MomoPlugin(makeMockCtx());

    const parts1: Part[] = [];
    await hooks["chat.message"]!(
      { sessionID: "s-dedup", messageID: "m1" },
      { message: {} as UserMessage, parts: parts1 },
    );

    const parts2: Part[] = [];
    await hooks["chat.message"]!(
      { sessionID: "s-dedup", messageID: "m2" },
      { message: {} as UserMessage, parts: parts2 },
    );

    expect(parts2).toHaveLength(0);
  });

  it("allows different sessions", async () => {
    const { MomoPlugin } = await import("../index");
    const hooks = await MomoPlugin(makeMockCtx());

    const parts1: Part[] = [];
    await hooks["chat.message"]!(
      { sessionID: "s-a", messageID: "m1" },
      { message: {} as UserMessage, parts: parts1 },
    );

    const parts2: Part[] = [];
    await hooks["chat.message"]!(
      { sessionID: "s-b", messageID: "m2" },
      { message: {} as UserMessage, parts: parts2 },
    );

    expect(parts1).toHaveLength(0);
    expect(parts2).toHaveLength(0);
  });
});
