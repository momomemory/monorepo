from __future__ import annotations

from typing import TYPE_CHECKING

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import ForgettingRunResponse

if TYPE_CHECKING:
    from .._types import RequestOptions


class AdminGroup:
    """Synchronous admin API."""

    def __init__(self, transport: SyncTransport) -> None:
        self._t = transport

    def run_forgetting(
        self,
        options: RequestOptions | None = None,
    ) -> ForgettingRunResponse:
        raw = self._t.request("POST", "/api/v1/admin/forgetting:run", options=options)
        return _parse_model(raw, ForgettingRunResponse)


class AsyncAdminGroup:
    """Asynchronous admin API."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._t = transport

    async def run_forgetting(
        self,
        options: RequestOptions | None = None,
    ) -> ForgettingRunResponse:
        raw = await self._t.request("POST", "/api/v1/admin/forgetting:run", options=options)
        return _parse_model(raw, ForgettingRunResponse)
