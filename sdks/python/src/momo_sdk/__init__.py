"""momo-sdk — Official Python SDK for Momo.

Quick start::

    from momo_sdk import MomoClient

    client = MomoClient(base_url="http://localhost:3000", api_key="my-key")
    health = client.health.check()

Async::

    from momo_sdk import AsyncMomoClient

    async with AsyncMomoClient(base_url="http://localhost:3000", api_key="my-key") as client:
        health = await client.health.check()
"""

from . import models
from ._async_client import AsyncMomoClient
from ._client import MomoClient
from ._errors import ErrorCode, MomoError
from ._types import MomoClientConfig, RequestOptions

__all__ = [
    "AsyncMomoClient",
    "ErrorCode",
    "MomoClient",
    "MomoClientConfig",
    "MomoError",
    "RequestOptions",
    "models",
]

__version__ = "0.1.0"
