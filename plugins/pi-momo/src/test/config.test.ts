import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, loadConfigWithMeta } from "../config";

const ENV_KEYS = [
  "MOMO_BASE_URL",
  "MOMO_API_KEY",
  "MOMO_PI_BASE_URL",
  "MOMO_PI_API_KEY",
  "MOMO_PI_CONTAINER_TAG",
  "MOMO_PI_AUTO_RECALL",
  "MOMO_PI_AUTO_CAPTURE",
  "MOMO_PI_MAX_RECALL_RESULTS",
  "MOMO_PI_PROFILE_FREQUENCY",
  "MOMO_PI_DEBUG",
];

const savedEnv: Record<string, string | undefined> = {};

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("pi-momo config", () => {
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

  it("uses defaults when no config exists", () => {
    const cfg = loadConfig("/nonexistent/path");
    expect(cfg.baseUrl).toBe("http://localhost:3000");
    expect(cfg.autoRecall).toBe(true);
    expect(cfg.autoCapture).toBe(true);
    expect(cfg.maxRecallResults).toBe(10);
    expect(cfg.profileFrequency).toBe(50);
    expect(cfg.containerTag).toMatch(/^pi_[A-Za-z0-9_]+$/);
    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.debug).toBe(false);
  });

  it("reads config from env vars", () => {
    process.env.MOMO_PI_BASE_URL = "http://from-pi-env";
    process.env.MOMO_PI_API_KEY = "pi-key";
    process.env.MOMO_PI_CONTAINER_TAG = "my-custom-tag";
    process.env.MOMO_PI_AUTO_RECALL = "false";
    process.env.MOMO_PI_MAX_RECALL_RESULTS = "5";

    const cfg = loadConfig("/nonexistent/path");
    expect(cfg.baseUrl).toBe("http://from-pi-env");
    expect(cfg.apiKey).toBe("pi-key");
    expect(cfg.containerTag).toBe("my_custom_tag");
    expect(cfg.autoRecall).toBe(false);
    expect(cfg.maxRecallResults).toBe(5);
  });

  it("falls back to MOMO_* env vars if MOMO_PI_* not set", () => {
    process.env.MOMO_BASE_URL = "http://from-momo-env";
    process.env.MOMO_API_KEY = "momo-key";

    const cfg = loadConfig("/nonexistent/path");
    expect(cfg.baseUrl).toBe("http://from-momo-env");
    expect(cfg.apiKey).toBe("momo-key");
  });

  it("MOMO_PI_* takes precedence over MOMO_*", () => {
    process.env.MOMO_BASE_URL = "http://momo-url";
    process.env.MOMO_PI_BASE_URL = "http://pi-url";

    const cfg = loadConfig("/nonexistent/path");
    expect(cfg.baseUrl).toBe("http://pi-url");
  });

  it("resolves ${ENV_VAR} placeholders in config values", () => {
    process.env.MY_MOMO_URL = "http://placeholder-url";
    process.env.MOMO_PI_BASE_URL = "${MY_MOMO_URL}";

    const cfg = loadConfig("/nonexistent/path");
    expect(cfg.baseUrl).toBe("http://placeholder-url");
    delete process.env.MY_MOMO_URL;
  });

  it("bounds maxRecallResults between 1 and 20", () => {
    process.env.MOMO_PI_MAX_RECALL_RESULTS = "-5";
    const cfg1 = loadConfig("/nonexistent/path");
    expect(cfg1.maxRecallResults).toBe(1);

    process.env.MOMO_PI_MAX_RECALL_RESULTS = "100";
    const cfg2 = loadConfig("/nonexistent/path");
    expect(cfg2.maxRecallResults).toBe(20);
  });

  it("bounds profileFrequency between 1 and 500", () => {
    process.env.MOMO_PI_PROFILE_FREQUENCY = "-5";
    const cfg1 = loadConfig("/nonexistent/path");
    expect(cfg1.profileFrequency).toBe(1);

    process.env.MOMO_PI_PROFILE_FREQUENCY = "1000";
    const cfg2 = loadConfig("/nonexistent/path");
    expect(cfg2.profileFrequency).toBe(500);
  });

  it("parses string boolean values", () => {
    process.env.MOMO_PI_AUTO_RECALL = "true";
    process.env.MOMO_PI_AUTO_CAPTURE = "false";
    process.env.MOMO_PI_DEBUG = "yes";

    const cfg = loadConfig("/nonexistent/path");
    expect(cfg.autoRecall).toBe(true);
    expect(cfg.autoCapture).toBe(false);
    expect(cfg.debug).toBe(true);
  });

  it("reports source metadata for env overrides", () => {
    process.env.MOMO_PI_BASE_URL = "http://from-pi-env";
    const { config, meta } = loadConfigWithMeta("/nonexistent/path");
    expect(config.baseUrl).toBe("http://from-pi-env");
    expect(meta.sources.baseUrl).toBe("env:MOMO_PI");
  });
});

describe("pi-momo config files", () => {
  const tempDir = join("/tmp", `momo-test-${Date.now()}`);

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, savedEnv[key]);
    }
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reads project .momo.jsonc file", () => {
    writeFileSync(
      join(tempDir, ".momo.jsonc"),
      JSON.stringify({ baseUrl: "http://project-config", apiKey: "project-key" }),
    );

    const cfg = loadConfig(tempDir);
    expect(cfg.baseUrl).toBe("http://project-config");
    expect(cfg.apiKey).toBe("project-key");
  });

  it("reads project momo.jsonc file", () => {
    writeFileSync(
      join(tempDir, "momo.jsonc"),
      JSON.stringify({ baseUrl: "http://project-plain-config" }),
    );

    const cfg = loadConfig(tempDir);
    expect(cfg.baseUrl).toBe("http://project-plain-config");
  });

  it("prefers .momo.jsonc over momo.jsonc", () => {
    writeFileSync(join(tempDir, ".momo.jsonc"), JSON.stringify({ baseUrl: "http://dot-config" }));
    writeFileSync(join(tempDir, "momo.jsonc"), JSON.stringify({ baseUrl: "http://plain-config" }));

    const cfg = loadConfig(tempDir);
    expect(cfg.baseUrl).toBe("http://dot-config");
  });

  it("supports JSONC with comments", () => {
    writeFileSync(
      join(tempDir, ".momo.jsonc"),
      `{
  // Global Momo config
  "baseUrl": "http://jsonc-config",
  /* API key for auth */
  "apiKey": "jsonc-key"
}`,
    );

    const cfg = loadConfig(tempDir);
    expect(cfg.baseUrl).toBe("http://jsonc-config");
    expect(cfg.apiKey).toBe("jsonc-key");
  });

  it("env vars override project config", () => {
    writeFileSync(join(tempDir, ".momo.jsonc"), JSON.stringify({ baseUrl: "http://project-config" }));
    process.env.MOMO_PI_BASE_URL = "http://env-override";

    const cfg = loadConfig(tempDir);
    expect(cfg.baseUrl).toBe("http://env-override");
  });

  it("sanitizes container tags", () => {
    process.env.MOMO_PI_CONTAINER_TAG = "my-project/name with spaces";

    const cfg = loadConfig(tempDir);
    expect(cfg.containerTag).toBe("my_project_name_with_spaces");
  });

  it("reports project file and source metadata", () => {
    writeFileSync(join(tempDir, ".momo.jsonc"), JSON.stringify({ baseUrl: "http://dot-config" }));

    const { meta } = loadConfigWithMeta(tempDir);
    expect(meta.files.project).toBe(join(tempDir, ".momo.jsonc"));
    expect(meta.sources.baseUrl).toBe("project");
  });
});
