import { VERSION } from "../src/index.ts";
import { describe, it } from "bun:test";
import assert from "node:assert";

describe("VERSION", () => {
  it("is defined", () => {
    assert.strictEqual(VERSION, "0.0.1");
  });
});
