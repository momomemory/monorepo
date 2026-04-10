from __future__ import annotations

from typing import TYPE_CHECKING

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import (
    SearchIncludeFlags,
    SearchRequest,
    SearchResponse,
    SearchScope,
)

if TYPE_CHECKING:
    from .._types import RequestOptions


class SearchGroup:
    """Synchronous search API."""

    def __init__(self, transport: SyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    def search(
        self,
        q: str,
        *,
        container_tags: list[str] | None = None,
        include: SearchIncludeFlags | None = None,
        limit: int | None = None,
        rerank: bool | None = None,
        scope: SearchScope | None = None,
        threshold: float | None = None,
        options: RequestOptions | None = None,
    ) -> SearchResponse:
        tags = container_tags
        if tags is None and self._dct is not None:
            tags = [self._dct]
        body = SearchRequest(
            q=q,
            container_tags=tags,
            include=include,
            limit=limit,
            rerank=rerank,
            scope=scope,
            threshold=threshold,
        )
        raw = self._t.request(
            "POST",
            "/api/v1/search",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, SearchResponse)


class AsyncSearchGroup:
    """Asynchronous search API."""

    def __init__(self, transport: AsyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    async def search(
        self,
        q: str,
        *,
        container_tags: list[str] | None = None,
        include: SearchIncludeFlags | None = None,
        limit: int | None = None,
        rerank: bool | None = None,
        scope: SearchScope | None = None,
        threshold: float | None = None,
        options: RequestOptions | None = None,
    ) -> SearchResponse:
        tags = container_tags
        if tags is None and self._dct is not None:
            tags = [self._dct]
        body = SearchRequest(
            q=q,
            container_tags=tags,
            include=include,
            limit=limit,
            rerank=rerank,
            scope=scope,
            threshold=threshold,
        )
        raw = await self._t.request(
            "POST",
            "/api/v1/search",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, SearchResponse)
