from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import GraphEdgeType, GraphResponse

if TYPE_CHECKING:
    from .._types import RequestOptions


class GraphGroup:
    """Synchronous graph API."""

    def __init__(self, transport: SyncTransport) -> None:
        self._t = transport

    def get_memory_graph(
        self,
        memory_id: str,
        *,
        depth: int | None = None,
        max_nodes: int | None = None,
        relation_types: list[GraphEdgeType] | None = None,
        options: RequestOptions | None = None,
    ) -> GraphResponse:
        params: dict[str, Any] = {}
        if depth is not None:
            params["depth"] = depth
        if max_nodes is not None:
            params["maxNodes"] = max_nodes
        if relation_types:
            # repeated query param
            params["relationTypes"] = relation_types
        raw = self._t.request(
            "GET",
            f"/api/v1/graph/memory/{memory_id}",
            params=params or None,
            options=options,
        )
        return _parse_model(raw, GraphResponse)

    def get_container_graph(
        self,
        container_tag: str,
        *,
        max_nodes: int | None = None,
        options: RequestOptions | None = None,
    ) -> GraphResponse:
        params: dict[str, Any] = {}
        if max_nodes is not None:
            params["maxNodes"] = max_nodes
        raw = self._t.request(
            "GET",
            f"/api/v1/graph/container/{container_tag}",
            params=params or None,
            options=options,
        )
        return _parse_model(raw, GraphResponse)


class AsyncGraphGroup:
    """Asynchronous graph API."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._t = transport

    async def get_memory_graph(
        self,
        memory_id: str,
        *,
        depth: int | None = None,
        max_nodes: int | None = None,
        relation_types: list[GraphEdgeType] | None = None,
        options: RequestOptions | None = None,
    ) -> GraphResponse:
        params: dict[str, Any] = {}
        if depth is not None:
            params["depth"] = depth
        if max_nodes is not None:
            params["maxNodes"] = max_nodes
        if relation_types:
            params["relationTypes"] = relation_types
        raw = await self._t.request(
            "GET",
            f"/api/v1/graph/memory/{memory_id}",
            params=params or None,
            options=options,
        )
        return _parse_model(raw, GraphResponse)

    async def get_container_graph(
        self,
        container_tag: str,
        *,
        max_nodes: int | None = None,
        options: RequestOptions | None = None,
    ) -> GraphResponse:
        params: dict[str, Any] = {}
        if max_nodes is not None:
            params["maxNodes"] = max_nodes
        raw = await self._t.request(
            "GET",
            f"/api/v1/graph/container/{container_tag}",
            params=params or None,
            options=options,
        )
        return _parse_model(raw, GraphResponse)
