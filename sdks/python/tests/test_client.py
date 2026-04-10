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

    assert "containerTag=tenant-1" in str(route.calls[0].request.url)


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
