import { describe, expect, it } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { MomoPiClient } from "../client";
import type { MomoPiConfig } from "../config";
import { registerCommands } from "../commands/slash";

type CommandHandler = (args: string, ctx: ExtensionContext) => Promise<void>;

describe("slash commands", () => {
  it("registers /momo-debug and emits effective config", async () => {
    const handlers = new Map<string, CommandHandler>();

    const mockApi: Partial<ExtensionAPI> = {
      registerCommand: (name: string, def: { handler: CommandHandler }) => {
        handlers.set(name, def.handler);
      },
    };

    const mockClient = {
      addMemory: async () => ({ id: "x" }),
      search: async () => [],
      getProfile: async () => ({ narrative: undefined, static: [], dynamic: [], searchResults: [] }),
    } as unknown as MomoPiClient;

    const cfg: MomoPiConfig = {
      baseUrl: "http://localhost:7638",
      apiKey: "1234567890abcdef",
      containerTag: "pi_test",
      autoRecall: true,
      autoCapture: true,
      maxRecallResults: 10,
      profileFrequency: 50,
      debug: false,
    };

    registerCommands(
      mockApi as ExtensionAPI,
      mockClient,
      () => undefined,
      cfg,
    );

    const debugHandler = handlers.get("momo-debug");
    expect(debugHandler).toBeDefined();

    const notifications: string[] = [];
    const ctx: ExtensionContext = {
      hasUI: true,
      sessionManager: {
        getSessionFile: () => undefined,
        appendEntry: async () => {},
        getLeafEntry: () => undefined,
      },
      ui: {
        notify: (message: string) => {
          notifications.push(message);
        },
        confirm: async () => false,
        select: async () => undefined,
        input: async () => undefined,
        setStatus: () => {},
        setWidget: () => {},
      },
    };

    await debugHandler?.("", ctx);

    const output = notifications.join("\n");
    expect(output).toContain("Momo config");
    expect(output).toContain("baseUrl: http://localhost:7638");
    expect(output).toContain("apiKey: 1234...cdef (16 chars)");
  });
});
