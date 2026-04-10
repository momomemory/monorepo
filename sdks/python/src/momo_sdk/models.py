"""Pydantic v2 models derived from the Momo OpenAPI schema.

All models parse camelCase JSON from the API and expose snake_case
attributes in Python. Pass ``by_alias=True`` when serialising back to
JSON for the wire format.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class _MomoModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )


# ---------------------------------------------------------------------------
# Enum-style literals
# ---------------------------------------------------------------------------

IngestionStatus = Literal["queued", "processing", "completed", "failed"]

V1DocumentType = Literal[
    "text",
    "pdf",
    "webpage",
    "image",
    "video",
    "audio",
    "markdown",
    "code",
    "csv",
    "docx",
    "pptx",
    "xlsx",
    "unknown",
]

V1MemoryType = Literal["fact", "preference", "episode"]

SearchScope = Literal["documents", "memories", "hybrid"]

GraphEdgeType = Literal[
    "updates",
    "relatesTo",
    "conflictsWith",
    "derivedFrom",
    "sources",
]

GraphNodeType = Literal["memory", "document"]

ErrorCode = Literal[
    "invalid_request",
    "unauthorized",
    "not_found",
    "conflict",
    "internal_error",
    "not_implemented",
]

# ---------------------------------------------------------------------------
# Shared / utility
# ---------------------------------------------------------------------------


class ApiError(_MomoModel):
    code: str
    message: str


class ResponseMeta(_MomoModel):
    next_cursor: str | None = None
    total: int | None = None


class CursorPagination(_MomoModel):
    cursor: str | None = None
    limit: int | None = None


# ---------------------------------------------------------------------------
# Status models
# ---------------------------------------------------------------------------


class DatabaseStatus(_MomoModel):
    status: str


class EmbeddingsStatus(_MomoModel):
    status: str
    model: str
    dimensions: int


class LlmStatus(_MomoModel):
    status: str
    model: str | None = None
    provider: str | None = None


class RerankerStatus(_MomoModel):
    enabled: bool
    status: str
    model: str | None = None


class HealthData(_MomoModel):
    status: str
    version: str
    database: DatabaseStatus
    embeddings: EmbeddingsStatus
    llm: LlmStatus
    reranker: RerankerStatus


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class CreateDocumentRequest(_MomoModel):
    content: str
    metadata: dict[str, Any] | None = None
    container_tag: str | None = None
    content_type: str | None = None
    custom_id: str | None = None
    extract_memories: bool | None = None


class BatchDocumentItem(_MomoModel):
    content: str
    custom_id: str | None = None
    extract_memories: bool | None = None
    metadata: dict[str, Any] | None = None


class BatchCreateDocumentRequest(_MomoModel):
    documents: list[BatchDocumentItem]
    container_tag: str | None = None
    metadata: dict[str, Any] | None = None


class BatchCreateDocumentResponse(_MomoModel):
    documents: list[CreateDocumentResponse]


class CreateDocumentResponse(_MomoModel):
    document_id: str
    ingestion_id: str


class UpdateDocumentRequest(_MomoModel):
    metadata: dict[str, Any] | None = None
    container_tags: list[str] | None = None
    title: str | None = None


class DocumentResponse(_MomoModel):
    document_id: str
    doc_type: V1DocumentType
    ingestion_status: IngestionStatus
    metadata: dict[str, Any]
    container_tags: list[str]
    chunk_count: int
    created_at: str
    updated_at: str
    content: str | None = None
    custom_id: str | None = None
    error_message: str | None = None
    summary: str | None = None
    title: str | None = None
    url: str | None = None


class DocumentSummaryResponse(_MomoModel):
    document_id: str
    doc_type: V1DocumentType
    ingestion_status: IngestionStatus
    metadata: dict[str, Any]
    container_tags: list[str]
    created_at: str
    updated_at: str
    custom_id: str | None = None
    error_message: str | None = None
    summary: str | None = None
    title: str | None = None
    url: str | None = None


class IngestionStatusResponse(_MomoModel):
    document_id: str
    status: IngestionStatus
    created_at: str
    title: str | None = None


class ListDocumentsResponse(_MomoModel):
    documents: list[DocumentSummaryResponse]
    meta: ResponseMeta | None = None


# ---------------------------------------------------------------------------
# Memories
# ---------------------------------------------------------------------------


class MemoryResponse(_MomoModel):
    memory_id: str
    content: str
    memory_type: V1MemoryType
    version: int
    is_latest: bool
    is_inference: bool
    is_forgotten: bool
    is_static: bool
    metadata: dict[str, Any]
    created_at: str
    updated_at: str
    confidence: float | None = None
    container_tag: str | None = None


class CreateMemoryRequest(_MomoModel):
    content: str
    metadata: dict[str, Any] | None = None
    container_tag: str | None = None
    memory_type: V1MemoryType | None = None
    is_static: bool | None = None


class UpdateMemoryRequest(_MomoModel):
    content: str
    metadata: dict[str, Any] | None = None
    is_static: bool | None = None


class UpdateMemoryResponse(_MomoModel):
    memory_id: str
    content: str
    version: int
    created_at: str
    parent_memory_id: str | None = None


class ListMemoriesResponse(_MomoModel):
    memories: list[MemoryResponse]
    meta: ResponseMeta | None = None


class ForgetMemoryRequest(_MomoModel):
    reason: str | None = None


class ForgetMemoryResponse(_MomoModel):
    memory_id: str
    forgotten: bool


class ContentForgetRequest(_MomoModel):
    content: str
    container_tag: str
    reason: str | None = None


class ForgettingRunResponse(_MomoModel):
    memories_forgotten: int
    memories_evaluated: int


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


class SearchIncludeFlags(_MomoModel):
    chunks: bool | None = None
    documents: bool | None = None


class SearchRequest(_MomoModel):
    q: str
    container_tags: list[str] | None = None
    include: SearchIncludeFlags | None = None
    limit: int | None = None
    rerank: bool | None = None
    scope: SearchScope | None = None
    threshold: float | None = None


class DocumentSearchResult(_MomoModel):
    document_id: str
    score: float
    metadata: dict[str, Any]
    created_at: str
    updated_at: str
    chunks: list[str] | None = None
    content: str | None = None
    doc_type: V1DocumentType | None = None
    rerank_score: float | None = None
    summary: str | None = None
    title: str | None = None


class MemorySearchResult(_MomoModel):
    memory_id: str
    similarity: float
    metadata: dict[str, Any]
    updated_at: str
    content: str | None = None
    rerank_score: float | None = None
    version: int | None = None


class DocumentSearchResultItem(DocumentSearchResult):
    type: Literal["document"]


class MemorySearchResultItem(MemorySearchResult):
    type: Literal["memory"]


SearchResultItem = Annotated[
    DocumentSearchResultItem | MemorySearchResultItem,
    Field(discriminator="type"),
]


class SearchResponse(_MomoModel):
    results: list[SearchResultItem]
    total: int
    timing_ms: float


class HybridSearchResultResponse(_MomoModel):
    id: str
    similarity: float
    metadata: dict[str, Any]
    updated_at: str
    chunk: str | None = None
    document_id: str | None = None
    memory: str | None = None
    rerank_score: float | None = None


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------


class ConversationMessageDto(_MomoModel):
    role: str
    content: str
    timestamp: str | None = None


class ConversationIngestRequest(_MomoModel):
    messages: list[ConversationMessageDto]
    container_tag: str
    session_id: str | None = None
    memory_type: V1MemoryType | None = None


class ConversationIngestResponse(_MomoModel):
    memories_extracted: int
    memory_ids: list[str]
    session_id: str


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------


class GraphNodeResponse(_MomoModel):
    id: str
    type: GraphNodeType
    metadata: dict[str, Any]


class GraphEdgeResponse(_MomoModel):
    source: str
    target: str
    type: GraphEdgeType


class GraphResponse(_MomoModel):
    nodes: list[GraphNodeResponse]
    links: list[GraphEdgeResponse]


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


class ProfileFactResponse(_MomoModel):
    content: str
    created_at: str
    confidence: float | None = None


class ProfileResponse(_MomoModel):
    container_tag: str
    static_facts: list[ProfileFactResponse]
    dynamic_facts: list[ProfileFactResponse]
    total_memories: int
    last_updated: str
    narrative: str | None = None


class ComputeProfileRequest(_MomoModel):
    container_tag: str
    q: str | None = None
    threshold: float | None = None
    limit: int | None = None
    include_dynamic: bool | None = None
    generate_narrative: bool | None = None
