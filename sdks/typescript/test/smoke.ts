/**
 * Smoke test: runs against a LIVE Momo server.
 *
 * Expects:
 *   - Server running at http://127.0.0.1:3100
 *   - MOMO_API_KEYS includes "test-key-123"
 *
 * Usage:
 *   bun run test/smoke.ts
 */

import { MomoClient } from "../src/client.ts";
import { MomoError } from "../src/error.ts";

const BASE_URL = "http://127.0.0.1:3100";
const API_KEY = "test-key-123";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

// ─── 1. Health check (public, no auth) ───────────────────────────────

console.log("\n🔍 Test 1: Health check (no auth)");
{
  const client = new MomoClient({ baseUrl: BASE_URL });
  const health = await client.health.check();
  assert(health.status === "ok", `health.status === "ok" (got "${health.status}")`);
  assert(typeof health.version === "string", `health.version is a string (got "${health.version}")`);
  assert(health.database.status === "ok", `health.database.status === "ok" (got "${health.database.status}")`);
}

// ─── 2. Unauthorized call throws MomoError ───────────────────────────

console.log("\n🔍 Test 2: Unauthorized search throws MomoError");
{
  const client = new MomoClient({ baseUrl: BASE_URL }); // no apiKey
  try {
    await client.search.search({ q: "hello" });
    assert(false, "should have thrown MomoError");
  } catch (e) {
    assert(e instanceof MomoError, `error is MomoError (got ${(e as Error).constructor.name})`);
    if (e instanceof MomoError) {
      assert(e.status === 401, `status === 401 (got ${e.status})`);
      assert(e.code === "unauthorized", `code === "unauthorized" (got "${e.code}")`);
    }
  }
}

// ─── 3. Create a document (authed) ───────────────────────────────────

console.log("\n🔍 Test 3: Create document (authed)");
let docId: string | undefined;
{
  const client = new MomoClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    defaultContainerTag: "smoke-test",
  });

  const result = await client.documents.create({
    content: "Momo is a self-hostable AI memory system written in Rust.",
  });

  docId = result.documentId;
  assert(typeof result.documentId === "string" && result.documentId.length > 0, `got document id: "${result.documentId}"`);
  assert(
    typeof result.ingestionId === "string" && result.ingestionId.length > 0,
    `got ingestionId: "${result.ingestionId}"`,
  );
}

// ─── 4. Get the created document ─────────────────────────────────────

console.log("\n🔍 Test 4: Get document by ID");
{
  const client = new MomoClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
  });

  const doc = await client.documents.get(docId!);
  assert(doc.documentId === docId, `doc.documentId matches (got "${doc.documentId}")`);
  assert(
    typeof doc.content === "string" && doc.content.includes("Momo"),
    `doc.content contains "Momo"`,
  );
}

// ─── 5. List documents ───────────────────────────────────────────────

console.log("\n🔍 Test 5: List documents");
{
  const client = new MomoClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
  });

  const result = await client.documents.list({
    containerTags: ["smoke-test"],
    limit: 10,
  });

  // The list response has a documents array
  assert(Array.isArray(result.documents), `result.documents is an array`);
  assert(result.documents.length >= 1, `at least 1 document returned (got ${result.documents.length})`);
}

// ─── 6. Search (authed, should work even if no embeddings yet) ──────

console.log("\n🔍 Test 6: Search (authed)");
{
  const client = new MomoClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
  });

  try {
    const results = await client.search.search({
      q: "Momo memory system",
      containerTags: ["smoke-test"],
      limit: 5,
    });
    // Search might return empty if embeddings haven't been processed yet — that's fine
    assert(Array.isArray(results.results), `results.results is an array`);
    console.log(`    (got ${results.results.length} results — may be 0 if embeddings are still processing)`);
  } catch (e) {
    // Some search errors might happen if embedding model isn't loaded — not a SDK problem
    if (e instanceof MomoError && e.status >= 500) {
      console.log(`    ⚠️  Search returned ${e.status}: ${e.message} (server-side issue, not SDK)`);
    } else {
      throw e;
    }
  }
}

// ─── 7. Delete the document (cleanup) ────────────────────────────────

console.log("\n🔍 Test 7: Delete document (cleanup)");
{
  const client = new MomoClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
  });

  await client.documents.delete(docId!);
  assert(true, `document ${docId} deleted successfully`);

  // Verify it's gone
  try {
    await client.documents.get(docId!);
    assert(false, "should have thrown 404");
  } catch (e) {
    assert(e instanceof MomoError && e.status === 404, `get after delete returns 404`);
  }
}

// ─── 8. raw client escape hatch works ────────────────────────────────

console.log("\n🔍 Test 8: client.raw escape hatch");
{
  const client = new MomoClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
  });

  const { data, error } = await client.raw.GET("/api/v1/health");
  assert(error === undefined, `raw.GET /health has no error`);
  assert(data?.status === "ok", `raw health.status === "ok"`);
}

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Smoke test: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);
