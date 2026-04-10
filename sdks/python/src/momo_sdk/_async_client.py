"""Asynchronous Momo client."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ._groups import (
    AsyncAdminGroup,
    AsyncConversationsGroup,
    AsyncDocumentsGroup,
    AsyncGraphGroup,
    AsyncHealthGroup,
    AsyncMemoriesGroup,
    AsyncProfileGroup,
    AsyncSearchGroup,
)
from ._transport import AsyncTransport
from ._types import MomoClientConfig

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    import httpx


class AsyncMomoClient:
    """Asynchronous client for the Momo API.

    Example::

        async with AsyncMomoClient(base_url="http://localhost:3000", api_key="my-key") as client:
            health = await client.health.check()
            print(health.status)

    Or without context-manager::

        client = AsyncMomoClient(base_url="http://localhost:3000", api_key="my-key")
        docs = await client.documents.list()
        await client.close()
    """

    def __init__(
        self,
        base_url: str,
        *,
        api_key: str | None = None,
        get_api_key: Callable[[], str | Awaitable[str]] | None = None,
        default_container_tag: str | None = None,
        timeout: float | httpx.Timeout | None = 30.0,
        async_http_client: httpx.AsyncClient | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        config = MomoClientConfig(
            base_url=base_url,
            api_key=api_key,
            get_api_key=get_api_key,
            default_container_tag=default_container_tag,
            timeout=timeout,
            async_http_client=async_http_client,
            extra_headers=extra_headers or {},
        )
        self._transport = AsyncTransport(config)
        dct = default_container_tag

        # Grouped resource APIs
        self.documents = AsyncDocumentsGroup(self._transport, dct)
        self.memories = AsyncMemoriesGroup(self._transport, dct)
        self.search = AsyncSearchGroup(self._transport, dct)
        self.conversations = AsyncConversationsGroup(self._transport, dct)
        self.graph = AsyncGraphGroup(self._transport)
        self.profile = AsyncProfileGroup(self._transport, dct)
        self.admin = AsyncAdminGroup(self._transport)
        self.health = AsyncHealthGroup(self._transport)

    # ------------------------------------------------------------------
    # Raw HTTP client access
    # ------------------------------------------------------------------

    @property
    def raw(self) -> httpx.AsyncClient:
        """Direct access to the underlying ``httpx.AsyncClient``."""
        return self._transport.raw

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP client and release resources."""
        await self._transport.close()

    async def __aenter__(self) -> AsyncMomoClient:
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()
