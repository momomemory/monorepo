import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { PluginInput, ToolDefinition } from "@opencode-ai/plugin";
import type { ToolContext } from "@opencode-ai/plugin";
import type { Hooks } from "@opencode-ai/plugin";

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

function makeToolContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    directory: "/tmp/test-project",
    worktree: "/tmp/test-project",
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => {},
    ...overrides,
  };
}

function getMomoTool(hooks: Hooks): ToolDefinition {
  const t = hooks.tool?.["momo"];
  if (!t) throw new Error("momo tool not found on hooks");
  return t;
}

function getTool(hooks: Hooks, name: string): ToolDefinition {
  const t = hooks.tool?.[name];
  if (!t) throw new Error(`${name} tool not found on hooks`);
  return t;
}

describe("momo tool", () => {
  beforeEach(() => {
    setEnv({
      MOMO_API_KEY: undefined,
      MOMO_BASE_URL: undefined,
      XDG_CONFIG_HOME: "/tmp/nonexistent-config-dir",
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  describe("help mode", () => {
    it("returns help text with available commands", async () => {
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      const result = await getMomoTool(hooks).execute(
        { mode: "help" } as never,
        makeToolContext(),
      );
      expect(result).toContain("Momo Memory Commands");
      expect(result).toContain("help");
      expect(result).toContain("add");
      expect(result).toContain("search");
      expect(result).toContain("profile");
      expect(result).toContain("list");
      expect(result).toContain("forget");
    });
  });

  describe("tool registration", () => {
    it("registers ingestion-focused tools", async () => {
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());

      expect(getTool(hooks, "momo_ingest")).toBeTruthy();
      expect(getTool(hooks, "momo_ocr")).toBeTruthy();
      expect(getTool(hooks, "momo_transcribe")).toBeTruthy();
    });
  });

  describe("unconfigured state", () => {
    it("add mode throws when not configured", async () => {
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      try {
        await getMomoTool(hooks).execute(
          { mode: "add", content: "test" } as never,
          makeToolContext(),
        );
        expect(true).toBe(false);
      } catch (e: unknown) {
        expect((e as Error).message).toContain("not configured");
      }
    });

    it("search mode throws when not configured", async () => {
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      try {
        await getMomoTool(hooks).execute(
          { mode: "search", query: "test" } as never,
          makeToolContext(),
        );
        expect(true).toBe(false);
      } catch (e: unknown) {
        expect((e as Error).message).toContain("not configured");
      }
    });

    it("list mode throws when not configured", async () => {
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      try {
        await getMomoTool(hooks).execute(
          { mode: "list" } as never,
          makeToolContext(),
        );
        expect(true).toBe(false);
      } catch (e: unknown) {
        expect((e as Error).message).toContain("not configured");
      }
    });

    it("forget mode throws when not configured", async () => {
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      try {
        await getMomoTool(hooks).execute(
          { mode: "forget", memoryId: "mem_123" } as never,
          makeToolContext(),
        );
        expect(true).toBe(false);
      } catch (e: unknown) {
        expect((e as Error).message).toContain("not configured");
      }
    });

    it("profile mode throws when not configured", async () => {
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      try {
        await getMomoTool(hooks).execute(
          { mode: "profile" } as never,
          makeToolContext(),
        );
        expect(true).toBe(false);
      } catch (e: unknown) {
        expect((e as Error).message).toContain("not configured");
      }
    });
  });

  describe("validation errors", () => {
    it("add without content returns error", async () => {
      setEnv({ MOMO_API_KEY: "test-key" });
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      const result = await getMomoTool(hooks).execute(
        { mode: "add" } as never,
        makeToolContext(),
      );
      expect(result).toContain("'content' is required");
    });

    it("add with fully private content returns error", async () => {
      setEnv({ MOMO_API_KEY: "test-key" });
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      const result = await getMomoTool(hooks).execute(
        { mode: "add", content: "<private>secret stuff</private>" } as never,
        makeToolContext(),
      );
      expect(result).toContain("entirely private");
    });

    it("search without query returns error", async () => {
      setEnv({ MOMO_API_KEY: "test-key" });
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      const result = await getMomoTool(hooks).execute(
        { mode: "search" } as never,
        makeToolContext(),
      );
      expect(result).toContain("'query' is required");
    });

    it("forget without memoryId returns error", async () => {
      setEnv({ MOMO_API_KEY: "test-key" });
      const { MomoPlugin } = await import("../index");
      const hooks = await MomoPlugin(makeMockCtx());
      const result = await getMomoTool(hooks).execute(
        { mode: "forget" } as never,
        makeToolContext(),
      );
      expect(result).toContain("'memoryId' is required");
    });
  });
});
