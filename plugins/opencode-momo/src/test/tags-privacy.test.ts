import { describe, it, expect } from "bun:test";
import os from "node:os";
import {
  simpleHash,
  userTag,
  projectTag,
  getTags,
  getTagsWithOverrides,
} from "../services/tags";
import { stripPrivateContent, isFullyPrivate } from "../services/privacy";

describe("tags service", () => {
  it("simpleHash is deterministic for same input", () => {
    const a = simpleHash("foobar");
    const b = simpleHash("foobar");
    expect(a).toBe(b);
  });

  it("userTag is deterministic for same username", () => {
    const username = os.userInfo().username || "unknown";
    const expected = `opencode-user-${simpleHash(username)}`;
    expect(userTag()).toBe(expected);
  });

  it("projectTag is deterministic for same directory", () => {
    const dir = "/tmp/myproject";
    const a = projectTag(dir);
    const b = projectTag(dir);
    expect(a).toBe(b);
  });

  it("different directories produce different projectTags", () => {
    const a = projectTag("/tmp/one");
    const b = projectTag("/tmp/two");
    expect(a).not.toBe(b);
  });

  it("overrides bypass hashing for user", () => {
    const overrides = { containerTagUser: "custom-user-tag" };
    const tags = getTagsWithOverrides("/tmp/foo", overrides);
    expect(tags.user).toBe("custom-user-tag");
  });

  it("overrides bypass hashing for project", () => {
    const overrides = { containerTagProject: "custom-project-tag" };
    const tags = getTagsWithOverrides("/tmp/foo", overrides);
    expect(tags.project).toBe("custom-project-tag");
  });
});

describe("privacy service", () => {
  it("single <private> block is stripped", () => {
    const input = "public<private>secret</private>more";
    expect(stripPrivateContent(input)).toBe("publicmore");
  });

  it("multiple <private> blocks are stripped", () => {
    const input = "a<private>1</private>b<private>2</private>c";
    expect(stripPrivateContent(input)).toBe("abc");
  });

  it("multiline <private> block is stripped", () => {
    const input = "start<private>line1\nline2\n</private>end";
    expect(stripPrivateContent(input)).toBe("startend");
  });

  it("content outside private blocks is preserved", () => {
    const input = "keep<private>drop</private>keep2";
    expect(stripPrivateContent(input)).toBe("keepkeep2");
  });

  it("isFullyPrivate returns true when entire input is private", () => {
    const input = "<private>all secret</private>";
    expect(isFullyPrivate(input)).toBe(true);
  });

  it("isFullyPrivate returns false when there's non-private content", () => {
    const input = "public<private>secret</private>";
    expect(isFullyPrivate(input)).toBe(false);
  });

  it("empty string after redaction -> isFullyPrivate true", () => {
    const input = "<private>\n</private>";
    expect(stripPrivateContent(input)).toBe("");
    expect(isFullyPrivate(input)).toBe(true);
  });
});
