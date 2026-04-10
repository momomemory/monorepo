from __future__ import annotations

import asyncio
from pathlib import Path
from typing import IO, TYPE_CHECKING, Any

from .._transport import AsyncTransport, SyncTransport, _parse_model
from ..models import (
    BatchCreateDocumentRequest,
    BatchCreateDocumentResponse,
    CreateDocumentRequest,
    CreateDocumentResponse,
    DocumentResponse,
    IngestionStatusResponse,
    ListDocumentsResponse,
    UpdateDocumentRequest,
)

if TYPE_CHECKING:
    from .._types import RequestOptions

FileSource = str | Path | bytes | IO[bytes]


def _build_upload_files(
    source: FileSource,
    filename: str | None,
) -> dict[str, Any]:
    """Build the ``files`` dict for httpx multipart upload."""
    if isinstance(source, (str, Path)):
        path = Path(source)
        fname = filename or path.name
        with open(path, "rb") as fh:
            data = fh.read()
        return {"file": (fname, data)}
    if isinstance(source, bytes):
        return {"file": (filename or "upload.bin", source)}
    # file-like
    return {"file": (filename or "upload.bin", source.read())}


class DocumentsGroup:
    """Synchronous documents API."""

    def __init__(self, transport: SyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    # ------------------------------------------------------------------

    def create(
        self,
        content: str,
        *,
        metadata: dict[str, Any] | None = None,
        container_tag: str | None = None,
        content_type: str | None = None,
        custom_id: str | None = None,
        extract_memories: bool | None = None,
        options: RequestOptions | None = None,
    ) -> CreateDocumentResponse:
        body = CreateDocumentRequest(
            content=content,
            metadata=metadata,
            container_tag=container_tag or self._dct,
            content_type=content_type,
            custom_id=custom_id,
            extract_memories=extract_memories,
        )
        raw = self._t.request(
            "POST",
            "/api/v1/documents",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, CreateDocumentResponse)

    def batch_create(
        self,
        documents: list[dict[str, Any]],
        *,
        container_tag: str | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> BatchCreateDocumentResponse:
        body = BatchCreateDocumentRequest(
            documents=documents,
            container_tag=container_tag or self._dct,
            metadata=metadata,
        )
        raw = self._t.request(
            "POST",
            "/api/v1/documents:batch",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, BatchCreateDocumentResponse)

    def upload(
        self,
        source: FileSource,
        *,
        filename: str | None = None,
        container_tag: str | None = None,
        extract_memories: bool | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> CreateDocumentResponse:
        files = _build_upload_files(source, filename)
        form: dict[str, Any] = {}
        if container_tag or self._dct:
            form["containerTag"] = container_tag or self._dct
        if extract_memories is not None:
            form["extractMemories"] = str(extract_memories).lower()
        if metadata:
            import json

            form["metadata"] = json.dumps(metadata)

        raw = self._t.request(
            "POST",
            "/api/v1/documents:upload",
            data=form if form else None,
            files=files,
            options=options,
        )
        return _parse_model(raw, CreateDocumentResponse)

    def get(
        self,
        document_id: str,
        options: RequestOptions | None = None,
    ) -> DocumentResponse:
        raw = self._t.request("GET", f"/api/v1/documents/{document_id}", options=options)
        return _parse_model(raw, DocumentResponse)

    def update(
        self,
        document_id: str,
        *,
        metadata: dict[str, Any] | None = None,
        container_tags: list[str] | None = None,
        title: str | None = None,
        options: RequestOptions | None = None,
    ) -> DocumentResponse:
        body = UpdateDocumentRequest(
            metadata=metadata,
            container_tags=container_tags,
            title=title,
        )
        raw = self._t.request(
            "PATCH",
            f"/api/v1/documents/{document_id}",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, DocumentResponse)

    def delete(
        self,
        document_id: str,
        options: RequestOptions | None = None,
    ) -> None:
        self._t.request("DELETE", f"/api/v1/documents/{document_id}", options=options)

    def list(
        self,
        *,
        container_tag: str | None = None,
        cursor: str | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> ListDocumentsResponse:
        params: dict[str, Any] = {}
        tag = container_tag or self._dct
        if tag:
            params["containerTags"] = [tag]
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = limit
        envelope = self._t.request(
            "GET",
            "/api/v1/documents",
            params=params or None,
            options=options,
            include_meta=True,
        )
        raw = envelope["data"]
        raw["meta"] = envelope.get("meta")
        return _parse_model(raw, ListDocumentsResponse)

    def get_ingestion_status(
        self,
        ingestion_id: str,
        options: RequestOptions | None = None,
    ) -> IngestionStatusResponse:
        raw = self._t.request(
            "GET",
            f"/api/v1/ingestions/{ingestion_id}",
            options=options,
        )
        return _parse_model(raw, IngestionStatusResponse)


# ---------------------------------------------------------------------------
# Async variant
# ---------------------------------------------------------------------------


class AsyncDocumentsGroup:
    """Asynchronous documents API."""

    def __init__(self, transport: AsyncTransport, default_container_tag: str | None) -> None:
        self._t = transport
        self._dct = default_container_tag

    async def create(
        self,
        content: str,
        *,
        metadata: dict[str, Any] | None = None,
        container_tag: str | None = None,
        content_type: str | None = None,
        custom_id: str | None = None,
        extract_memories: bool | None = None,
        options: RequestOptions | None = None,
    ) -> CreateDocumentResponse:
        body = CreateDocumentRequest(
            content=content,
            metadata=metadata,
            container_tag=container_tag or self._dct,
            content_type=content_type,
            custom_id=custom_id,
            extract_memories=extract_memories,
        )
        raw = await self._t.request(
            "POST",
            "/api/v1/documents",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, CreateDocumentResponse)

    async def batch_create(
        self,
        documents: list[dict[str, Any]],
        *,
        container_tag: str | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> BatchCreateDocumentResponse:
        body = BatchCreateDocumentRequest(
            documents=documents,
            container_tag=container_tag or self._dct,
            metadata=metadata,
        )
        raw = await self._t.request(
            "POST",
            "/api/v1/documents:batch",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, BatchCreateDocumentResponse)

    async def upload(
        self,
        source: FileSource,
        *,
        filename: str | None = None,
        container_tag: str | None = None,
        extract_memories: bool | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> CreateDocumentResponse:
        files = await asyncio.to_thread(_build_upload_files, source, filename)
        form: dict[str, Any] = {}
        if container_tag or self._dct:
            form["containerTag"] = container_tag or self._dct
        if extract_memories is not None:
            form["extractMemories"] = str(extract_memories).lower()
        if metadata:
            import json

            form["metadata"] = json.dumps(metadata)

        raw = await self._t.request(
            "POST",
            "/api/v1/documents:upload",
            data=form if form else None,
            files=files,
            options=options,
        )
        return _parse_model(raw, CreateDocumentResponse)

    async def get(
        self,
        document_id: str,
        options: RequestOptions | None = None,
    ) -> DocumentResponse:
        raw = await self._t.request("GET", f"/api/v1/documents/{document_id}", options=options)
        return _parse_model(raw, DocumentResponse)

    async def update(
        self,
        document_id: str,
        *,
        metadata: dict[str, Any] | None = None,
        container_tags: list[str] | None = None,
        title: str | None = None,
        options: RequestOptions | None = None,
    ) -> DocumentResponse:
        body = UpdateDocumentRequest(
            metadata=metadata,
            container_tags=container_tags,
            title=title,
        )
        raw = await self._t.request(
            "PATCH",
            f"/api/v1/documents/{document_id}",
            json=body.model_dump(by_alias=True, exclude_none=True),
            options=options,
        )
        return _parse_model(raw, DocumentResponse)

    async def delete(
        self,
        document_id: str,
        options: RequestOptions | None = None,
    ) -> None:
        await self._t.request("DELETE", f"/api/v1/documents/{document_id}", options=options)

    async def list(
        self,
        *,
        container_tag: str | None = None,
        cursor: str | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> ListDocumentsResponse:
        params: dict[str, Any] = {}
        tag = container_tag or self._dct
        if tag:
            params["containerTags"] = [tag]
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = limit
        envelope = await self._t.request(
            "GET",
            "/api/v1/documents",
            params=params or None,
            options=options,
            include_meta=True,
        )
        raw = envelope["data"]
        raw["meta"] = envelope.get("meta")
        return _parse_model(raw, ListDocumentsResponse)

    async def get_ingestion_status(
        self,
        ingestion_id: str,
        options: RequestOptions | None = None,
    ) -> IngestionStatusResponse:
        raw = await self._t.request(
            "GET",
            f"/api/v1/ingestions/{ingestion_id}",
            options=options,
        )
        return _parse_model(raw, IngestionStatusResponse)
