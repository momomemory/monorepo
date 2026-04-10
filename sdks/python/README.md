# momo-sdk

Official Python SDK for [Momo](https://github.com/momomemory/momo) — a self-hostable AI memory system.

## Installation

```bash
pip install momo-sdk
# or with uv
uv add momo-sdk
```

## Requirements

- Python 3.10+
- A running Momo server

## Quick start

### Sync

```python
from momo_sdk import MomoClient

client = MomoClient(
    base_url="http://localhost:3000",
    api_key="your-api-key",
    default_container_tag="user-123",  # applied to all requests automatically
)

# Health check
health = client.health.check()
print(health.status)  # "ok"

# Create a document
doc = client.documents.create(
    "The quick brown fox jumps over the lazy dog.",
    metadata={"source": "example"},
)
print(doc.document_id)

# Search
results = client.search.search("fox", scope="documents")
for result in results.results:
    print(result)

# Upload a file
with open("report.pdf", "rb") as f:
    doc = client.documents.upload(f, filename="report.pdf")

# Or by path
doc = client.documents.upload("/path/to/report.pdf")
```

### Async

```python
import asyncio
from momo_sdk import AsyncMomoClient

async def main():
    async with AsyncMomoClient(
        base_url="http://localhost:3000",
        api_key="your-api-key",
        default_container_tag="user-123",
    ) as client:
        health = await client.health.check()
        print(health.status)

        results = await client.search.search("fox")
        for r in results.results:
            print(r)

asyncio.run(main())
```

## Configuration

| Parameter | Type | Description |
|-----------|------|-------------|
| `base_url` | `str` | Base URL of your Momo server |
| `api_key` | `str \| None` | Static API key for Bearer auth |
| `get_api_key` | `Callable \| None` | Dynamic key provider (sync or async) |
| `default_container_tag` | `str \| None` | Container tag applied to requests automatically |
| `timeout` | `float \| httpx.Timeout \| None` | Request timeout in seconds (default: 30) |
| `http_client` | `httpx.Client \| None` | Custom sync HTTP client |
| `async_http_client` | `httpx.AsyncClient \| None` | Custom async HTTP client |
| `extra_headers` | `dict \| None` | Headers added to every request |

## Per-request options

```python
from momo_sdk import RequestOptions

opts = RequestOptions(timeout=5.0, headers={"X-Request-Id": "abc"})
health = client.health.check(options=opts)
```

## Error handling

```python
from momo_sdk import MomoError

try:
    doc = client.documents.get("nonexistent-id")
except MomoError as e:
    print(e.status)   # 404
    print(e.code)     # "not_found"
    print(str(e))     # "Document not found"
```

Error codes: `invalid_request`, `unauthorized`, `not_found`, `conflict`,
`internal_error`, `not_implemented`.

## API reference

### `client.documents`

| Method | Description |
|--------|-------------|
| `create(content, *, metadata, container_tag, ...)` | Create a text document |
| `batch_create(documents, *, container_tag, ...)` | Create multiple documents |
| `upload(source, *, filename, container_tag, ...)` | Upload a file (path, bytes, or file object) |
| `get(document_id)` | Fetch a document by ID |
| `update(document_id, *, metadata, ...)` | Update document metadata |
| `delete(document_id)` | Delete a document |
| `list(*, container_tag, cursor, limit)` | List documents |
| `get_ingestion_status(ingestion_id)` | Poll ingestion status |

### `client.memories`

| Method | Description |
|--------|-------------|
| `create(content, *, container_tag, ...)` | Create a memory |
| `get(memory_id)` | Fetch a memory |
| `update(memory_id, *, content, ...)` | Update a memory |
| `list(*, container_tag, cursor, limit)` | List memories |
| `forget(content, container_tag, ...)` | Content-based forget |
| `forget_by_id(memory_id, ...)` | Forget by ID |

### `client.search`

| Method | Description |
|--------|-------------|
| `search(q, *, container_tags, scope, limit, ...)` | Hybrid search |

### `client.conversations`

| Method | Description |
|--------|-------------|
| `ingest(messages, *, container_tag, session_id, ...)` | Ingest a conversation |

### `client.graph`

| Method | Description |
|--------|-------------|
| `get_memory_graph(memory_id, *, depth, max_nodes, ...)` | Graph for a memory |
| `get_container_graph(container_tag, *, max_nodes)` | Graph for a container |

### `client.profile`

| Method | Description |
|--------|-------------|
| `compute(*, container_tag, q, ...)` | Compute a container profile |

### `client.admin`

| Method | Description |
|--------|-------------|
| `run_forgetting()` | Trigger a forgetting pass |

### `client.health`

| Method | Description |
|--------|-------------|
| `check()` | Check server health |

## Low-level access

The underlying `httpx` client is exposed for advanced use:

```python
# Sync
raw: httpx.Client = client.raw

# Async
raw: httpx.AsyncClient = async_client.raw
```

## Context managers

```python
# Sync
with MomoClient(base_url="...", api_key="...") as client:
    ...

# Async
async with AsyncMomoClient(base_url="...", api_key="...") as client:
    ...
```

## License

MIT
