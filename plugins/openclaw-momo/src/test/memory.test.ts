import { describe, expect, it } from "bun:test";
import {
  buildDocumentId,
  detectCategory,
  toMemoryType,
} from "../memory";

describe("memory helpers", () => {
  it("detects preference category", () => {
    expect(detectCategory("I prefer fish tacos")).toBe("preference");
  });

  it("detects decision category", () => {
    expect(detectCategory("We decided to use Rust for this project")).toBe(
      "decision",
    );
  });

  it("detects fact category", () => {
    expect(detectCategory("This codebase has a monorepo structure")).toBe("fact");
  });

  it("maps categories to momo memory types", () => {
    expect(toMemoryType("preference")).toBe("preference");
    expect(toMemoryType("fact")).toBe("fact");
    expect(toMemoryType("entity")).toBe("fact");
    expect(toMemoryType("decision")).toBe("episode");
    expect(toMemoryType("other")).toBe("episode");
  });

  it("builds stable document ids from session keys", () => {
    expect(buildDocumentId("session/abc-123")).toBe("session_session_abc_123");
    expect(buildDocumentId("___foo___bar___")).toBe("session_foo_bar");
  });
});
