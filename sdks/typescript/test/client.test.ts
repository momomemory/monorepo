import { describe, it, expect } from "bun:test";
import { MomoClient } from "../src/client.ts";
import { MomoError } from "../src/error.ts";

function mockFetch(response: {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}) {
  const captured: Request[] = [];
  const fetchFn = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const req = new Request(input, init);
    captured.push(req.clone());
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json", ...response.headers },
    });
  };
  return { fetchFn, captured };
}

describe("MomoClient", () => {
  describe("auth header injection", () => {
    it("adds Authorization: Bearer header when apiKey is set", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { status: "ok", version: "1.0.0", uptime: 100 },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "test-key-123",
        fetch: fetchFn,
      });

      await client.health.check();

      expect(captured.length).toBe(1);
      expect(captured[0].headers.get("Authorization")).toBe(
        "Bearer test-key-123",
      );
    });

    it("omits Authorization header when no apiKey", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { status: "ok", version: "1.0.0", uptime: 100 },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        fetch: fetchFn,
      });

      await client.health.check();

      expect(captured.length).toBe(1);
      expect(captured[0].headers.get("Authorization")).toBeNull();
    });
  });

  describe("error normalization", () => {
    it("converts 401 error envelope to MomoError", async () => {
      const { fetchFn } = mockFetch({
        status: 401,
        body: {
          error: {
            code: "unauthorized",
            message: "Missing or invalid API key",
          },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        fetch: fetchFn,
      });

      try {
        await client.search.search({ q: "hello" });
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MomoError);
        const err = e as MomoError;
        expect(err.status).toBe(401);
        expect(err.code).toBe("unauthorized");
        expect(err.message).toBe("Missing or invalid API key");
      }
    });

    it("falls back to status-derived code when error envelope lacks code", async () => {
      const { fetchFn } = mockFetch({
        status: 404,
        body: {},
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        fetch: fetchFn,
      });

      try {
        await client.documents.get("nonexistent");
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MomoError);
        const err = e as MomoError;
        expect(err.status).toBe(404);
        expect(err.code).toBe("not_found");
      }
    });
  });

  describe("default containerTag", () => {
    it("applies defaultContainerTag when caller omits it", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { id: "doc-123", ingestionId: "ing-456" },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "key",
        defaultContainerTag: "my-container",
        fetch: fetchFn,
      });

      await client.documents.create({ content: "test content" });

      expect(captured.length).toBe(1);
      const body = await captured[0].json();
      expect(body.containerTag).toBe("my-container");
    });

    it("does not override explicit containerTag", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { id: "doc-123", ingestionId: "ing-456" },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "key",
        defaultContainerTag: "default-tag",
        fetch: fetchFn,
      });

      await client.documents.create({
        content: "test",
        containerTag: "explicit-tag",
      });

      expect(captured.length).toBe(1);
      const body = await captured[0].json();
      expect(body.containerTag).toBe("explicit-tag");
    });
  });

  describe("DELETE with body", () => {
    it("forgetById includes reason in DELETE body", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { id: "mem-123", forgotten: true },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "key",
        fetch: fetchFn,
      });

      await client.memories.forgetById("mem-123", {
        reason: "test reason",
      });

      expect(captured.length).toBe(1);
      expect(captured[0].method).toBe("DELETE");
      const body = await captured[0].json();
      expect(body.reason).toBe("test reason");
    });
  });

  describe("envelope unwrapping", () => {
    it("unwraps { data: ... } envelope from successful responses", async () => {
      const { fetchFn } = mockFetch({
        status: 200,
        body: {
          data: {
            id: "doc-123",
            title: "Test Doc",
            content: "hello world",
            containerTags: [],
            metadata: {},
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "key",
        fetch: fetchFn,
      });

      const doc = await client.documents.get("doc-123");

      expect(doc.id).toBe("doc-123");
      expect(doc.content).toBe("hello world");
      expect((doc as unknown as Record<string, unknown>).data).toBeUndefined();
    });

    it("passes through responses without data envelope", async () => {
      const { fetchFn } = mockFetch({
        status: 200,
        body: { status: "ok", version: "1.0.0", uptime: 100 },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        fetch: fetchFn,
      });

      const health = await client.health.check();
      expect(health.status).toBe("ok");
    });
  });

  describe("upload and uploadFromPath", () => {
    it("upload constructs multipart request with file field and auth", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { id: "doc-upload-1", ingestionId: "ing-789" },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "test-key-upload",
        fetch: fetchFn,
      });

      const blob = new Blob(["test file content"], { type: "text/plain" });
      await client.documents.upload(blob);

      expect(captured.length).toBe(1);
      expect(captured[0].method).toBe("POST");
      expect(captured[0].headers.get("Authorization")).toBe(
        "Bearer test-key-upload",
      );

      const formData = await captured[0].formData();
      const fileField = formData.get("file");
      expect(fileField).toBeTruthy();
      expect(fileField).toBeInstanceOf(Blob);
    });

    it("upload includes defaultContainerTag in formData", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { id: "doc-upload-2", ingestionId: "ing-790" },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "key",
        defaultContainerTag: "upload-tag",
        fetch: fetchFn,
      });

      const blob = new Blob(["test"], { type: "text/plain" });
      await client.documents.upload(blob);

      const formData = await captured[0].formData();
      expect(formData.get("containerTag")).toBe("upload-tag");
    });

    it("uploadFromPath reads file from disk and sends via multipart", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { id: "doc-upload-3", ingestionId: "ing-791" },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "key",
        fetch: fetchFn,
      });

      const fixturePath = `${import.meta.dirname}/fixtures/sample.txt`;
      await client.documents.uploadFromPath(fixturePath);

      expect(captured.length).toBe(1);
      expect(captured[0].method).toBe("POST");

      const formData = await captured[0].formData();
      const fileField = formData.get("file");
      expect(fileField).toBeTruthy();
      expect(fileField).toBeInstanceOf(File);
      expect((fileField as File).name).toBe("sample.txt");
    });

    it("upload includes extractMemories and contentType fields", async () => {
      const { fetchFn, captured } = mockFetch({
        status: 200,
        body: {
          data: { id: "doc-upload-4", ingestionId: "ing-792" },
        },
      });

      const client = new MomoClient({
        baseUrl: "http://localhost:3000",
        apiKey: "key",
        fetch: fetchFn,
      });

      const blob = new Blob(["audio bytes"], { type: "audio/mpeg" });
      await client.documents.upload(blob, {
        extractMemories: true,
        contentType: "audio/mpeg",
      });

      const formData = await captured[0].formData();
      expect(formData.get("extractMemories")).toBe("true");
      expect(formData.get("contentType")).toBe("audio/mpeg");
    });
  });
});
