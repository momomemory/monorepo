from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import (
    ConversationIngestRequest,
    ConversationIngestResponse,
    ConversationMessageDto,
    V1MemoryType,
)

if TYPE_CHECKING:
    from .._types import RequestOptions


class ConversationsGroup:
    """Synchronous conversations API."""

    def __init__(self, transport: SyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    def ingest(
        self,
        messages: list[ConversationMessageDto] | list[dict[str, Any]],
        *,
        container_tag: str | None = None,
        session_id: str | None = None,
        memory_type: V1MemoryType | None = None,
        options: RequestOptions | None = None,
    ) -> ConversationIngestResponse:
        tag = container_tag or self._dct
        if not tag:
            raise ValueError("container_tag is required for conversation ingest")

        # Accept either ConversationMessageDto instances or plain dicts
        parsed_messages: list[ConversationMessageDto] = [
            m if isinstance(m, ConversationMessageDto) else ConversationMessageDto(**m)
            for m in messages
        ]

        body = ConversationIngestRequest(
            messages=parsed_messages,
            container_tag=tag,
            session_id=session_id,
            memory_type=memory_type,
        )
        raw = self._t.request(
            "POST",
            "/api/v1/conversations:ingest",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, ConversationIngestResponse)


class AsyncConversationsGroup:
    """Asynchronous conversations API."""

    def __init__(self, transport: AsyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    async def ingest(
        self,
        messages: list[ConversationMessageDto] | list[dict[str, Any]],
        *,
        container_tag: str | None = None,
        session_id: str | None = None,
        memory_type: V1MemoryType | None = None,
        options: RequestOptions | None = None,
    ) -> ConversationIngestResponse:
        tag = container_tag or self._dct
        if not tag:
            raise ValueError("container_tag is required for conversation ingest")

        parsed_messages: list[ConversationMessageDto] = [
            m if isinstance(m, ConversationMessageDto) else ConversationMessageDto(**m)
            for m in messages
        ]

        body = ConversationIngestRequest(
            messages=parsed_messages,
            container_tag=tag,
            session_id=session_id,
            memory_type=memory_type,
        )
        raw = await self._t.request(
            "POST",
            "/api/v1/conversations:ingest",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, ConversationIngestResponse)
