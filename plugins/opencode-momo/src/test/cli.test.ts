import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  registerPluginInConfig,
  writeCommandFiles,
  writeMomoConfig,
} from "../cli";
import { stripJsoncComments } from "../services/jsonc";

describe("registerPluginInConfig", () => {
  let tempDir: string;
  let configDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `momo-cli-test-${Date.now()}`);
    configDir = join(tempDir, "opencode");
    mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  });

  it("creates config file when none exists", () => {
    const emptyDir = join(tempDir, "fresh");
    const changed = registerPluginInConfig(emptyDir);

    expect(changed).toBe(true);
    const content = readFileSync(join(emptyDir, "opencode.jsonc"), "utf-8");
    expect(content).toContain("@momomemory/opencode-momo@latest");
    expect(JSON.parse(content)).toEqual({
      plugin: ["@momomemory/opencode-momo@latest"],
    });
  });

  it("adds plugin to existing empty plugin array", () => {
    writeFileSync(
      join(configDir, "opencode.jsonc"),
      '{\n  "plugin": []\n}\n',
      "utf-8",
    );

    const changed = registerPluginInConfig(configDir);

    expect(changed).toBe(true);
    const content = readFileSync(join(configDir, "opencode.jsonc"), "utf-8");
    expect(content).toContain("@momomemory/opencode-momo@latest");
  });

  it("adds plugin to existing non-empty plugin array", () => {
    writeFileSync(
      join(configDir, "opencode.jsonc"),
      '{\n  "plugin": [\n    "some-other-plugin"\n  ]\n}\n',
      "utf-8",
    );

    const changed = registerPluginInConfig(configDir);

    expect(changed).toBe(true);
    const content = readFileSync(join(configDir, "opencode.jsonc"), "utf-8");
    expect(content).toContain("some-other-plugin");
    expect(content).toContain("@momomemory/opencode-momo@latest");
  });

  it("does NOT duplicate plugin entry (idempotency)", () => {
    writeFileSync(
      join(configDir, "opencode.jsonc"),
      '{\n  "plugin": [\n    "@momomemory/opencode-momo@latest"\n  ]\n}\n',
      "utf-8",
    );

    const changed = registerPluginInConfig(configDir);

    expect(changed).toBe(false);
    const content = readFileSync(join(configDir, "opencode.jsonc"), "utf-8");
    const matches = content.match(/@momomemory\/opencode-momo@latest/g);
    expect(matches).toHaveLength(1);
  });

  it("running install twice does NOT duplicate plugin entry", () => {
    registerPluginInConfig(configDir);
    const secondResult = registerPluginInConfig(configDir);

    expect(secondResult).toBe(false);
    const content = readFileSync(join(configDir, "opencode.jsonc"), "utf-8");
    const matches = content.match(/@momomemory\/opencode-momo@latest/g);
    expect(matches).toHaveLength(1);
  });

  it("preserves existing comments in JSONC", () => {
    const original = `{
  // My important comment
  "plugin": [
    "existing-plugin"
  ]
}`;
    writeFileSync(join(configDir, "opencode.jsonc"), original, "utf-8");

    registerPluginInConfig(configDir);

    const content = readFileSync(join(configDir, "opencode.jsonc"), "utf-8");
    expect(content).toContain("// My important comment");
    expect(content).toContain("existing-plugin");
    expect(content).toContain("@momomemory/opencode-momo@latest");
  });

  it("adds plugin key to config that has no plugin key", () => {
    writeFileSync(
      join(configDir, "opencode.jsonc"),
      '{\n  "theme": "dark"\n}\n',
      "utf-8",
    );

    const changed = registerPluginInConfig(configDir);

    expect(changed).toBe(true);
    const content = readFileSync(join(configDir, "opencode.jsonc"), "utf-8");
    expect(content).toContain('"plugin"');
    expect(content).toContain("@momomemory/opencode-momo@latest");
  });
});

