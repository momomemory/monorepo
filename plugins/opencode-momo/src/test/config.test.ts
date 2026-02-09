import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, isConfigured, getConfigDir } from "../config";
import { stripJsoncComments } from "../services/jsonc";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vars[key];
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

describe("stripJsoncComments", () => {
  it("strips single-line comments", () => {
    const input = `{
  // this is a comment
  "key": "value"
}`;
    const result = JSON.parse(stripJsoncComments(input));
    expect(result).toEqual({ key: "value" });
  });

  it("strips multi-line comments", () => {
    const input = `{
  /* multi
     line
     comment */
  "key": "value"
}`;
    const result = JSON.parse(stripJsoncComments(input));
    expect(result).toEqual({ key: "value" });
  });

  it("preserves URLs inside strings", () => {
    const input = `{
  "url": "https://example.com/path"
}`;
    const result = JSON.parse(stripJsoncComments(input));
    expect(result).toEqual({ url: "https://example.com/path" });
  });

  it("removes trailing commas", () => {
    const input = `{
  "a": 1,
  "b": 2,
}`;
    const result = JSON.parse(stripJsoncComments(input));
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("handles escaped quotes in strings", () => {
    const input = `{
  "key": "value with \\"quotes\\""
}`;
    const result = JSON.parse(stripJsoncComments(input));
    expect(result).toEqual({ key: 'value with "quotes"' });
  });
});

describe("config", () => {
  let tempDir: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    tempDir = join(tmpdir(), `momo-test-${Date.now()}`);
    mkdirSync(join(tempDir, "opencode"), { recursive: true });

    savedEnv = {
      MOMO_API_KEY: process.env.MOMO_API_KEY,
      MOMO_BASE_URL: process.env.MOMO_BASE_URL,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    };

    delete process.env.MOMO_API_KEY;
    delete process.env.MOMO_BASE_URL;
    process.env.XDG_CONFIG_HOME = tempDir;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  });

  it("returns default baseUrl when no config exists", () => {
    const config = loadConfig();
    expect(config.baseUrl).toBe("http://localhost:3000");
    expect(config.apiKey).toBeUndefined();
  });

  it("reads values from config file", () => {
    const configContent = `{
  // Momo config
  "baseUrl": "http://custom:8080",
  "apiKey": "file-key-123",
  "containerTagUser": "my-user",
}`;
    writeFileSync(
      join(tempDir, "opencode", "momo.jsonc"),
      configContent,
      "utf-8",
    );

    const config = loadConfig();
    expect(config.baseUrl).toBe("http://custom:8080");
    expect(config.apiKey).toBe("file-key-123");
    expect(config.containerTagUser).toBe("my-user");
  });

  it("env vars override file values", () => {
    const configContent = `{
  "baseUrl": "http://file-url:8080",
  "apiKey": "file-key"
}`;
    writeFileSync(
      join(tempDir, "opencode", "momo.jsonc"),
      configContent,
      "utf-8",
    );

    withEnv(
      { MOMO_API_KEY: "env-key", MOMO_BASE_URL: "http://env-url:9090" },
      () => {
        const config = loadConfig();
        expect(config.baseUrl).toBe("http://env-url:9090");
        expect(config.apiKey).toBe("env-key");
      },
    );
  });

  it("isConfigured returns false when no API key", () => {
    expect(isConfigured()).toBe(false);
  });

  it("isConfigured returns true when MOMO_API_KEY is set", () => {
    withEnv({ MOMO_API_KEY: "test-key" }, () => {
      expect(isConfigured()).toBe(true);
    });
  });

  it("isConfigured returns true when apiKey is in config file", () => {
    writeFileSync(
      join(tempDir, "opencode", "momo.jsonc"),
      '{ "apiKey": "file-key" }',
      "utf-8",
    );
    expect(isConfigured()).toBe(true);
  });

  it("getConfigDir uses XDG_CONFIG_HOME when set", () => {
    const dir = getConfigDir();
    expect(dir).toBe(join(tempDir, "opencode"));
  });

  it("getConfigDir falls back to ~/.config/opencode", () => {
    withEnv({ XDG_CONFIG_HOME: undefined }, () => {
      const dir = getConfigDir();
      expect(dir).toEndWith(".config/opencode");
    });
  });
});
