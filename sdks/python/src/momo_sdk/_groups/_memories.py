from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import (
    ContentForgetRequest,
    CreateMemoryRequest,
    ForgetMemoryResponse,
    ListMemoriesResponse,
    MemoryResponse,
    UpdateMemoryRequest,
    UpdateMemoryResponse,
    V1MemoryType,
)

if TYPE_CHECKING:
    from .._types import RequestOptions


class MemoriesGroup:
    """Synchronous memories API."""

    def __init__(self, transport: SyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    def create(
        self,
        content: str,
        *,
        metadata: dict[str, Any] | None = None,
        container_tag: str | None = None,
        memory_type: V1MemoryType | None = None,
        is_static: bool | None = None,
        options: RequestOptions | None = None,
    ) -> MemoryResponse:
        body = CreateMemoryRequest(
            content=content,
            metadata=metadata,
            container_tag=container_tag or self._dct,
            memory_type=memory_type,
            is_static=is_static,
        )
        raw = self._t.request(
            "POST",
            "/api/v1/memories",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, MemoryResponse)

    def get(
        self,
        memory_id: str,
        options: RequestOptions | None = None,
    ) -> MemoryResponse:
        raw = self._t.request("GET", f"/api/v1/memories/{memory_id}", options=options)
        return _parse_model(raw, MemoryResponse)

    def update(
        self,
        memory_id: str,
        *,
        content: str,
        metadata: dict[str, Any] | None = None,
        is_static: bool | None = None,
        options: RequestOptions | None = None,
    ) -> UpdateMemoryResponse:
        body = UpdateMemoryRequest(
            content=content,
            metadata=metadata,
            is_static=is_static,
        )
        raw = self._t.request(
            "PATCH",
            f"/api/v1/memories/{memory_id}",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, UpdateMemoryResponse)

    def list(
        self,
        *,
        container_tag: str | None = None,
        cursor: str | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> ListMemoriesResponse:
        params: dict[str, Any] = {}
        tag = container_tag or self._dct
        if tag:
            params["containerTag"] = tag
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = limit
        envelope = self._t.request(
            "GET",
            "/api/v1/memories",
            params=params or None,
            options=options,
            include_meta=True,
        )
        raw = envelope["data"]
        raw["meta"] = envelope.get("meta")
        return _parse_model(raw, ListMemoriesResponse)

    def forget(
        self,
        content: str,
        container_tag: str | None = None,
        *,
        reason: str | None = None,
        options: RequestOptions | None = None,
    ) -> None:
        """Forget memories matching ``content`` (content-based forget)."""
        tag = container_tag or self._dct
        if not tag:
            raise ValueError("container_tag is required for content-based forget")
        body = ContentForgetRequest(content=content, container_tag=tag, reason=reason)
        self._t.request(
            "POST",
            "/api/v1/memories:forget",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )

    def forget_by_id(
        self,
        memory_id: str,
        *,
        reason: str | None = None,
        options: RequestOptions | None = None,
    ) -> ForgetMemoryResponse:
        """Forget a specific memory by ID."""
        body: dict[str, Any] = {}
        if reason is not None:
            body["reason"] = reason
        raw = self._t.request(
            "DELETE",
            f"/api/v1/memories/{memory_id}",
            json=body or None,
            options=options,
        )
        return _parse_model(raw, ForgetMemoryResponse)


# ---------------------------------------------------------------------------
# Async variant
# ---------------------------------------------------------------------------


class AsyncMemoriesGroup:
    """Asynchronous memories API."""

    def __init__(self, transport: AsyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    async def create(
        self,
        content: str,
        *,
        metadata: dict[str, Any] | None = None,
        container_tag: str | None = None,
        memory_type: V1MemoryType | None = None,
        is_static: bool | None = None,
        options: RequestOptions | None = None,
    ) -> MemoryResponse:
        body = CreateMemoryRequest(
            content=content,
            metadata=metadata,
            container_tag=container_tag or self._dct,
            memory_type=memory_type,
            is_static=is_static,
        )
        raw = await self._t.request(
            "POST",
            "/api/v1/memories",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, MemoryResponse)

    async def get(
        self,
        memory_id: str,
        options: RequestOptions | None = None,
    ) -> MemoryResponse:
        raw = await self._t.request("GET", f"/api/v1/memories/{memory_id}", options=options)
        return _parse_model(raw, MemoryResponse)

    async def update(
        self,
        memory_id: str,
        *,
        content: str,
        metadata: dict[str, Any] | None = None,
        is_static: bool | None = None,
        options: RequestOptions | None = None,
    ) -> UpdateMemoryResponse:
        body = UpdateMemoryRequest(
            content=content,
            metadata=metadata,
            is_static=is_static,
        )
        raw = await self._t.request(
            "PATCH",
            f"/api/v1/memories/{memory_id}",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, UpdateMemoryResponse)

    async def list(
        self,
        *,
        container_tag: str | None = None,
        cursor: str | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> ListMemoriesResponse:
        params: dict[str, Any] = {}
        tag = container_tag or self._dct
        if tag:
            params["containerTag"] = tag
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = limit
        envelope = await self._t.request(
            "GET",
            "/api/v1/memories",
            params=params or None,
            options=options,
            include_meta=True,
        )
        raw = envelope["data"]
        raw["meta"] = envelope.get("meta")
        return _parse_model(raw, ListMemoriesResponse)

    async def forget(
        self,
        content: str,
        container_tag: str | None = None,
        *,
        reason: str | None = None,
        options: RequestOptions | None = None,
    ) -> None:
        tag = container_tag or self._dct
        if not tag:
            raise ValueError("container_tag is required for content-based forget")
        body = ContentForgetRequest(content=content, container_tag=tag, reason=reason)
        await self._t.request(
            "POST",
            "/api/v1/memories:forget",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )

    async def forget_by_id(
        self,
        memory_id: str,
        *,
        reason: str | None = None,
        options: RequestOptions | None = None,
    ) -> ForgetMemoryResponse:
        body: dict[str, Any] = {}
        if reason is not None:
            body["reason"] = reason
        raw = await self._t.request(
            "DELETE",
            f"/api/v1/memories/{memory_id}",
            json=body or None,
            options=options,
        )
        return _parse_model(raw, ForgetMemoryResponse)
