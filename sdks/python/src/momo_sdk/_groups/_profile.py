from __future__ import annotations

from typing import TYPE_CHECKING

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import ComputeProfileRequest, ProfileResponse

if TYPE_CHECKING:
    from .._types import RequestOptions


class ProfileGroup:
    """Synchronous profile API."""

    def __init__(self, transport: SyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    def compute(
        self,
        *,
        container_tag: str | None = None,
        q: str | None = None,
        threshold: float | None = None,
        limit: int | None = None,
        include_dynamic: bool | None = None,
        generate_narrative: bool | None = None,
        options: RequestOptions | None = None,
    ) -> ProfileResponse:
        tag = container_tag or self._dct
        if not tag:
            raise ValueError("container_tag is required for profile compute")
        body = ComputeProfileRequest(
            container_tag=tag,
            q=q,
            threshold=threshold,
            limit=limit,
            include_dynamic=include_dynamic,
            generate_narrative=generate_narrative,
        )
        raw = self._t.request(
            "POST",
            "/api/v1/profile:compute",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, ProfileResponse)


class AsyncProfileGroup:
    """Asynchronous profile API."""

    def __init__(self, transport: AsyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    async def compute(
        self,
        *,
        container_tag: str | None = None,
        q: str | None = None,
        threshold: float | None = None,
        limit: int | None = None,
        include_dynamic: bool | None = None,
        generate_narrative: bool | None = None,
        options: RequestOptions | None = None,
    ) -> ProfileResponse:
        tag = container_tag or self._dct
        if not tag:
            raise ValueError("container_tag is required for profile compute")
        body = ComputeProfileRequest(
            container_tag=tag,
            q=q,
            threshold=threshold,
            limit=limit,
            include_dynamic=include_dynamic,
            generate_narrative=generate_narrative,
        )
        raw = await self._t.request(
            "POST",
            "/api/v1/profile:compute",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, ProfileResponse)
