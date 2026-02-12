import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { parseConfig } from "../config";

const ENV_KEYS = [
  "MOMO_BASE_URL",
  "MOMO_API_KEY",
  "MOMO_OPENCLAW_BASE_URL",
  "MOMO_OPENCLAW_API_KEY",
];

const savedEnv: Record<string, string | undefined> = {};

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("openclaw-momo config", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, savedEnv[key]);
    }
  });

  it("uses defaults when empty", () => {
    const cfg = parseConfig(undefined);
    expect(cfg.baseUrl).toBe("http://localhost:3000");
    expect(cfg.autoRecall).toBe(true);
    expect(cfg.autoCapture).toBe(true);
    expect(cfg.maxRecallResults).toBe(10);
    expect(cfg.profileFrequency).toBe(50);
    expect(cfg.captureMode).toBe("all");
    expect(cfg.containerTag).toMatch(/^oclw_[A-Za-z0-9_]+$/);
  });

  it("prefers plugin config values", () => {
    const cfg = parseConfig({
      baseUrl: "http://momo.local:3333",
      apiKey: "abc123",
      containerTag: "my-project/tag",
      autoRecall: false,
      autoCapture: false,
      maxRecallResults: 99,
      profileFrequency: 0,
      captureMode: "everything",
      debug: true,
    });

    expect(cfg.baseUrl).toBe("http://momo.local:3333");
    expect(cfg.apiKey).toBe("abc123");
    expect(cfg.containerTag).toBe("my_project_tag");
    expect(cfg.autoRecall).toBe(false);
    expect(cfg.autoCapture).toBe(false);
    expect(cfg.maxRecallResults).toBe(20);
    expect(cfg.profileFrequency).toBe(1);
    expect(cfg.captureMode).toBe("everything");
    expect(cfg.debug).toBe(true);
  });

  it("falls back to env vars", () => {
    process.env.MOMO_OPENCLAW_BASE_URL = "http://from-openclaw-env";
    process.env.MOMO_OPENCLAW_API_KEY = "openclaw-key";

    const cfg = parseConfig({});
    expect(cfg.baseUrl).toBe("http://from-openclaw-env");
    expect(cfg.apiKey).toBe("openclaw-key");
  });

  it("ignores generic momo env vars", () => {
    process.env.MOMO_BASE_URL = "http://from-momo-env";
    process.env.MOMO_API_KEY = "momo-key";

    const cfg = parseConfig({});
    expect(cfg.baseUrl).toBe("http://localhost:3000");
    expect(cfg.apiKey).toBeUndefined();
  });

  it("resolves ${ENV_VAR} placeholders", () => {
    process.env.MY_MOMO_URL = "http://placeholder-url";
    const cfg = parseConfig({ baseUrl: "${MY_MOMO_URL}" });
    expect(cfg.baseUrl).toBe("http://placeholder-url");
    delete process.env.MY_MOMO_URL;
  });

  it("ignores unknown keys", () => {
    const cfg = parseConfig({ nope: true });
    expect(cfg.baseUrl).toBe("http://localhost:3000");
  });
});