describe("writeCommandFiles", () => {
  let tempDir: string;
  let configDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `momo-cli-test-${Date.now()}`);
    configDir = join(tempDir, "opencode");
    mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  });

  it("creates command directory and markdown files", () => {
    const result = writeCommandFiles(configDir);

    expect(result.initWritten).toBe(true);
    expect(result.configureWritten).toBe(true);
    expect(existsSync(join(configDir, "command", "momo-init.md"))).toBe(true);
    expect(existsSync(join(configDir, "command", "momo-configure.md"))).toBe(true);
  });

  it("momo-init.md has frontmatter and references momo tool", () => {
    writeCommandFiles(configDir);

    const content = readFileSync(join(configDir, "command", "momo-init.md"), "utf-8");
    expect(content).toContain("---");
    expect(content).toContain("description:");
    expect(content).toContain("momo(");
    expect(content).toContain('mode: "add"');
    expect(content).toContain('"user"');
    expect(content).toContain('"project"');
    expect(content).toContain("fact");
    expect(content).toContain("preference");
    expect(content).toContain("episode");
  });

  it("momo-configure.md references bunx command", () => {
    writeCommandFiles(configDir);

    const content = readFileSync(join(configDir, "command", "momo-configure.md"), "utf-8");
    expect(content).toContain("bunx @momomemory/opencode-momo configure");
    expect(content).toContain("MOMO_OPENCODE_BASE_URL");
    expect(content).toContain("MOMO_OPENCODE_API_KEY");
  });

  it("overwrites existing command files without error", () => {
    writeCommandFiles(configDir);
    const firstContent = readFileSync(join(configDir, "command", "momo-init.md"), "utf-8");

    writeCommandFiles(configDir);
    const secondContent = readFileSync(join(configDir, "command", "momo-init.md"), "utf-8");

    expect(firstContent).toBe(secondContent);
  });
});

describe("writeMomoConfig", () => {
  let tempDir: string;
  let configDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `momo-cli-test-${Date.now()}`);
    configDir = join(tempDir, "opencode");
    mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  });

  it("creates momo.jsonc with provided values", () => {
    writeMomoConfig(configDir, {
      baseUrl: "http://myserver:8080",
      apiKey: "test-key-123",
    });

    const raw = readFileSync(join(configDir, "momo.jsonc"), "utf-8");
    expect(raw).toContain('"opencode"');
    expect(raw).toContain('"baseUrl": "http://myserver:8080"');
    expect(raw).toContain('"apiKey": "test-key-123"');
    expect(raw).toContain('"containerTagUser": ""');
    expect(raw).toContain('"containerTagProject": ""');
  });

  it("uses default baseUrl when not provided", () => {
    writeMomoConfig(configDir, { apiKey: "my-key" });

    const raw = readFileSync(join(configDir, "momo.jsonc"), "utf-8");
    expect(raw).toContain('"baseUrl": "http://localhost:3000"');
    expect(raw).toContain('"apiKey": "my-key"');
    expect(raw).toContain('"containerTagUser": ""');
    expect(raw).toContain('"containerTagProject": ""');
  });

  it("writes valid JSONC that can be parsed after stripping comments", () => {
    writeMomoConfig(configDir, {
      baseUrl: "http://localhost:3000",
      apiKey: "secret",
    });

    const raw = readFileSync(join(configDir, "momo.jsonc"), "utf-8");
    const stripped = stripJsoncComments(raw);
    const parsed = JSON.parse(stripped);
    expect(parsed.opencode.baseUrl).toBe("http://localhost:3000");
    expect(parsed.opencode.apiKey).toBe("secret");
    expect(parsed.opencode.containerTagUser).toBe("");
    expect(parsed.opencode.containerTagProject).toBe("");
  });

  it("updates existing momo.jsonc without losing data", () => {
    writeMomoConfig(configDir, {
      baseUrl: "http://first:1111",
      apiKey: "first-key",
    });

    writeMomoConfig(configDir, { apiKey: "updated-key" });

    const raw = readFileSync(join(configDir, "momo.jsonc"), "utf-8");
    const parsed = JSON.parse(stripJsoncComments(raw));
    expect(parsed.opencode.apiKey).toBe("updated-key");
    expect(parsed.opencode.baseUrl).toBe("http://first:1111");
    expect(parsed.opencode.containerTagUser).toBe("");
    expect(parsed.opencode.containerTagProject).toBe("");
  });

  it("writes all config fields with defaults when values are not provided", () => {
    writeMomoConfig(configDir, { baseUrl: "http://localhost:3000" });

    const raw = readFileSync(join(configDir, "momo.jsonc"), "utf-8");
    expect(raw).toContain('"baseUrl"');
    expect(raw).toContain('"apiKey": ""');
    expect(raw).toContain('"containerTagUser": ""');
    expect(raw).toContain('"containerTagProject": ""');
  });

  it("preserves existing container tag overrides", () => {
    const configPath = join(configDir, "momo.jsonc");
    writeFileSync(
      configPath,
      '{\n  "opencode": {\n    "baseUrl": "http://localhost:3000",\n    "apiKey": "",\n    "containerTagUser": "user-tag",\n    "containerTagProject": "project-tag"\n  }\n}\n',
      "utf-8",
    );

    writeMomoConfig(configDir, {});

    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(stripJsoncComments(raw));
    expect(parsed.opencode.containerTagUser).toBe("user-tag");
    expect(parsed.opencode.containerTagProject).toBe("project-tag");
  });
});
