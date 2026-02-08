# Momo Roadmap

This document tracks feature development for Momo, organized by phase. Momo is inspired by [Supermemory](https://supermemory.ai) but implements features with our own unique approach.

**Legend:**

- [ ] Not started
- [x] Completed
- ~Strikethrough~ = Descoped/Won't do

---

## Phase 0: Database Foundation ✅

**Goal:** Flexible database architecture supporting multiple backends.

This foundational phase enables the system to work with different databases depending on use case (self-hosted vs hosted, single vs multi-agent).

### 0.1 Database Abstraction Layer

- [x] Design trait-based database abstraction
- [x] Create `DatabaseBackend` supertrait with sub-traits:
  - `DocumentStore` - Document CRUD operations
  - `MemoryStore` - Memory CRUD, search, graph operations
  - `ChunkStore` - Chunk CRUD, vector search
  - `MemorySourceStore` - Memory-document/chunk links
  - `MetadataStore` - System metadata storage
- [x] Implement `LibSqlBackend` (default backend)
  - Wrap existing LibSQL connection
  - Maintain full backward compatibility
  - Use native `F32_BLOB` for vector embeddings
- [x] Refactor application to use trait-based interface
  - Update 60+ files across services, handlers, intelligence, pipeline
  - Maintain zero breaking changes
  - All tests passing (435/435)

### 0.2 Future Backends

- [ ] PostgreSQL backend
  - Use `sqlx` for async operations
  - `pgvector` extension for vector search
  - Connection pooling strategy (PgBouncer/Supavisor)
  - Migration strategy from `F32_BLOB` to `vector` type
- [ ] Conditional compilation via Cargo features
  - Keep binary size small by default
  - `libsql` feature (default) - LibSQL backend only
  - `postgres` feature - PostgreSQL backend only
  - `multi-db` feature - Support all backends

### 0.3 Benefits

- **Self-hosted**: LibSQL provides embedded SQLite with vector search
- **Hosted**: PostgreSQL enables collaborative multi-agent scenarios
- **Flexible**: Easy to add MySQL, MongoDB if needed
- **Future-proof**: Backends independent from application logic

---

## Phase 1: Enhanced Content Processing

**Goal:** Support more content types with intelligent, content-aware chunking.

### 1.1 Code Chunking (AST-Aware)

The biggest differentiator. Supermemory uses their [code-chunk](https://github.com/supermemoryai/code-chunk) library with tree-sitter for AST-aware chunking.

- [x] Add tree-sitter integration for AST parsing
- [x] Implement code chunker that respects semantic boundaries (functions, classes, methods)
- [x] Support TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)
- [x] Support Python (`.py`, `.pyi`)
- [x] Support Rust (`.rs`)
- [x] Support Go (`.go`)
- [x] Support Java (`.java`)
- [x] Add context enrichment (scope chain, imports, siblings)
- [x] Generate contextualized text with metadata for embeddings
  ```
  # src/services/user.ts
  # Scope: UserService
  # Defines: async getUser(id: string): Promise<User>
  # Uses: Database
  ```
- [x] Auto-detect language from file extension or content

### 1.2 Office Document Support

- [x] Add DOCX extraction (consider `docx-rs` or similar)
- [x] Add XLSX extraction (consider `calamine` crate)
- [x] Add PPTX extraction
- [x] Add CSV parsing with structured data handling
- [x] Preserve document structure (headings, tables, lists) for semantic chunking

### 1.3 Semantic Chunking Infrastructure

- [x] Refactor chunker to be content-type-aware (trait-based design)
- [x] Implement `ContentChunker` trait
  ```rust
  trait ContentChunker {
      fn chunk(&self, content: &str, config: &ChunkConfig) -> Vec<Chunk>;
      fn supported_types(&self) -> Vec<DocumentType>;
  }
  ```
- [x] Chunker registry that routes by `DocumentType`
- [x] Document chunking: respect headers, sections, paragraphs
- [x] Markdown chunking: respect heading hierarchy (already partially done)
- [x] Webpage chunking: extract article structure

---

## Phase 2: Media Processing

**Goal:** Extract text from images, audio, and video.

### 2.1 Image OCR

- [x] Integrate OCR library (options: `tesseract` via FFI, `leptess`, or cloud API)
- [x] Support common image formats: JPG, PNG, WebP, TIFF, BMP (not GIF)
- [x] Extract text from scanned PDFs (extend existing PDF processing)
- [x] Add `ImageExtractor` to processing pipeline

### 2.2 Audio Transcription

- [x] Integrate speech-to-text (options: `whisper.cpp` via FFI, or cloud API)
- [x] Support common audio formats: MP3, WAV, M4A
- [x] Add speaker detection/diarization (optional, lower priority) _(deferred - no mature Rust solution)_
- [x] Add `AudioExtractor` to processing pipeline

### 2.3 Video Transcription (deferred)

- [x] Extract audio track from video files
- [x] Support common video formats: MP4, WebM
- [ ] Support YouTube URLs (extract transcript or download + transcribe) _(excluded from scope)_
- [x] Add topic/chapter segmentation (optional, lower priority)
- [x] Add `VideoExtractor` to processing pipeline

---

## Phase 3: LLM Provider Abstraction ✅

**Goal:** Enable LLM-powered features with flexible provider support.

This is a foundational phase required for all memory intelligence features.

### 3.1 Provider Design

- [x] Design `LlmProvider` struct with `LlmBackend` enum

  ```rust
  #[derive(Debug, Clone, Default)]
  pub struct CompletionOptions {
      pub temperature: Option<f32>,
      pub max_tokens: Option<u32>,
      pub top_p: Option<f32>,
      pub stop: Option<Vec<String>>,
  }

  impl LlmProvider {
      pub async fn complete(&self, prompt: &str, options: Option<&CompletionOptions>) -> Result<String>;
      pub async fn complete_json(&self, prompt: &str, options: Option<&CompletionOptions>) -> Result<Value>;
      pub async fn complete_structured<T: DeserializeOwned>(&self, prompt: &str) -> Result<T>;
      pub fn model_name(&self) -> Option<&str>;
  }
  ```

- [x] Define `CompletionOptions` struct (temperature, max_tokens, top_p, stop)
- [x] Add structured output support (JSON mode via `response_format`)

### 3.2 Provider Implementations

- [x] OpenAI implementation (`openai/gpt-4o-mini`, `openai/gpt-4o`)
- [x] Anthropic support via OpenRouter (`openrouter/anthropic/claude-3-5-sonnet`) or custom `LLM_BASE_URL`
- [x] Ollama implementation (`ollama/llama3`, etc.)
- [x] Generic OpenAI-compatible implementation (LM Studio, vLLM, etc.)

**Note:** All providers use the OpenAI-compatible API format via the `async-openai` crate. Anthropic models work through OpenRouter or by setting `LLM_BASE_URL` to Anthropic's OpenAI-compatible endpoint.

### 3.3 Configuration

- [x] Add `LLM_MODEL` environment variable (format: `provider/model`)
- [x] Add `LLM_API_KEY` environment variable
- [x] Add `LLM_BASE_URL` for custom endpoints
- [x] Add `LLM_TIMEOUT` and `LLM_MAX_RETRIES`
- [x] Graceful degradation when no LLM configured (intelligence features disabled)

### 3.4 Prompt Management

- [x] Create `src/llm/prompts.rs` with centralized prompt templates
- [x] Simple `format!()` approach for prompt templating (sufficient for current needs)
- [x] Prompt versioning deferred (not needed yet)

**Implementation Notes:**

- **Architecture Decision:** Chose enum/struct-based design over traits for simplicity. The `LlmProvider` struct wraps an `LlmBackend` enum that handles provider-specific logic.
- **Unified API:** All providers use the OpenAI-compatible API format, which has become the industry standard. This simplifies implementation and allows easy addition of new providers.
- **Prompt Versioning:** Deferred to Phase 4. The simple `format!()` approach is sufficient for current prompt templates. Will revisit if prompt complexity increases.

---

## Phase 4: Memory Intelligence Core

**Goal:** Automatic memory extraction and relationship detection - the core differentiator from basic RAG.

> **Prerequisite:** Phase 3 (LLM Provider) must be complete.

### 4.1 Automatic Memory Extraction ✅

The most critical feature for Supermemory parity.

- [x] Design memory extraction prompt (extract facts, preferences, episodes)
- [x] Implement `MemoryExtractor` struct in `src/intelligence/extractor.rs`
- [x] Extract multiple memories from single content input
- [x] Classify memory type automatically (Fact / Preference / Episode)
- [x] Assign confidence scores to extracted memories
- [x] Handle conversation context (multiple messages)
- [x] Implement `POST /v4/conversation` endpoint
  ```json
  {
    "messages": [...],
    "containerTag": "user_123",
    "extractMemories": true
  }
  ```
- [x] Add optional memory extraction during document processing

**Implementation Notes:**

- Memory extraction uses LLM-powered prompts to identify facts, preferences, and episodes
- Confidence scores (0.0-1.0) assigned to all extracted memories
- Document processing integration via `extract_memories: true` metadata flag
- Full test coverage in `src/intelligence/extractor.rs`

### 4.2 Automatic Relationship Detection ✅

When creating memories, automatically detect relationships to existing memories.

- [x] Design relationship detection prompt
- [x] Implement `RelationshipDetector` struct in `src/intelligence/relationship.rs`
- [x] On memory creation:
  1. Search for semantically similar existing memories
  2. Pass candidates to LLM for relationship classification
  3. Determine: Updates / Extends / None (Derives deferred to Phase 6.3)
  4. Automatically populate `memory_relations` field
- [x] Handle contradiction detection (triggers Updates relationship)
- [x] Handle additive information (triggers Extends relationship)
- [x] Add configuration: `enable_auto_relations: bool` (default true)

**Implementation Notes:**

- Background task spawned on memory creation when `ENABLE_AUTO_RELATIONS=true`
- Uses vector search to find candidate memories, then LLM to classify relationships
- Updates relationship marks old memory as `is_latest=false`
- Bidirectional relations automatically created (both memories reference each other)
- **Note:** Derives relationship detection deferred to Phase 6.3 (Derived Inferences)

### 4.3 Memory Type System ✅

- [x] Add `memory_type` field to Memory model (Fact / Preference / Episode)
- [x] Update database schema with `memory_type TEXT`
- [x] Implement type-specific behaviors:
  - **Fact**: Persists until explicitly updated
  - **Preference**: Strengthens (`source_count++`) with repetition
  - **Episode**: Has natural decay unless reinforced (decay formula implemented)
- [x] Auto-classify during extraction (LLM-powered)
- [x] Allow manual override via API (via `ConversationRequest.memory_type`)

**Implementation Notes:**

- Memory type stored in dedicated `memory_type` column (default: 'fact')
- Episode decay: `relevance = base_score * decay_factor^days_since_access`
- Configuration: `EPISODE_DECAY_DAYS` (default: 30), `EPISODE_DECAY_FACTOR` (default: 0.9)
- `last_accessed` timestamp tracked for decay calculations
- Database migration included for existing tables

### 4.4 Integration Points ✅

- [x] Hook memory extraction into document processing pipeline (optional)
- [x] Hook relationship detection into `MemoryService::create_memory()`
- [x] Add `extractMemories: bool` flag to document ingestion
- [x] Update v4 API responses to include relationship info (partial - relations stored, not returned in search)

---

## Phase 5: Search Enhancements

**Goal:** Improve search relevance with reranking, query enhancement, and hybrid modes.

### 5.1 Temporal-Aware Search ✅

Critical for solving the "sneakers problem" (RAG returning outdated info).

- [x] Implement `TemporalSearchRanker` in `src/intelligence/temporal.rs`
- [x] When searching memories:
  1. Follow `Updates` chains to find current state
  2. Prefer `is_latest = true` versions
  3. Apply `forget_after` filtering (exclude expired)
  4. Weight by recency for Episode-type memories
- [x] Add `includeHistory: bool` parameter to return full version chain
- [x] Track `last_accessed` for decay calculations

### 5.2 Reranking (Cross-Encoder) ✅

Re-score results using a cross-encoder model for better relevance.

- [x] Integrate cross-encoder model (FastEmbed-rs cross-encoders)
- [x] Recommended model: `ms-marco-MiniLM-L-6-v2`
- [x] Add optional reranking step after vector search
- [x] Add `rerank: bool` parameter to search endpoints
- [x] Add `RERANK_MODEL` configuration option
- [x] Benchmark latency impact (~100ms measured)

### 5.3 Query Rewriting

LLM-powered query expansion for better recall.

- [x] Design query rewriting prompt
- [x] Implement query expansion step (requires LLM)
- [x] Add `rewriteQuery: bool` parameter to search endpoints
- [x] Cache rewritten queries to reduce latency on repeated searches
- [x] Add `ENABLE_QUERY_REWRITE` configuration option
- [x] Benchmark latency impact (~400ms expected)

### 5.4 Hybrid Search Mode ✅

Combine document chunks with memories in a single search.

- [x] Add `searchMode` parameter: `"hybrid" | "documents" | "memories"`
- [x] Implement merged result set with unified scoring
- [x] Deduplicate results where memory derives from document (via memory_sources table)
- [x] Default to `"hybrid"` for v4 search, `"documents"` for v3 search
- [x] Memory similarity fix: use DB scores instead of hardcoded 0.8
- [x] Parallel search execution for performance
- [x] Per-domain reranking support

**Implementation Notes:**
- `SearchMode` enum with case-insensitive deserialization
- `HybridSearchRequest`/`HybridSearchResponse` models
- `MemorySourcesRepository` for tracking memory-document relationships
- `search_hybrid()` method in SearchService with parallel chunk+memory search
- Temporal decay applied to Episode-type memories
- Deduplication excludes document chunks when memory from same document exists

---

## Phase 6: Memory Lifecycle Management

**Goal:** Automatic memory maintenance - forgetting, decay, and inference generation.

### 6.1 Automatic Forgetting Enforcement ✅

- [x] Implement `ForgettingManager` in `src/services/forgetting.rs`
- [x] Background job that runs periodically (configurable interval, default 1 hour)
- [x] Check `forget_after < NOW()` and mark as `is_forgotten = true`
- [x] Add `FORGETTING_CHECK_INTERVAL` config (default: 1 hour)
- [x] Log forgotten memories for debugging
- [x] Add manual trigger endpoint: `POST /admin/run-forgetting`

### 6.2 Episode Decay ✅

- [x] Implement decay scoring for Episode-type memories
- [x] Track `last_accessed` timestamp on search hits
- [x] Decay formula: `relevance = base_score * decay_factor^days_since_access`
- [x] Configurable decay rate (global env vars: `EPISODE_DECAY_THRESHOLD`, `EPISODE_FORGET_GRACE_DAYS`)
- [x] Episodes not accessed for N days become candidates for auto-forget
- [x] Add `EpisodeDecayManager` background job (runs every 24 hours)

### 6.3 Derived Inferences ✅

Background job that generates new memories from patterns.

- [x] Implement `InferenceEngine` in `src/intelligence/inference.rs`
- [x] Periodically analyze memory clusters (semantic similarity)
- [x] LLM generates inference from related memories
- [x] Create new memory with `is_inference = true` and `Derives` relationship
- [x] Confidence threshold for inferences (configurable, default 0.7)
- [x] Add `ENABLE_INFERENCES` config (default: false - opt-in)
- [x] Add `INFERENCE_INTERVAL_SECS` config (default: 86400 - 24 hours)
- [x] Add `INFERENCE_MAX_PER_RUN` config (default: 50)
- [x] Add `INFERENCE_SEED_LIMIT` config (default: 50)
- [x] Add `INFERENCE_CANDIDATE_COUNT` config (default: 5)
- [x] Add deduplication to prevent duplicate inferences
- [x] Add comprehensive unit and integration tests

### 6.4 Contradiction Resolution

- [x] Detect when new memory contradicts existing (during extraction)
- [x] Automatically create `Updates` relationship
- [x] Mark old memory as `is_latest = false`
- [x] Optional: LLM-powered contradiction detection for edge cases

---

## Phase 7: Advanced Graph & Profile Features

**Goal:** Enhanced memory graph capabilities and intelligent user profiles.

### 7.1 Graph Traversal Queries

- [x] Implement graph traversal API
- [x] Find related memories N hops away
- [x] Query by relationship type (all Updates, all Extends, etc.)
- [x] Add `GET /v4/memories/{id}/graph` endpoint
- [x] Return graph structure (nodes + edges) for visualization

### 7.2 Memory Graph Visualization

- [x] Add endpoint returning graph data in standard format (D3.js compatible)
- [x] Include relationship types as edge labels
- [x] Include memory metadata as node attributes
- [x] Optional: Generate static graph image (lower priority)

### 7.3 Enhanced User Profiles ✅

- [x] Implement `ProfileGenerator` with LLM-powered summarization
- [x] Generate coherent narrative from memory graph
- [x] Add `compact: bool` parameter to profile endpoint
- [x] Separate static facts from dynamic observations
- [x] Add confidence scores to profile facts
- [x] Profile refresh scheduling (background job)

### 7.4 LLM Filter Prompts

Allow users to control what content gets indexed.

   - [x] Add `shouldLLMFilter: bool` setting per container
   - [x] Add `filterPrompt: string` configuration
   - [x] Integrate LLM call in processing pipeline (before chunking)
   - [x] Filter out irrelevant content based on prompt guidance
   - [x] Add skip/include decision logging for debugging

---

## Phase 8: External Connectors

**Goal:** Real-time sync from external platforms.

> **Note:** This phase is lower priority and will likely coincide with UI development.

### 8.1 Connector Infrastructure

- [ ] Design connector trait/interface
  ```rust
  #[async_trait]
  trait Connector: Send + Sync {
      async fn authenticate(&self, credentials: &Credentials) -> Result<()>;
      async fn sync(&self, container_tag: &str) -> Result<SyncResult>;
      async fn webhook(&self, payload: &WebhookPayload) -> Result<()>;
  }
  ```
- [ ] Add connector registry and management
- [ ] Add OAuth2 flow support
- [ ] Add webhook endpoint for real-time updates
- [ ] Add sync status tracking and error handling

### 8.2 Connectors

Priority order based on typical usage:

- [ ] Google Drive connector
- [ ] Notion connector
- [ ] GitHub connector (repos, issues, PRs)
- [ ] Gmail connector
- [ ] OneDrive connector
- [ ] S3 connector
- [ ] Web crawler (sitemap-based)

---

## Phase 9: Developer Experience

**Goal:** SDKs and integrations for easy adoption.

### 9.1 SDKs

- [ ] TypeScript/JavaScript SDK (`@momo/client` or `momo-js`)
  - Full API coverage
  - TypeScript types
  - Streaming support for large responses
- [ ] Python SDK (`momo-py`)
  - Async and sync clients
  - Pydantic models
- [ ] Rust SDK (client library)
  - Internal dogfooding

### 9.2 Integrations

- [ ] MCP (Model Context Protocol) server
  - Expose memories as context for AI assistants
- [ ] OpenAI-compatible API endpoint
  - Drop-in for apps expecting OpenAI format
- [ ] Vercel AI SDK integration example
- [ ] LangChain integration example
- [ ] LlamaIndex integration example

### 9.3 Documentation

- [ ] API reference (OpenAPI/Swagger)
- [ ] Integration guides
- [ ] Self-hosting guide
- [ ] Migration guide from Supermemory

---

## Completed Features

Features that already have parity with Supermemory:

- [x] Vector search with LibSQL
- [x] Local embeddings (FastEmbed)
- [x] External embeddings (OpenAI-compatible)
- [x] Plain text processing
- [x] URL/webpage extraction (with boilerplate removal)
- [x] PDF extraction (with OCR support)
- [x] HTML extraction
- [x] Markdown extraction
- [x] Configurable chunk size and overlap
- [x] Memory versioning (parent/child relationships)
- [x] Memory relations data model (updates, extends, derives)
- [x] User profiles API (basic)
- [x] Metadata filtering
- [x] Threshold control
- [x] Container tags (multi-tenancy)
- [x] v3/v4 API compatibility
- [x] Batch document ingestion
- [x] AST-aware code chunking (tree-sitter)
- [x] Office document support (DOCX, XLSX, PPTX)
- [x] CSV parsing
- [x] Image OCR (Tesseract + API)
- [x] Semantic chunking infrastructure (ChunkerRegistry)

---

## Implementation Notes

### Recommended Crates

| Feature       | Crate Options                       |
| ------------- | ----------------------------------- |
| Tree-sitter   | `tree-sitter`, `tree-sitter-{lang}` |
| DOCX          | `docx-rs`, `docx`                   |
| XLSX          | `calamine`, `xlsxwriter`            |
| CSV           | `csv` (already in ecosystem)        |
| OCR           | `tesseract` (FFI), `leptess`        |
| Audio         | `whisper-rs` (whisper.cpp bindings) |
| Video         | `ffmpeg` (extract audio)            |
| Cross-encoder | ONNX runtime or API                 |
| HTTP Client   | `reqwest` (already in use)          |

### Architecture Considerations

1. **LLM Provider Design:** Follow the same pattern as `EmbeddingProvider` - trait with multiple implementations, selected at runtime based on config.

2. **Background Jobs:** Memory intelligence features (forgetting, inference) should run in background tasks. Consider a simple job scheduler or integrate with existing Tokio runtime.

3. **Feature Flags:** Intelligence features should be opt-in via configuration. Users without LLM access should still have a functional (but less intelligent) system.

4. **Performance Budget:**
   - Memory extraction: ~500ms per conversation
   - Relationship detection: ~200ms per memory
   - Reranking: ~100ms per search
   - Query rewriting: ~400ms per search

5. **Testing Strategy:** Mock LLM responses for deterministic tests. Real LLM tests should be optional/integration-only.

---

## Version Targets

| Version | Milestone                   | Key Features                                    |
| ------- | --------------------------- | ----------------------------------------------- |
| 0.1.0   | ✅ Phase 0 complete         | Database abstraction, Multi-backend support     |
| 0.2.0   | ✅ Phase 1 complete         | Code chunking, Office docs, Semantic chunking   |
| 0.3.0   | ✅ Phase 2 complete         | Audio/video transcription                       |
| 0.4.0   | ✅ Phase 3-4 complete       | LLM integration, Memory intelligence            |
| 0.5.0   | ✅ Phase 5.2 complete       | Search reranking                                |
| 0.6.0   | ✅ Phase 5.4 complete       | Hybrid search mode                              |
| 0.7.0   | ✅ Phase 7 complete         | Graph features, Enhanced profiles               |
| 1.0.0   | Phase 9 complete            | SDKs, Documentation, Stability                  |
| 1.1.0+  | Phase 8                     | External connectors                             |

---

## Feature Parity Checklist

| Supermemory Feature         | Status | Phase |
| --------------------------- | ------ | ----- |
| Vector search               | ✅     | -     |
| Document storage            | ✅     | -     |
| Smart chunking              | ✅     | 1     |
| Memory versioning           | ✅     | -     |
| Memory relations (manual)   | ✅     | -     |
| OCR                         | ✅     | 2     |
| Audio transcription         | ✅     | 2     |
| Video transcription         | ✅     | 2     |
| LLM integration             | ✅     | 3     |
| Auto memory extraction      | ✅     | 4     |
| Auto relationship detection | ✅     | 4     |
| Memory type classification  | ✅     | 4     |
| Temporal-aware search       | ✅     | 5     |
| Reranking                   | ✅     | 5     |
| Query rewriting             | ✅     | 5     |
| Hybrid search               | ✅     | 5     |
| Auto forgetting             | ✅     | 6     |
| Episode decay               | ✅     | 4     |
| Derived inferences          | ✅     | 6     |
| Graph traversal             | ✅     | 7     |
| Profile compaction          | ✅     | 7     |
| LLM filter prompts          | ✅     | 7     |
| External connectors         | 🔲     | 8     |
| SDKs                        | 🔲     | 9     |
| MCP server                  | 🔲     | 9     |

---

_Last updated: February 7, 2025_
