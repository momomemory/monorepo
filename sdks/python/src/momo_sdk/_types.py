from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    import httpx


@dataclass
class MomoClientConfig:
    """Configuration for MomoClient or AsyncMomoClient."""

    base_url: str
    """Base URL of the Momo server, e.g. ``http://localhost:3000``."""

    api_key: str | None = None
    """Static API key for Bearer auth. Mutually exclusive with ``get_api_key``."""

    get_api_key: Callable[[], str | Awaitable[str]] | None = None
    """Async or sync callable that returns an API key per request."""

    default_container_tag: str | None = None
    """Container tag applied automatically to requests that accept ``containerTag``
    when the caller does not supply one explicitly."""

    timeout: float | httpx.Timeout | None = 30.0
    """Default timeout (seconds) for all requests. Pass ``None`` to disable."""

    http_client: httpx.Client | None = None
    """Custom sync httpx client. If provided, ``timeout`` is ignored at
    construction time (configure the client directly)."""

    async_http_client: httpx.AsyncClient | None = None
    """Custom async httpx client. Same caveat as ``http_client``."""

    extra_headers: dict[str, str] = field(default_factory=dict)
    """Extra headers added to every request."""


@dataclass
class RequestOptions:
    """Per-request overrides."""

    timeout: float | httpx.Timeout | None = None
    """Override the client-level timeout for this request."""

    headers: dict[str, str] | None = None
    """Extra headers merged into this request only."""
