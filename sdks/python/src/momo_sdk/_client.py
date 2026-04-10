"""Synchronous Momo client."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ._groups import (
    AdminGroup,
    ConversationsGroup,
    DocumentsGroup,
    GraphGroup,
    HealthGroup,
    MemoriesGroup,
    ProfileGroup,
    SearchGroup,
)
from ._transport import SyncTransport
from ._types import MomoClientConfig

if TYPE_CHECKING:
    from collections.abc import Callable

    import httpx


class MomoClient:
    """Synchronous client for the Momo API.

    Example::

        client = MomoClient(base_url="http://localhost:3000", api_key="my-key")
        health = client.health.check()
        print(health.status)

    Context-manager usage (auto-closes the underlying HTTP client)::

        with MomoClient(base_url="http://localhost:3000", api_key="my-key") as client:
            docs = client.documents.list()
    """

    def __init__(
        self,
        base_url: str,
        *,
        api_key: str | None = None,
        get_api_key: Callable[[], str] | None = None,
        default_container_tag: str | None = None,
        timeout: float | httpx.Timeout | None = 30.0,
        http_client: httpx.Client | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        config = MomoClientConfig(
            base_url=base_url,
            api_key=api_key,
            get_api_key=get_api_key,
            default_container_tag=default_container_tag,
            timeout=timeout,
            http_client=http_client,
            extra_headers=extra_headers or {},
        )
        self._transport = SyncTransport(config)
        dct = default_container_tag

        # Grouped resource APIs
        self.documents = DocumentsGroup(self._transport, dct)
        self.memories = MemoriesGroup(self._transport, dct)
        self.search = SearchGroup(self._transport, dct)
        self.conversations = ConversationsGroup(self._transport, dct)
        self.graph = GraphGroup(self._transport)
        self.profile = ProfileGroup(self._transport, dct)
        self.admin = AdminGroup(self._transport)
        self.health = HealthGroup(self._transport)

    # ------------------------------------------------------------------
    # Raw HTTP client access
    # ------------------------------------------------------------------

    @property
    def raw(self) -> httpx.Client:
        """Direct access to the underlying ``httpx.Client``.

        Useful for requests not covered by the SDK surface.  Callers are
        responsible for auth headers and envelope parsing.
        """
        return self._transport.raw

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP client and release resources."""
        self._transport.close()

    def __enter__(self) -> MomoClient:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()
