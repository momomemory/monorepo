"""Core client tests: auth, error handling, envelope, defaultContainerTag."""

from __future__ import annotations

import httpx
import pytest
import respx

from momo_sdk import AsyncMomoClient, MomoClient, MomoError
from momo_sdk.models import HealthData

BASE_URL = "http://test.momo.local"
API_KEY = "test-key-abc"


def _wrap(data: object) -> dict:
    return {"data": data}


HEALTH_DATA = {
    "status": "ok",
    "version": "0.1.0",
    "database": {"status": "ok"},
    "embeddings": {"status": "ok", "model": "nomic", "dimensions": 768},
    "llm": {"status": "ok", "model": "gpt-4o", "provider": "openai"},
    "reranker": {"enabled": False, "status": "disabled"},
}


# ===========================================================================
# Auth header injection
# ===========================================================================


@respx.mock
def test_sync_injects_bearer_header():
    route = respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(200, json=_wrap(HEALTH_DATA))
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    client.health.check()

    assert route.called
    sent = route.calls[0].request
    assert sent.headers["authorization"] == f"Bearer {API_KEY}"


@respx.mock
@pytest.mark.asyncio
async def test_async_injects_bearer_header():
    route = respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(200, json=_wrap(HEALTH_DATA))
    )
    client = AsyncMomoClient(base_url=BASE_URL, api_key=API_KEY)
    await client.health.check()

    assert route.called
    sent = route.calls[0].request
    assert sent.headers["authorization"] == f"Bearer {API_KEY}"


@respx.mock
def test_sync_dynamic_api_key():
    route = respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(200, json=_wrap(HEALTH_DATA))
    )
    client = MomoClient(base_url=BASE_URL, get_api_key=lambda: "dynamic-key")
    client.health.check()

    sent = route.calls[0].request
    assert sent.headers["authorization"] == "Bearer dynamic-key"


@respx.mock
@pytest.mark.asyncio
async def test_async_dynamic_api_key():
    route = respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(200, json=_wrap(HEALTH_DATA))
    )

    async def get_key() -> str:
        return "async-key"

    client = AsyncMomoClient(base_url=BASE_URL, get_api_key=get_key)
    await client.health.check()

    sent = route.calls[0].request
    assert sent.headers["authorization"] == "Bearer async-key"


@respx.mock
def test_no_auth_header_when_no_key():
    route = respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(200, json=_wrap(HEALTH_DATA))
    )
    client = MomoClient(base_url=BASE_URL)
    client.health.check()

    sent = route.calls[0].request
    assert "authorization" not in sent.headers


# ===========================================================================
# Envelope unwrapping
# ===========================================================================


@respx.mock
def test_sync_unwraps_data_envelope():
    respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(200, json=_wrap(HEALTH_DATA))
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    result = client.health.check()

    assert isinstance(result, HealthData)
    assert result.status == "ok"
    assert result.version == "0.1.0"


@respx.mock
@pytest.mark.asyncio
async def test_async_unwraps_data_envelope():
    respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(200, json=_wrap(HEALTH_DATA))
    )
    client = AsyncMomoClient(base_url=BASE_URL, api_key=API_KEY)
    result = await client.health.check()

    assert isinstance(result, HealthData)
    assert result.status == "ok"


# ===========================================================================
# Error normalisation
# ===========================================================================


