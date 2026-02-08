# Momo Software Development Document

**Version:** 1.0  
**Last Updated:** February 2025  
**Status:** Active Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Architecture](#3-architecture)
4. [Data Models](#4-data-models)
5. [API Specification](#5-api-specification)
6. [Feature Specification](#6-feature-specification)
7. [Implementation Status](#7-implementation-status)
8. [Technical Requirements](#8-technical-requirements)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment](#10-deployment)

---

## 1. Executive Summary

### 1.1 Purpose

Momo is an open-source, self-hostable AI memory system written in Rust. It provides long-term memory capabilities for AI agents, combining traditional RAG (Retrieval-Augmented Generation) with intelligent memory management that understands temporal context, relationships, and user state over time.

### 1.2 Goals

- **Inspired by Supermemory**: Similar concepts implemented with our own unique approach (https://supermemory.ai)
- **Self-Hostable**: Single binary, no external dependencies beyond SQLite
- **Intelligent Memory**: Beyond basic RAG - automatic fact extraction, relationship detection, and temporal awareness

### 1.3 Key Differentiators from Basic RAG

| Basic RAG                 | Momo                             |
| ------------------------- | -------------------------------- |
| Stores document chunks    | Extracts and tracks facts        |
| Stateless search          | User-specific memory             |
| Keyword/semantic matching | Temporal and relational context  |
| No contradiction handling | Automatic updates and forgetting |
| Manual organization       | Automatic relationship building  |

---

## 2. Project Overview

### 2.1 Problem Statement

AI agents suffer from "amnesia" - they can't remember user preferences, previous interactions, or evolving facts. Traditional RAG systems find similar text but don't understand:

- **Temporal validity**: "I love Adidas" (Day 1) vs "I switched to Puma" (Day 30)
- **Relationships**: Facts that update, extend, or derive from other facts
- **User context**: Preferences vs episodes vs permanent facts

### 2.2 Solution

Momo provides a memory system that:

1. **Stores documents** (RAG functionality) with intelligent chunking
2. **Extracts memories** (facts, preferences, episodes) automatically
3. **Builds relationships** between memories (updates, extends, derives)
4. **Understands time** - knows when facts become stale or contradicted
5. **Forgets intelligently** - temporary info expires, contradicted info is superseded

### 2.3 Target Users

- **AI Agent Developers**: Building assistants that need persistent memory
- **Enterprise Teams**: Secure, self-hosted alternative to cloud memory services
- **Hobbyists/Researchers**: Local-first AI memory experimentation

### 2.4 Technology Stack

| Component           | Technology           | Rationale                                    |
| ------------------- | -------------------- | -------------------------------------------- |
| Language            | Rust                 | Performance, safety, single binary           |
| Web Framework       | Axum                 | Async, ergonomic, Tokio-native               |
| Database            | Abstraction Layer    | LibSQL (default), PostgreSQL (optional)     |
| Local Embeddings    | FastEmbed            | No API calls, BGE models                     |
| External Embeddings | OpenAI-compatible    | Flexibility                                  |
| LLM Integration     | Provider abstraction | OpenAI, Anthropic, Ollama, local             |
| OCR                 | Tesseract / API      | Image text extraction                        |
| Audio               | Whisper.cpp          | Local transcription                          |
| AST Parsing         | Tree-sitter          | Code-aware chunking                          |

**Note:** The database abstraction layer supports multiple backends via trait-based design. LibSQL is the default for self-hosted scenarios, while PostgreSQL support enables hosted/collaborative use cases.

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Momo Server                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Layer (Axum)                            │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐ │   │
│  │  │  v3 API   │  │  v4 API   │  │  Health   │  │  Admin/Config     │ │   │
│  │  │ Documents │  │ Memories  │  │  Check    │  │  (future)         │ │   │
│  │  └─────┬─────┘  └─────┬─────┘  └───────────┘  └───────────────────┘ │   │
│  └────────┼──────────────┼─────────────────────────────────────────────┘   │
│           │              │                                                  │
│  ┌────────┴──────────────┴─────────────────────────────────────────────┐   │
│  │                       Services Layer                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │   Search    │  │   Memory    │  │  Document   │                  │   │
│  │  │  Service    │  │  Service    │  │  Service    │                  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │   │
│  └─────────┼────────────────┼────────────────┼─────────────────────────┘   │
│            │                │                │                              │
│  ┌─────────┴────────────────┴────────────────┴─────────────────────────┐   │
│  │                    Memory Intelligence Layer                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   Memory    │  │  Relation   │  │  Inference  │  │  Forgetting │ │   │
│  │  │  Extractor  │  │  Detector   │  │  Engine     │  │  Manager    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Processing Pipeline                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  Extractor  │  │   Chunker   │  │  Embedder   │  │   Indexer   │ │   │
│  │  │  (content)  │  │  (smart)    │  │  (vector)   │  │  (graph)    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Provider Abstractions                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │   │
│  │  │    Embedding    │  │      LLM        │  │       OCR           │  │   │
│  │  │    Provider     │  │    Provider     │  │     Provider        │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Database Abstraction Layer                        │   │
│  │  ┌─────────────┐  ┌─────────────┐                                    │   │
│  │  │  LibSQL     │  │ PostgreSQL  │  (future: MySQL, MongoDB)        │   │
│  │  │  Backend    │  │  Backend    │                                    │   │
│  │  └──────┬──────┘  └──────┬──────┘                                    │   │
│  └─────────┼────────────────┼─────────────────────────────────────────┘   │
│            │                │                                                │
│  ┌─────────┴────────────────┴─────────────────────────────────────────┐   │
│  │                     Data Layer                                     │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐ │   │
│  │  │ Documents │  │  Chunks   │  │ Memories  │  │  Vector Indexes   │ │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Directory Structure

```
momo/
├── src/
│   ├── main.rs                 # Entry point, server initialization
│   ├── lib.rs                  # Library exports
│   ├── config.rs               # Environment-based configuration
│   ├── error.rs                # Unified error handling
│   ├── migration.rs            # Database migrations
│   │
│   ├── api/                    # HTTP API Layer
│   │   ├── mod.rs
│   │   ├── routes.rs           # Route definitions
│   │   ├── state.rs            # AppState (shared across handlers)
│   │   ├── middleware.rs       # Auth, logging, etc.
│   │   └── handlers/
│   │       ├── mod.rs
│   │       ├── documents.rs    # v3 document endpoints
│   │       ├── memories.rs     # v4 memory endpoints
│   │       ├── search.rs       # Search endpoints
│   │       └── health.rs       # Health check
│   │
│   ├── services/               # Business Logic Layer
│   │   ├── mod.rs
│   │   ├── search.rs           # Search orchestration
│   │   └── memory.rs           # Memory CRUD operations
│   │
│   ├── intelligence/           # Memory Intelligence Layer (NEW)
│   │   ├── mod.rs
│   │   ├── extractor.rs        # Automatic memory extraction
│   │   ├── relationship.rs     # Automatic relationship detection
│   │   ├── inference.rs        # Derived inference generation
│   │   ├── forgetting.rs       # Automatic forgetting manager
│   │   └── temporal.rs         # Temporal-aware search logic
│   │
│   ├── processing/             # Content Processing Pipeline
│   │   ├── mod.rs
│   │   ├── pipeline.rs         # Processing orchestration
│   │   ├── extractor.rs        # Content extraction dispatcher
│   │   ├── chunker.rs          # Base text chunker
│   │   ├── chunker_registry.rs # Routes to type-specific chunkers
│   │   ├── code_chunker.rs     # AST-aware code chunking
│   │   ├── markdown_chunker.rs # Heading-aware markdown
│   │   ├── webpage_chunker.rs  # Article structure extraction
│   │   ├── structured_data_chunker.rs  # CSV/XLSX
│   │   ├── language.rs         # Language detection
│   │   └── extractors/         # Type-specific extractors
│   │       ├── mod.rs
│   │       ├── image.rs        # OCR extraction
│   │       ├── csv.rs
│   │       ├── xlsx.rs
│   │       ├── docx.rs
│   │       └── pptx.rs
│   │
│   ├── embeddings/             # Embedding Provider Abstraction
│   │   ├── mod.rs
│   │   ├── provider.rs         # EmbeddingProvider trait + impl
│   │   ├── api.rs              # External API embeddings
│   │   └── tests.rs
│   │
│   ├── llm/                    # LLM Provider Abstraction (NEW)
│   │   ├── mod.rs
│   │   ├── provider.rs         # LLMProvider trait
│   │   ├── openai.rs           # OpenAI implementation
│   │   ├── anthropic.rs        # Anthropic implementation
│   │   ├── ollama.rs           # Ollama implementation
│   │   └── prompts.rs          # Prompt templates
│   │
│   ├── ocr/                    # OCR Provider Abstraction
│   │   ├── mod.rs
│   │   ├── provider.rs
│   │   ├── api.rs
│   │   └── preprocessing.rs
│   │
 │   ├── db/                     # Database Layer
 │   │   ├── mod.rs
 │   │   ├── connection.rs       # Connection pool
 │   │   ├── schema.rs           # DDL, migrations
 │   │   ├── metadata.rs         # Schema introspection
 │   │   ├── traits.rs           # Database abstraction traits (NEW)
 │   │   ├── backends/           # Backend implementations (NEW)
 │   │   │   ├── mod.rs
 │   │   │   └── libsql.rs       # LibSQL implementation
 │   │   └── repository/         # Data access
 │   │       ├── mod.rs
 │   │       ├── documents.rs
 │   │       ├── chunks.rs
 │   │       └── memories.rs
│   │
│   └── models/                 # Domain Types
│       ├── mod.rs
│       ├── common.rs           # Shared enums, Metadata
│       ├── document.rs         # Document entity
│       ├── chunk.rs            # Chunk entity
│       ├── memory.rs           # Memory entity
│       └── search.rs           # Search request/response
│
├── docs/                       # Documentation
│   └── SOFTWARE_DEVELOPMENT_DOCUMENT.md
│
├── tests/                      # Integration tests (to be created)
│
├── Cargo.toml
├── Dockerfile
├── ROADMAP.md
└── README.md
```

### 3.3 Database Abstraction Layer

The database abstraction layer decouples the application from specific database implementations, enabling support for multiple backends while maintaining full backward compatibility.

#### 3.3.1 Design

The abstraction follows these principles:

1. **Trait-Based Interface**: Database operations defined as async traits
2. **Runtime Selection**: Backend chosen via configuration
3. **Zero Overhead**: Trait dispatch has negligible performance cost
4. **Backend Isolation**: Each backend implementation is self-contained
5. **Future-Proof**: Easy to add new database backends (PostgreSQL, MySQL, MongoDB)

#### 3.3.2 Architecture

```
DatabaseBackend trait (supertrait)
├── DocumentStore
│   ├── create_document
│   ├── get_document_by_id
│   ├── list_documents
│   ├── update_document
│   ├── delete_document
│   └── queue_all_documents_for_reprocessing
├── MemoryStore
│   ├── create_memory
│   ├── get_memory_by_id
│   ├── search_memories
│   ├── forget_memory
│   ├── get_seed_memories
│   ├── check_inference_exists
│   └── get_user_profile
├── ChunkStore
│   ├── create_chunk
│   ├── get_chunk_by_id
│   ├── search_similar_chunks
│   ├── delete_chunks_by_document_id
│   └── delete_all_chunks
├── MemorySourceStore
│   ├── create_memory_source
│   ├── get_sources_by_memory
│   └── delete_sources_by_memory
└── MetadataStore
    ├── get_metadata
    ├── set_metadata
    └── delete_metadata
```

#### 3.3.3 Backends

**LibSQL Backend (Default)**
- Wraps existing connection pool
- Uses LibSQL's native `F32_BLOB` for vector embeddings
- Optimized for single-agent, self-hosted scenarios
- No external dependencies beyond SQLite

**PostgreSQL Backend (Future)**
- Uses `sqlx` for async database operations
- `pgvector` extension for vector similarity search
- Connection pooling via PgBouncer or connection pool library
- Designed for multi-agent, hosted scenarios

#### 3.3.4 Usage Pattern

```rust
// Application initialization
let db = Database::new(&config).await?;
let backend: Arc<dyn DatabaseBackend> = Arc::new(LibSqlBackend::new(db));

// Services accept the trait, not concrete type
let search_service = SearchService::new(backend.clone());

// Runtime selection via config
let backend: Arc<dyn DatabaseBackend> = match config.database.backend {
    DatabaseBackendType::LibSQL => Arc::new(LibSqlBackend::new(...)?),
    DatabaseBackendType::PostgreSQL => Arc::new(PostgresBackend::new(...)?),
};
```

#### 3.3.5 Migration Path

Existing code using the concrete `Database` type continues to work:
- LibSQL remains the default backend
- No breaking changes to existing functionality
- Gradual migration to trait-based interface in services/handlers

### 3.4 Data Flow

#### 3.4.1 Document Ingestion Flow

```
User Request
     │
     ▼
┌─────────────────┐
│ POST /v3/docs   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Create Document │────▶│ Status: queued  │
└────────┬────────┘     └─────────────────┘
         │
         ▼ (background)
┌─────────────────┐     ┌─────────────────┐
│    Extract      │────▶│Status: extracting│
│    Content      │     └─────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Smart Chunk    │────▶│ Status: chunking │
│  (by type)      │     └─────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Generate        │────▶│Status: embedding │
│ Embeddings      │     └─────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Index & Store   │────▶│ Status: indexing │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Extract Memories│────▶│  (if enabled)   │
│ (LLM-powered)   │     └─────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Status: done   │
└─────────────────┘
```

#### 3.4.2 Memory Creation Flow (Automatic)

```
Input Content (conversation, document, etc.)
     │
     ▼
┌─────────────────────────────────────────┐
│         Memory Extractor (LLM)          │
│  "Extract facts, preferences, episodes" │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         For each extracted fact:        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│    Search similar existing memories     │
│         (vector similarity)             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      Relationship Detector (LLM)        │
│  "Does this Update/Extend/Derive?"      │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐  ┌───────────────┐
│   No match    │  │  Match found  │
│ Create new    │  │ Create with   │
│   memory      │  │  relationship │
└───────────────┘  └───────────────┘
```

#### 3.4.3 Search Flow

```
Search Query
     │
     ▼
┌─────────────────────────────────────────┐
│         Query Enhancement (optional)     │
│  - Rewrite query (LLM)                  │
│  - Expand synonyms                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│           Vector Search                  │
│  - Document chunks (if mode includes)   │
│  - Memories (if mode includes)          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│        Temporal Filtering                │
│  - Prefer is_latest = true              │
│  - Apply forget_after checks            │
│  - Weight by recency for episodes       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│          Reranking (optional)            │
│  - Cross-encoder scoring                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│        Context Assembly                  │
│  - Include related memories             │
│  - Include version history (optional)   │
└────────────────┬────────────────────────┘
                 │
                 ▼
           Results
```

---

## 4. Data Models

### 4.1 Document

Represents raw input content (PDFs, web pages, text files, etc.)

```rust
pub struct Document {
    pub id: String,                      // nanoid (21 chars)
    pub content: Option<String>,         // Raw/extracted content
    pub title: Option<String>,
    pub url: Option<String>,             // Source URL if applicable
    pub doc_type: DocumentType,          // pdf, webpage, text, code, etc.
    pub container_tag: Option<String>,   // Multi-tenancy
    pub status: ProcessingStatus,        // queued → done
    pub summary: Option<String>,         // LLM-generated summary
    pub metadata: Metadata,              // User-defined key-values
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### 4.2 Chunk

Represents a semantic unit of a document, with embedding.

```rust
pub struct Chunk {
    pub id: String,
    pub document_id: String,
    pub content: String,
    pub chunk_index: i32,
    pub token_count: i32,
    pub embedding: Option<Vec<f32>>,     // F32_BLOB in LibSQL
    pub metadata: Metadata,
    pub created_at: DateTime<Utc>,
}
```

### 4.3 Memory

Represents an intelligent fact/preference/episode with relationships.

```rust
pub struct Memory {
    pub id: String,
    pub memory: String,                              // The actual content
    pub space_id: String,                            // Organization/workspace
    pub container_tag: Option<String>,               // User/entity identifier

    // Versioning
    pub version: i32,
    pub is_latest: bool,
    pub parent_memory_id: Option<String>,            // Previous version
    pub root_memory_id: Option<String>,              // Original memory

    // Relationships
    pub memory_relations: HashMap<String, MemoryRelationType>,

    // Classification
    pub memory_type: MemoryType,                     // Fact, Preference, Episode
    pub source_count: i32,                           // Reinforcement count
    pub is_inference: bool,                          // LLM-derived
    pub confidence: Option<f32>,                     // 0.0-1.0

    // Lifecycle
    pub is_forgotten: bool,
    pub is_static: bool,                             // Won't decay
    pub forget_after: Option<DateTime<Utc>>,         // Auto-expiry
    pub forget_reason: Option<String>,
    pub last_accessed: Option<DateTime<Utc>>,        // For decay calculation

    // Embedding
    pub embedding: Option<Vec<f32>>,

    pub metadata: Metadata,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### 4.4 Enumerations

```rust
pub enum DocumentType {
    Text,
    Pdf,
    Webpage,
    Markdown,
    Code,
    Csv,
    Xlsx,
    Docx,
    Pptx,
    Image,
    Audio,           // Future
    Video,           // Future
    Tweet,
    GoogleDoc,
    GoogleSheet,
    GoogleSlide,
    NotionDoc,
    Onedrive,
    Unknown,
}

pub enum ProcessingStatus {
    Queued,
    Extracting,
    Chunking,
    Embedding,
    Indexing,
    Done,
    Failed,
}

pub enum MemoryRelationType {
    Updates,         // New info contradicts/replaces old
    Extends,         // New info adds to existing
    Derives,         // Inferred from patterns
}

pub enum MemoryType {
    Fact,            // Persists until updated
    Preference,      // Strengthens with repetition
    Episode,         // Decays unless significant
}

pub enum SearchMode {
    Documents,       // Only document chunks
    Memories,        // Only memories
    Hybrid,          // Both, merged and weighted
}
```

### 4.5 Database Schema

```sql
-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    content TEXT,
    title TEXT,
    url TEXT,
    doc_type TEXT NOT NULL DEFAULT 'text',
    container_tag TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    summary TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Chunks table with vector embedding
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding F32_BLOB(384),              -- Dimension matches model
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Vector index for chunk similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
ON chunks(libsql_vector_idx(embedding));

-- Memories table with vector embedding
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    memory TEXT NOT NULL,
    space_id TEXT NOT NULL,
    container_tag TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    is_latest INTEGER NOT NULL DEFAULT 1,
    parent_memory_id TEXT,
    root_memory_id TEXT,
    memory_relations TEXT NOT NULL DEFAULT '{}',
    memory_type TEXT NOT NULL DEFAULT 'fact',
    source_count INTEGER NOT NULL DEFAULT 0,
    is_inference INTEGER NOT NULL DEFAULT 0,
    confidence REAL,
    is_forgotten INTEGER NOT NULL DEFAULT 0,
    is_static INTEGER NOT NULL DEFAULT 0,
    forget_after TEXT,
    forget_reason TEXT,
    last_accessed TEXT,
    embedding F32_BLOB(384),
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_memory_id) REFERENCES memories(id),
    FOREIGN KEY (root_memory_id) REFERENCES memories(id)
);

-- Vector index for memory similarity search
CREATE INDEX IF NOT EXISTS memories_embedding_idx
ON memories(libsql_vector_idx(embedding));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_memories_container ON memories(container_tag);
CREATE INDEX IF NOT EXISTS idx_memories_latest ON memories(is_latest, is_forgotten);
CREATE INDEX IF NOT EXISTS idx_memories_forget_after ON memories(forget_after)
    WHERE forget_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_container ON documents(container_tag);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
```

---

## 5. API Specification

### 5.1 Overview

Momo provides two API versions for backward compatibility:

| Version | Purpose                     | Base Path |
| ------- | --------------------------- | --------- |
| v3      | Document-centric RAG        | `/v3/*`   |
| v4      | Memory-centric intelligence | `/v4/*`   |

### 5.2 Authentication

```http
Authorization: Bearer <api_key>
```

Configure via `MOMO_API_KEYS` environment variable (comma-separated). Empty = no auth.

### 5.3 v3 Endpoints (Documents)

#### Add Document

```http
POST /v3/documents
Content-Type: application/json

{
    "content": "string | URL | base64",
    "content_type": "pdf | docx | text | ...",  // Optional, hint for base64 files
    "container_tag": "user_123",                // Optional
    "custom_id": "ext_doc_123",                 // Optional
    "entity_context": "Seattle office",         // Optional, context for processing
    "metadata": { "key": "value" },             // Optional
    "extract_memories": true                    // Optional, default false
}

Response 202:
{
    "id": "doc_abc123",
    "status": "queued"
}
```

#### Batch Add Documents

```http
POST /v3/documents/batch
Content-Type: application/json

{
    "documents": [
        { "content": "...", "custom_id": "doc_1" },
        { "content": "...", "custom_id": "doc_2" }
    ],
    "container_tag": "project_xyz",
    "metadata": { "category": "research" }
}

Response 202:
{
    "documents": [
        { "id": "doc_1", "status": "queued" },
        { "id": "doc_2", "status": "queued" }
    ]
}
```

#### Search Documents

```http
POST /v3/search
Content-Type: application/json

{
    "q": "search query",
    "container_tags": ["user_123"],             // Optional filter
    "limit": 10,                                // Default 10, max 100
    "chunk_threshold": 0.5,                     // Minimum similarity
    "doc_id": "doc_123",                        // Optional, search within document
    "include_full_docs": false,                 // Include full content
    "include_summary": true,                    // Include summaries
    "only_matching_chunks": true,               // Filter low-score chunks
    "rerank": false,                            // Enable cross-encoder
    "rerank_level": "chunk",                    // "chunk" or "document"
    "rerank_top_k": 100,                        // Results to rerank
    "rewrite_query": false                      // Enable query expansion
}

Response 200:
{
    "results": [
        {
            "document_id": "doc_abc",
            "title": "Document Title",
            "type": "pdf",
            "score": 0.87,
            "rerank_score": 0.94,               // Present if reranked
            "chunks": [
                { "content": "...", "score": 0.87, "rerank_score": 0.94, "is_relevant": true }
            ],
            "summary": "...",
            "metadata": {},
            "created_at": "2025-02-05T10:00:00Z"
        }
    ],
    "total": 5,
    "timing": 145
}
```

#### List Documents

```http
POST /v3/documents/list
Content-Type: application/json

{
    "container_tags": ["user_123"],
    "limit": 20,
    "page": 1,
    "filters": "status = 'done'"                // Optional SQL-like filter
}

Response 200:
{
    "documents": [...],
    "pagination": {
        "current_page": 1,
        "limit": 20,
        "total_items": 150,
        "total_pages": 8
    }
}
```

#### Get Document

```http
GET /v3/documents/{id}

Response 200:
{
    "id": "doc_abc",
    "content": "...",
    "title": "...",
    "status": "done",
    ...
}
```

#### Delete Document

```http
DELETE /v3/documents/{id}

Response 204: No Content
```

### 5.4 v4 Endpoints (Memories)

#### Process Conversation (Auto-extract memories)

```http
POST /v4/conversation
Content-Type: application/json

{
    "messages": [
        { "role": "user", "content": "I just started a new job at Stripe" },
        { "role": "assistant", "content": "Congratulations! What role?" },
        { "role": "user", "content": "PM on the payments team in Seattle" }
    ],
    "container_tag": "user_123",
    "session_id": "session_abc",                // Optional, for grouping
    "memory_type": "fact"                       // Optional, override type
}

Response 200:
{
    "memories_extracted": 3,
    "memory_ids": ["mem_1", "mem_2", "mem_3"],
    "session_id": "session_abc"
}
```

#### Search Memories

```http
POST /v4/search
Content-Type: application/json

{
    "q": "where does user work",
    "container_tag": "user_123",
    "threshold": 0.6,
    "limit": 10,
    "include": {
        "related_memories": true,               // Include extends/updates chain
        "documents": false,                     // Include source documents
        "forgottenMemories": false              // Include soft-deleted
    },
    "rerank": true,
    "rewrite_query": false
}

Response 200:
{
    "results": [
        {
            "id": "mem_xyz",
            "memory": "Works at Stripe as PM",
            "similarity": 0.92,
            "rerank_score": 0.98,
            "version": 2,
            "updated_at": "2025-02-05T10:00:00Z",
            "context": {
                "parents": [...],               // Previous versions
                "children": [...],              // Extensions
                "related": [...]                // Derived/linked
            }
        }
    ],
    "total": 3,
    "timing": 89
}
```

#### Update Memory

```http
PATCH /v4/memories
Content-Type: application/json

{
    "id": "mem_xyz",                            // OR content + container_tag
    "content": "Works at Stripe",               // Optional if id provided
    "container_tag": "user_123",
    "new_content": "Now works at Square",
    "metadata": {}                              // Optional, merge
}

Response 200:
{
    "id": "mem_new",                            // New version created
    "memory": "Now works at Square",
    "version": 2,
    "parent_memory_id": "mem_xyz",
    "root_memory_id": "mem_xyz",
    "created_at": "2025-02-05T11:00:00Z"
}
```

#### Forget Memory

```http
DELETE /v4/memories
Content-Type: application/json

{
    "id": "mem_xyz",                            // OR content + container_tag
    "container_tag": "user_123",
    "reason": "User requested deletion"         // Optional
}

Response 200:
{
    "id": "mem_xyz",
    "forgotten": true
}
```

#### Get User Profile

```http
POST /v4/profile
Content-Type: application/json

{
    "container_tag": "user_123",
    "include_dynamic": true,                    // Include episodes
    "limit": 50
}

Response 200:
{
    "container_tag": "user_123",
    "static_facts": [
        { "memory": "Works at Stripe", "confidence": 0.95, "created_at": "..." }
    ],
    "dynamic_facts": [
        { "memory": "Had coffee meeting Tuesday", "confidence": 0.7, "created_at": "..." }
    ],
    "total_memories": 45,
    "last_updated": "2025-02-05T10:00:00Z"
}
```

### 5.5 Health & Admin

#### Health Check

```http
GET /health

Response 200:
{
    "status": "healthy",
    "version": "0.2.0",
    "database": "connected",
    "embedding_model": "BAAI/bge-small-en-v1.5",
    "llm_provider": "openai"                    // If configured
}
```

---

## 6. Feature Specification

### 6.1 Content Processing Features

#### 6.1.1 Supported Content Types

| Type          | Status      | Extraction Method                |
| ------------- | ----------- | -------------------------------- |
| Plain Text    | ✅ Complete | Direct                           |
| URLs/Webpages | ✅ Complete | HTTP fetch + boilerplate removal |
| PDF           | ✅ Complete | pdf-extract + OCR fallback       |
| HTML          | ✅ Complete | DOM parsing                      |
| Markdown      | ✅ Complete | Native                           |
| Code          | ✅ Complete | Language-aware (tree-sitter)     |
| DOCX          | ✅ Complete | docx-rs                          |
| XLSX          | ✅ Complete | calamine                         |
| PPTX          | ✅ Complete | xml extraction                   |
| CSV           | ✅ Complete | csv crate                        |
| Images        | ✅ Complete | OCR (Tesseract/API)              |
| Audio         | 🔲 Planned  | Whisper.cpp                      |
| Video         | 🔲 Planned  | FFmpeg + Whisper                 |

#### 6.1.2 Smart Chunking

Each content type gets appropriate chunking:

| Content Type          | Chunking Strategy                          |
| --------------------- | ------------------------------------------ |
| Text                  | Token-based with configurable overlap      |
| Markdown              | Heading hierarchy preservation             |
| Code                  | AST-aware (functions, classes stay intact) |
| Webpage               | Article structure extraction               |
| Structured (CSV/XLSX) | Row grouping with headers                  |
| PDF/DOCX              | Section/paragraph boundaries               |

#### 6.1.3 Code Languages Supported

| Language   | Extensions | AST Parser             |
| ---------- | ---------- | ---------------------- |
| TypeScript | .ts, .tsx  | tree-sitter-typescript |
| JavaScript | .js, .jsx  | tree-sitter-javascript |
| Python     | .py, .pyi  | tree-sitter-python     |
| Rust       | .rs        | tree-sitter-rust       |
| Go         | .go        | tree-sitter-go         |
| Java       | .java      | tree-sitter-java       |
| C          | .c, .h     | tree-sitter-c          |
| C++        | .cpp, .hpp | tree-sitter-cpp        |

### 6.2 Memory Intelligence Features

#### 6.2.1 Automatic Memory Extraction

**Status:** 🔲 Planned

Extract facts from content using LLM:

```
Input: "Had a great call with Alex. He's enjoying the new PM role at Stripe,
        working on payments infrastructure. He moved to Seattle."

Extracted:
- "Alex works at Stripe" (Fact)
- "Alex's role is PM" (Fact, extends above)
- "Alex works on payments infrastructure" (Fact, extends above)
- "Alex lives in Seattle" (Fact)
```

#### 6.2.2 Automatic Relationship Detection

**Status:** 🔲 Planned

When creating memories, detect relationships to existing:

| Relationship | Trigger              | Example                                        |
| ------------ | -------------------- | ---------------------------------------------- |
| Updates      | Contradicts existing | "Works at Square" updates "Works at Stripe"    |
| Extends      | Adds detail          | "PM role" extends "Works at Stripe"            |
| Derives      | Inferred             | "Tech company employee" derives from job facts |

#### 6.2.3 Memory Types & Behaviors

**Status:** 🔲 Planned

| Type       | Behavior                           | Example                    |
| ---------- | ---------------------------------- | -------------------------- |
| Fact       | Persists until explicitly updated  | "Alex works at Stripe"     |
| Preference | Strengthens with repetition        | "Prefers morning meetings" |
| Episode    | Decays over time unless reinforced | "Had coffee Tuesday"       |

#### 6.2.4 Automatic Forgetting

**Status:** 🔲 Planned

- **Time-based**: `forget_after` field triggers automatic expiry
- **Decay**: Episodes without access gradually lose relevance
- **Contradiction**: Updated memories mark old as superseded

#### 6.2.5 Derived Inferences

**Status:** 🔲 Planned

Background job analyzes memory clusters and generates inferences:

```
Memory 1: "Alex is a PM at Stripe"
Memory 2: "Alex discusses payment APIs frequently"
         ↓
Derived:  "Alex likely works on Stripe's core payments product"
```

### 6.3 Search Features

#### 6.3.1 Basic Search

**Status:** ✅ Complete

- Vector similarity search
- Threshold filtering
- Container tag filtering
- Pagination

#### 6.3.2 Reranking

**Status:** ✅ Complete

Cross-encoder reranking for improved relevance:

- ~100ms measured latency
- Significantly better ranking for complex queries
- Configurable via `rerank: true` (default: false)
- Local execution via FastEmbed-rs

#### 6.3.3 Query Rewriting

**Status:** 🔲 Planned

LLM-powered query expansion:

- ~400ms additional latency
- Better recall for short/vague queries
- Configurable via `rewrite_query: true`

#### 6.3.4 Hybrid Search Mode

**Status:** 🔲 Planned

Combine document chunks and memories:

- `search_mode: "hybrid"` (default)
- Configurable weight balancing
- Merged, deduplicated results

#### 6.3.5 Temporal-Aware Search

**Status:** ✅ Complete

- Follow `Updates` chains to find current state
- Weight by recency within version chains
- Apply `forget_after` filtering
- Decay scoring for Episodes

#### 6.3.6 Episode Decay

**Status:** ✅ Complete

Episode memories naturally decay in relevance over time based on access patterns:

**Decay Formula:**
```
relevance = base_score * decay_factor^(days_since_access / decay_days)
```

Where:
- `base_score`: Original vector similarity score from search
- `decay_factor`: Configurable decay rate (default: 0.9)
- `decay_days`: Number of days per decay period (default: 30)
- `days_since_access`: Days since `last_accessed` (falls back to `created_at`)

**Auto-Forget Scheduling:**
- Episodes with relevance < `EPISODE_DECAY_THRESHOLD` (default: 0.3) are scheduled for forgetting
- Grace period: `EPISODE_FORGET_GRACE_DAYS` (default: 7) days before permanent deletion
- Static episodes (`is_static = true`) are excluded from decay-based forgetting
- Already-forgotten memories are never rescheduled

**Last Accessed Tracking:**
- `last_accessed` timestamp is updated for ALL memories returned in search results
- Applies to both `/v4/search` (memory search) and hybrid search modes
- Batch updates minimize database round-trips
- Recent access resets the decay clock (relevance returns to ~1.0)

**Configuration:**
```bash
# Episode decay threshold for auto-forget (0.0-1.0)
EPISODE_DECAY_THRESHOLD=0.3

# Days to wait before permanently forgetting low-relevance episodes
EPISODE_FORGET_GRACE_DAYS=7

# Decay formula parameters (existing)
EPISODE_DECAY_DAYS=30
EPISODE_DECAY_FACTOR=0.9
```

**Background Process:**
- `EpisodeDecayManager` runs every 24 hours
- Scans all non-static, non-forgotten Episode memories
- Calculates current relevance for each
- Schedules low-relevance episodes for forgetting with grace period

### 6.4 User Profile Features

#### 6.4.1 Basic Profile

**Status:** ✅ Complete

- Static facts listing
- Dynamic facts listing
- Total memory count

#### 6.4.2 Profile Compaction

**Status:** 🔲 Planned

LLM-summarized profile from memory graph:

- Reduces token usage
- Coherent narrative
- Configurable refresh schedule

---

## 7. Implementation Status

### 7.1 Completed (✅)

| Feature                          | Version | Notes                 |
| -------------------------------- | ------- | --------------------- |
| Core HTTP server                 | 0.1.0   | Axum-based            |
| LibSQL integration               | 0.1.0   | Native vector search  |
| Local embeddings                 | 0.1.0   | FastEmbed/BGE models  |
| External embeddings              | 0.1.0   | OpenAI-compatible API |
| Plain text processing            | 0.1.0   |                       |
| URL extraction                   | 0.1.0   | Boilerplate removal   |
| PDF extraction                   | 0.1.0   |                       |
| HTML extraction                  | 0.1.0   |                       |
| Markdown extraction              | 0.1.0   |                       |
| v3 Document API                  | 0.1.0   | Full CRUD             |
| v4 Memory API                    | 0.1.0   | Basic CRUD            |
| Vector search                    | 0.1.0   |                       |
| Container tags                   | 0.1.0   | Multi-tenancy         |
| Batch ingestion                  | 0.1.0   |                       |
| Memory versioning                | 0.1.0   | Parent/child chains   |
| Memory relations                 | 0.1.0   | Manual only           |
| User profiles                    | 0.1.0   | Basic listing         |
| AST-aware code chunking          | 0.2.0   | Tree-sitter           |
| Office docs (DOCX/XLSX/PPTX)     | 0.2.0   |                       |
| CSV parsing                      | 0.2.0   |                       |
| Semantic chunking infrastructure | 0.2.0   | ChunkerRegistry       |
| Image OCR                        | 0.2.0   | Tesseract + API       |
| Search reranking (cross-encoder) | 0.5.0   | FastEmbed-rs          |

### 7.2 In Progress (🔨)

| Feature             | Target | Notes                   |
| ------------------- | ------ | ----------------------- |
| Audio transcription | 0.3.0  | Whisper.cpp integration |
| Video transcription | 0.3.0  | FFmpeg + Whisper        |

### 7.3 Planned (🔲)

| Feature                          | Target | Priority |
| -------------------------------- | ------ | -------- |
| LLM provider abstraction         | 0.4.0  | Critical |
| Automatic memory extraction      | 0.4.0  | Critical |
| Automatic relationship detection | 0.4.0  | Critical |
| Memory type classification       | 0.4.0  | High     |
| Query rewriting                  | 0.5.0  | High     |
| Hybrid search mode               | 0.5.0  | High     |
| Temporal-aware search            | 0.5.0  | High     |
| Automatic forgetting             | 0.5.0  | Medium   |
| Derived inferences               | 0.6.0  | Medium   |
| Profile compaction               | 0.6.0  | Medium   |
| Graph traversal queries          | 0.6.0  | Medium   |
| TypeScript SDK                   | 1.0.0  | High     |
| Python SDK                       | 1.0.0  | High     |
| MCP server                       | 1.0.0  | Medium   |
| External connectors              | 1.1.0+ | Low      |

---

## 8. Technical Requirements

### 8.1 System Requirements

| Component | Minimum               | Recommended     |
| --------- | --------------------- | --------------- |
| CPU       | 2 cores               | 4+ cores        |
| RAM       | 2 GB                  | 8 GB            |
| Storage   | 1 GB + data           | SSD recommended |
| OS        | Linux, macOS, Windows | Linux (Docker)  |

### 8.2 Dependencies

#### Runtime Dependencies

| Dependency | Purpose  | Notes                        |
| ---------- | -------- | ---------------------------- |
| LibSQL     | Database | Embedded, no external server |
| Tesseract  | OCR      | Optional, for image text     |

#### Build Dependencies

| Dependency | Purpose                 |
| ---------- | ----------------------- |
| Rust 1.75+ | Compiler                |
| Clang/LLVM | Tree-sitter compilation |

### 8.3 Environment Variables

| Variable               | Default                  | Description                   |
| ---------------------- | ------------------------ | ----------------------------- |
| `MOMO_HOST`            | `0.0.0.0`                | Bind address                  |
| `MOMO_PORT`            | `3000`                   | Listen port                   |
| `MOMO_API_KEYS`        | (empty)                  | Comma-separated API keys      |
| `DATABASE_URL`         | `file:momo.db`           | SQLite path or Turso URL      |
| `DATABASE_AUTH_TOKEN`  | -                        | Turso auth token              |
| `EMBEDDING_MODEL`      | `BAAI/bge-small-en-v1.5` | Embedding model               |
| `EMBEDDING_DIMENSIONS` | `384`                    | Vector dimensions             |
| `EMBEDDING_API_KEY`    | -                        | For external embeddings       |
| `EMBEDDING_BASE_URL`   | -                        | Custom embedding API          |
| `LLM_MODEL`            | -                        | LLM for intelligence features |
| `LLM_API_KEY`          | -                        | LLM API key                   |
| `LLM_BASE_URL`         | -                        | Custom LLM API                |
| `OCR_MODEL`            | `local/tesseract`        | OCR provider                  |
| `OCR_LANGUAGES`        | `eng`                    | Tesseract languages           |
| `CHUNK_SIZE`           | `512`                    | Tokens per chunk              |
| `CHUNK_OVERLAP`        | `50`                     | Overlap tokens                |

---

## 9. Testing Strategy

### 9.1 Test Categories

| Category          | Coverage Target | Tools                   |
| ----------------- | --------------- | ----------------------- |
| Unit Tests        | 80%             | `cargo test`            |
| Integration Tests | Key paths       | `cargo test --test '*'` |
| API Tests         | All endpoints   | Custom test harness     |
| Performance Tests | Critical paths  | Criterion benchmarks    |

### 9.2 Test Structure

```
tests/
├── unit/
│   ├── chunker_test.rs
│   ├── embedding_test.rs
│   └── memory_test.rs
├── integration/
│   ├── api_v3_test.rs
│   ├── api_v4_test.rs
│   └── pipeline_test.rs
└── performance/
    ├── search_bench.rs
    └── ingestion_bench.rs
```

### 9.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
- Build & compile check
- Run unit tests
- Run integration tests
- Clippy linting
- Format check
- Build Docker image
- (Optional) Deploy to staging
```

---

## 10. Deployment

### 10.1 Docker

```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    ca-certificates \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/momo /usr/local/bin/
EXPOSE 3000
CMD ["momo"]
```

### 10.2 Docker Compose

```yaml
version: "3.8"
services:
  momo:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - DATABASE_URL=file:/data/momo.db
      - EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
      - LLM_MODEL=openai/gpt-4o-mini
      - LLM_API_KEY=${OPENAI_API_KEY}
```

### 10.3 Binary Distribution

Single binary releases for:

- Linux (x86_64, aarch64)
- macOS (x86_64, aarch64)
- Windows (x86_64)

---

## Appendix A: Supermemory Feature Mapping

| Supermemory Feature         | Momo Status | Notes         |
| --------------------------- | ----------- | ------------- |
| Vector search               | ✅          | LibSQL native |
| Document storage            | ✅          |               |
| Smart chunking              | ✅          | AST-aware     |
| Memory versioning           | ✅          |               |
| Memory relations            | ✅          |               |
| Auto memory extraction      | ✅          | Phase 4       |
| Auto relationship detection | ✅          | Phase 4       |
| Auto forgetting             | 🔲 Planned  | Phase 5       |
| Reranking                   | ✅ Complete | Phase 5       |
| Query rewriting             | 🔲 Planned  | Phase 5       |
| Hybrid search               | 🔲 Planned  | Phase 5       |
| Profile compaction          | 🔲 Planned  | Phase 6       |
| Derived inferences          | 🔲 Planned  | Phase 6       |
| External connectors         | 🔲 Planned  | Phase 7       |
| SDKs                        | 🔲 Planned  | Phase 8       |

---

## Appendix B: Glossary

| Term              | Definition                                                     |
| ----------------- | -------------------------------------------------------------- |
| **Memory**        | An intelligent fact, preference, or episode with relationships |
| **Document**      | Raw input content (PDF, webpage, text, etc.)                   |
| **Chunk**         | A semantic unit of a document with embedding                   |
| **Container Tag** | User/entity identifier for multi-tenancy                       |
| **Updates**       | Relationship where new memory replaces old                     |
| **Extends**       | Relationship where new memory adds to existing                 |
| **Derives**       | Relationship where memory is inferred from patterns            |
| **Fact**          | Memory that persists until updated                             |
| **Preference**    | Memory that strengthens with repetition                        |
| **Episode**       | Memory that decays over time                                   |

---

_Document maintained by the Momo development team._
