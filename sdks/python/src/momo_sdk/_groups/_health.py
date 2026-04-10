from __future__ import annotations

from typing import TYPE_CHECKING

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import HealthData

if TYPE_CHECKING:
    from .._types import RequestOptions


class HealthGroup:
    """Synchronous health API."""

    def __init__(self, transport: SyncTransport) -> None:
        self._t = transport

    def check(self, options: RequestOptions | None = None) -> HealthData:
        raw = self._t.request("GET", "/api/v1/health", options=options)
        return _parse_model(raw, HealthData)


class AsyncHealthGroup:
    """Asynchronous health API."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._t = transport

    async def check(self, options: RequestOptions | None = None) -> HealthData:
        raw = await self._t.request("GET", "/api/v1/health", options=options)
        return _parse_model(raw, HealthData)