@respx.mock
def test_404_raises_momo_error_not_found():
    respx.get(f"{BASE_URL}/api/v1/documents/nonexistent").mock(
        return_value=httpx.Response(
            404,
            json={"error": {"code": "not_found", "message": "Document not found"}},
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    with pytest.raises(MomoError) as exc_info:
        client.documents.get("nonexistent")

    err = exc_info.value
    assert err.status == 404
    assert err.code == "not_found"
    assert "Document not found" in str(err)


@respx.mock
def test_401_raises_momo_error_unauthorized():
    respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(
            401, json={"error": {"code": "unauthorized", "message": "Unauthorized"}}
        )
    )
    client = MomoClient(base_url=BASE_URL)
    with pytest.raises(MomoError) as exc_info:
        client.health.check()

    assert exc_info.value.status == 401
    assert exc_info.value.code == "unauthorized"


@respx.mock
def test_500_raises_momo_error_internal():
    respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(
            500, json={"error": {"code": "internal_error", "message": "boom"}}
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    with pytest.raises(MomoError) as exc_info:
        client.health.check()

    assert exc_info.value.code == "internal_error"


@respx.mock
@pytest.mark.asyncio
async def test_async_error_normalisation():
    respx.get(f"{BASE_URL}/api/v1/health").mock(
        return_value=httpx.Response(
            403,
            json={"error": {"code": "unauthorized", "message": "Forbidden"}},
        )
    )
    client = AsyncMomoClient(base_url=BASE_URL)
    with pytest.raises(MomoError) as exc_info:
        await client.health.check()

    assert exc_info.value.status == 403
    assert exc_info.value.code == "unauthorized"


# ===========================================================================
# defaultContainerTag
# ===========================================================================


@respx.mock
def test_default_container_tag_applied_to_search():
    route = respx.post(f"{BASE_URL}/api/v1/search").mock(
        return_value=httpx.Response(
            200,
            json=_wrap({"results": [], "total": 0, "timingMs": 1.0}),
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY, default_container_tag="user-999")
    client.search.search("hello")

    import json

    body = json.loads(route.calls[0].request.content)
    assert body["containerTags"] == ["user-999"]


@respx.mock
def test_explicit_container_tags_override_default():
    route = respx.post(f"{BASE_URL}/api/v1/search").mock(
        return_value=httpx.Response(
            200,
            json=_wrap({"results": [], "total": 0, "timingMs": 1.0}),
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY, default_container_tag="default")
    client.search.search("hello", container_tags=["explicit"])

    import json

    body = json.loads(route.calls[0].request.content)
    assert body["containerTags"] == ["explicit"]


@respx.mock
def test_default_container_tag_applied_to_documents_list():
    route = respx.get(f"{BASE_URL}/api/v1/documents").mock(
        return_value=httpx.Response(200, json=_wrap({"documents": []}))
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY, default_container_tag="tenant-1")
    client.documents.list()

    assert route.calls[0].request.url.params.get_list("containerTags") == ["tenant-1"]


@respx.mock
def test_documents_list_preserves_pagination_meta():
    respx.get(f"{BASE_URL}/api/v1/documents").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": {"documents": []},
                "meta": {"nextCursor": "next-docs", "total": 42},
            },
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    result = client.documents.list(limit=10)

    assert result.meta is not None
    assert result.meta.next_cursor == "next-docs"
    assert result.meta.total == 42


@respx.mock
def test_memories_list_preserves_pagination_meta():
    respx.get(f"{BASE_URL}/api/v1/memories").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": {"memories": []},
                "meta": {"nextCursor": "next-memories", "total": 7},
            },
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    result = client.memories.list(limit=5)

    assert result.meta is not None
    assert result.meta.next_cursor == "next-memories"
    assert result.meta.total == 7


@respx.mock
def test_sdk_uses_server_route_shapes():
    batch = respx.post(f"{BASE_URL}/api/v1/documents:batch").mock(
        return_value=httpx.Response(
            200,
            json=_wrap({"documents": [{"documentId": "doc-1", "ingestionId": "ing-1"}]}),
        )
    )
    update_doc = respx.patch(f"{BASE_URL}/api/v1/documents/doc-1").mock(
        return_value=httpx.Response(
            200,
            json=_wrap(
                {
                    "documentId": "doc-1",
                    "docType": "text",
                    "ingestionStatus": "completed",
                    "metadata": {},
                    "containerTags": [],
                    "chunkCount": 0,
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z",
                }
            ),
        )
    )
    ingestion = respx.get(f"{BASE_URL}/api/v1/ingestions/ing-1").mock(
        return_value=httpx.Response(
            200,
            json=_wrap(
                {
                    "documentId": "doc-1",
                    "status": "completed",
                    "createdAt": "2024-01-01T00:00:00Z",
                }
            ),
        )
    )
    update_memory = respx.patch(f"{BASE_URL}/api/v1/memories/mem-1").mock(
        return_value=httpx.Response(
            200,
            json=_wrap(
                {
                    "memoryId": "mem-1",
                    "content": "updated",
                    "version": 2,
                    "createdAt": "2024-01-01T00:00:00Z",
                }
            ),
        )
    )
    memory_graph = respx.get(f"{BASE_URL}/api/v1/memories/mem-1/graph").mock(
        return_value=httpx.Response(200, json=_wrap({"nodes": [], "links": []}))
    )
    container_graph = respx.get(f"{BASE_URL}/api/v1/containers/tenant-1/graph").mock(
        return_value=httpx.Response(200, json=_wrap({"nodes": [], "links": []}))
    )
    profile = respx.post(f"{BASE_URL}/api/v1/profile:compute").mock(
        return_value=httpx.Response(
            200,
            json=_wrap(
                {
                    "containerTag": "tenant-1",
                    "staticFacts": [],
                    "dynamicFacts": [],
                    "totalMemories": 0,
                    "lastUpdated": "2024-01-01T00:00:00Z",
                }
            ),
        )
    )
    conversations = respx.post(f"{BASE_URL}/api/v1/conversations:ingest").mock(
        return_value=httpx.Response(
            200,
            json=_wrap({"memoriesExtracted": 0, "memoryIds": [], "sessionId": "sess-1"}),
        )
    )
    admin = respx.post(f"{BASE_URL}/api/v1/admin/forgetting:run").mock(
        return_value=httpx.Response(
            200,
            json=_wrap({"memoriesForgotten": 0, "memoriesEvaluated": 0}),
        )
    )

    client = MomoClient(base_url=BASE_URL, api_key=API_KEY, default_container_tag="tenant-1")

    batch_result = client.documents.batch_create([{"content": "hello"}])
    client.documents.update("doc-1", title="Updated title")
    client.documents.get_ingestion_status("ing-1")
    client.memories.update("mem-1", content="updated")
    client.graph.get_memory_graph("mem-1")
    client.graph.get_container_graph("tenant-1")
    client.profile.compute()
    client.conversations.ingest([{"role": "user", "content": "hello"}])
    client.admin.run_forgetting()

    assert batch.called
    assert update_doc.called
    assert ingestion.called
    assert update_memory.called
    assert memory_graph.called
    assert container_graph.called
    assert profile.called
    assert conversations.called
    assert admin.called
    assert batch_result.documents[0].document_id == "doc-1"


# ===========================================================================
# Raw client access
# ===========================================================================


def test_raw_client_is_httpx_client():
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    assert isinstance(client.raw, httpx.Client)


def test_async_raw_client_is_httpx_async_client():
    client = AsyncMomoClient(base_url=BASE_URL, api_key=API_KEY)
    assert isinstance(client.raw, httpx.AsyncClient)


# ===========================================================================
# Context manager lifecycle
# ===========================================================================


def test_sync_context_manager():
    with MomoClient(base_url=BASE_URL, api_key=API_KEY) as client:
        assert isinstance(client, MomoClient)
    # After exit, the underlying client should be closed – httpx does not raise
    # on accessing a closed client, but we can verify it is the right type.
    assert isinstance(client.raw, httpx.Client)


# ===========================================================================
# Upload helpers
# ===========================================================================


@respx.mock
def test_upload_bytes():
    route = respx.post(f"{BASE_URL}/api/v1/documents:upload").mock(
        return_value=httpx.Response(
            200,
            json=_wrap({"documentId": "doc-1", "ingestionId": "ing-1"}),
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    result = client.documents.upload(b"hello world", filename="test.txt")

    assert route.called
    assert result.document_id == "doc-1"
    assert result.ingestion_id == "ing-1"


@respx.mock
def test_upload_sets_container_tag():
    route = respx.post(f"{BASE_URL}/api/v1/documents:upload").mock(
        return_value=httpx.Response(
            200,
            json=_wrap({"documentId": "doc-2", "ingestionId": "ing-2"}),
        )
    )
    client = MomoClient(base_url=BASE_URL, api_key=API_KEY)
    client.documents.upload(b"data", filename="f.txt", container_tag="ct-1")

    # The form data should include the container tag
    req = route.calls[0].request
    body = req.content.decode()
    assert "ct-1" in body
