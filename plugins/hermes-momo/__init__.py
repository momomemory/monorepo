"""Momo memory plugin using the Hermes MemoryProvider interface."""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent.memory_provider import MemoryProvider
from tools.registry import tool_error

logger = logging.getLogger(__name__)

_DEFAULT_BASE_URL = "http://localhost:3000"
_DEFAULT_CONTAINER_TAG = "hermes"
_DEFAULT_MAX_RECALL_RESULTS = 10
_DEFAULT_PROFILE_FREQUENCY = 50
_DEFAULT_API_TIMEOUT = 5.0
_MIN_CAPTURE_LENGTH = 10
_TRIVIAL_RE = re.compile(
    r"^(ok|okay|thanks|thank you|got it|sure|yes|no|yep|nope|k|ty|thx|np|hi|hello)\.?$",
    re.IGNORECASE,
)
_CONTEXT_STRIP_RE = re.compile(r"<momo-context>[\s\S]*?</momo-context>\s*", re.DOTALL)


def _default_config() -> dict[str, Any]:
    return {
        "base_url": _DEFAULT_BASE_URL,
        "container_tag": _DEFAULT_CONTAINER_TAG,
        "auto_recall": True,
        "auto_capture": True,
        "max_recall_results": _DEFAULT_MAX_RECALL_RESULTS,
        "profile_frequency": _DEFAULT_PROFILE_FREQUENCY,
        "api_timeout": _DEFAULT_API_TIMEOUT,
    }


def _as_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "1", "yes", "y", "on"):
            return True
        if lowered in ("false", "0", "no", "n", "off"):
            return False
    return default


def _sanitize_tag(raw: str) -> str:
    tag = re.sub(r"[^a-zA-Z0-9_-]", "_", raw or "")
    tag = re.sub(r"_+", "_", tag)
    return tag.strip("_") or _DEFAULT_CONTAINER_TAG


def _load_json_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.debug("Failed to parse %s", path, exc_info=True)
        return {}
    return raw if isinstance(raw, dict) else {}


def _load_momo_config(hermes_home: str) -> dict[str, Any]:
    config = _default_config()
    config.update(
        {
            k: v
            for k, v in _load_json_config(Path(hermes_home) / "momo.json").items()
            if v is not None
        }
    )

    if os.getenv("MOMO_BASE_URL"):
        config["base_url"] = os.getenv("MOMO_BASE_URL")
    if os.getenv("MOMO_API_KEY"):
        config["api_key"] = os.getenv("MOMO_API_KEY")
    if os.getenv("MOMO_CONTAINER_TAG"):
        config["container_tag"] = os.getenv("MOMO_CONTAINER_TAG")
    if os.getenv("MOMO_AUTO_RECALL"):
        config["auto_recall"] = _as_bool(os.getenv("MOMO_AUTO_RECALL"), True)
    if os.getenv("MOMO_AUTO_CAPTURE"):
        config["auto_capture"] = _as_bool(os.getenv("MOMO_AUTO_CAPTURE"), True)
    if os.getenv("MOMO_MAX_RECALL_RESULTS"):
        config["max_recall_results"] = os.getenv("MOMO_MAX_RECALL_RESULTS")
    if os.getenv("MOMO_PROFILE_FREQUENCY"):
        config["profile_frequency"] = os.getenv("MOMO_PROFILE_FREQUENCY")
    if os.getenv("MOMO_API_TIMEOUT"):
        config["api_timeout"] = os.getenv("MOMO_API_TIMEOUT")

    raw_tag = str(config.get("container_tag", _DEFAULT_CONTAINER_TAG)).strip()
    config["container_tag"] = raw_tag or _DEFAULT_CONTAINER_TAG
    config["auto_recall"] = _as_bool(config.get("auto_recall"), True)
    config["auto_capture"] = _as_bool(config.get("auto_capture"), True)

    try:
        config["max_recall_results"] = max(
            1,
            min(20, int(config.get("max_recall_results", _DEFAULT_MAX_RECALL_RESULTS))),
        )
    except Exception:
        config["max_recall_results"] = _DEFAULT_MAX_RECALL_RESULTS

    try:
        config["profile_frequency"] = max(
            1,
            min(500, int(config.get("profile_frequency", _DEFAULT_PROFILE_FREQUENCY))),
        )
    except Exception:
        config["profile_frequency"] = _DEFAULT_PROFILE_FREQUENCY

    try:
        config["api_timeout"] = max(
            0.5,
            min(15.0, float(config.get("api_timeout", _DEFAULT_API_TIMEOUT))),
        )
    except Exception:
        config["api_timeout"] = _DEFAULT_API_TIMEOUT

    return config


def _save_momo_config(values: dict[str, Any], hermes_home: str) -> None:
    config_path = Path(hermes_home) / "momo.json"
    existing = _load_json_config(config_path)
    existing.update(values)
    config_path.write_text(
        json.dumps(existing, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def _clean_text_for_capture(text: str) -> str:
    return _CONTEXT_STRIP_RE.sub("", text or "").strip()


def _is_trivial_message(text: str) -> bool:
    return bool(_TRIVIAL_RE.match((text or "").strip()))


def _detect_memory_type(content: str) -> str:
    lowered = content.lower()
    if re.search(r"prefer|like|love|hate|want", lowered):
        return "preference"
    return "fact"


def _format_relative_time(iso_timestamp: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        seconds = (now - dt).total_seconds()
        if seconds < 1800:
            return "just now"
        if seconds < 3600:
            return f"{int(seconds / 60)}m ago"
        if seconds < 86400:
            return f"{int(seconds / 3600)}h ago"
        if seconds < 604800:
            return f"{int(seconds / 86400)}d ago"
        if dt.year == now.year:
            return dt.strftime("%d %b")
        return dt.strftime("%d %b %Y")
    except Exception:
        return ""


def _extract_data(payload: Optional[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    data = payload.get("data")
    return data if isinstance(data, dict) else {}


class _MomoClient:
    def __init__(self, base_url: str, timeout: float, api_key: str = ""):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._api_key = api_key

    def _request(
        self, method: str, endpoint: str, data: Optional[dict[str, Any]] = None
    ) -> Optional[dict[str, Any]]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        req = urllib.request.Request(
            f"{self._base_url}{endpoint}",
            data=json.dumps(data).encode("utf-8") if data is not None else None,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError:
            logger.warning(
                "Momo API request failed: %s %s", method, endpoint, exc_info=True
            )
            return None
        except Exception:
            logger.warning(
                "Momo API request failed: %s %s", method, endpoint, exc_info=True
            )
            return None

        if not body:
            return {}
        try:
            return json.loads(body)
        except Exception:
            logger.warning(
                "Failed to decode Momo response for %s %s",
                method,
                endpoint,
                exc_info=True,
            )
            return None

    def add_memory(
        self,
        content: str,
        container_tag: str,
        *,
        memory_type: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "content": content.strip(),
            "containerTag": container_tag,
            "memoryType": memory_type,
        }
        if metadata:
            payload["metadata"] = metadata
        return _extract_data(self._request("POST", "/api/v1/memories", payload))

    def forget_memory(self, memory_id: str) -> dict[str, Any]:
        return _extract_data(self._request("DELETE", f"/api/v1/memories/{memory_id}"))

    def forget_by_query(self, query: str, container_tag: str) -> dict[str, Any]:
        payload = {
            "content": query,
            "containerTag": container_tag,
        }
        return _extract_data(self._request("POST", "/api/v1/memories:forget", payload))

    def search_memories(
        self, query: str, container_tag: str, *, limit: int
    ) -> list[dict[str, Any]]:
        payload = {
            "q": query,
            "scope": "memories",
            "containerTags": [container_tag],
            "limit": limit,
        }
        data = _extract_data(self._request("POST", "/api/v1/search", payload))
        raw_results = data.get("results", []) if isinstance(data, dict) else []
        results: list[dict[str, Any]] = []
        for item in raw_results:
            if not isinstance(item, dict) or item.get("type") != "memory":
                continue
            results.append(
                {
                    "id": item.get("memoryId", ""),
                    "content": item.get("content") or "",
                    "similarity": item.get("similarity"),
                    "updated_at": item.get("updatedAt") or "",
                    "metadata": item.get("metadata")
                    if isinstance(item.get("metadata"), dict)
                    else {},
                }
            )
        return results

    def get_profile(
        self, container_tag: str, *, query: Optional[str] = None
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "containerTag": container_tag,
            "generateNarrative": True,
        }
        if query:
            payload["q"] = query
        return _extract_data(self._request("POST", "/api/v1/profile:compute", payload))


STORE_SCHEMA = {
    "name": "momo_store",
    "description": "Store an explicit memory in Momo for future recall.",
    "parameters": {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "The memory content to store.",
            },
            "type": {
                "type": "string",
                "description": "Optional memory type.",
                "enum": ["fact", "preference", "episode"],
            },
            "metadata": {
                "type": "object",
                "description": "Optional metadata attached to the memory.",
            },
        },
        "required": ["content"],
    },
}

SEARCH_SCHEMA = {
    "name": "momo_search",
    "description": "Search Momo long-term memory by semantic similarity.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "What to search for."},
            "limit": {
                "type": "integer",
                "description": "Maximum results to return, 1 to 20.",
            },
        },
        "required": ["query"],
    },
}

FORGET_SCHEMA = {
    "name": "momo_forget",
    "description": "Forget a memory by exact id or by best-match query.",
    "parameters": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "Exact memory id to delete."},
            "query": {
                "type": "string",
                "description": "Query used to find the memory to forget.",
            },
        },
    },
}

PROFILE_SCHEMA = {
    "name": "momo_profile",
    "description": "Retrieve persistent profile facts and recent context from Momo.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Optional query to focus the profile response.",
            },
        },
    },
}


class MomoMemoryProvider(MemoryProvider):
    def __init__(self):
        self._config = _default_config()
        self._client: Optional[_MomoClient] = None
        self._base_url = _DEFAULT_BASE_URL
        self._api_key = ""
        self._container_tag = _DEFAULT_CONTAINER_TAG
        self._auto_recall = True
        self._auto_capture = True
        self._max_recall_results = _DEFAULT_MAX_RECALL_RESULTS
        self._profile_frequency = _DEFAULT_PROFILE_FREQUENCY
        self._api_timeout = _DEFAULT_API_TIMEOUT
        self._turn_count = 0
        self._write_enabled = True
        self._active = False
        self._sync_thread: Optional[threading.Thread] = None
        self._write_thread: Optional[threading.Thread] = None

    @property
    def name(self) -> str:
        return "momo"

    def is_available(self) -> bool:
        hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
        config_path = Path(hermes_home) / "momo.json"
        return bool(
            os.getenv("MOMO_BASE_URL")
            or os.getenv("MOMO_API_KEY")
            or os.getenv("MOMO_CONTAINER_TAG")
            or config_path.exists()
        )

    def get_config_schema(self) -> List[Dict[str, Any]]:
        return [
            {
                "key": "base_url",
                "description": "Momo base URL",
                "default": _DEFAULT_BASE_URL,
            },
            {
                "key": "api_key",
                "description": "Momo API key",
                "secret": True,
                "env_var": "MOMO_API_KEY",
            },
            {
                "key": "container_tag",
                "description": "Primary Momo container tag",
                "default": "hermes-{identity}",
            },
            {
                "key": "auto_recall",
                "description": "Inject memory context before turns",
                "default": True,
            },
            {
                "key": "auto_capture",
                "description": "Store conversation turns as episode memories",
                "default": True,
            },
        ]

    def save_config(self, values: Dict[str, Any], hermes_home: str) -> None:
        sanitized = dict(values or {})
        if "container_tag" in sanitized:
            raw_tag = str(sanitized["container_tag"] or "").strip()
            sanitized["container_tag"] = raw_tag or _DEFAULT_CONTAINER_TAG
        _save_momo_config(sanitized, hermes_home)

    def initialize(self, session_id: str, **kwargs) -> None:
        hermes_home = kwargs.get("hermes_home") or os.environ.get(
            "HERMES_HOME", os.path.expanduser("~/.hermes")
        )
        self._config = _load_momo_config(str(hermes_home))
        self._base_url = (
            str(self._config.get("base_url", _DEFAULT_BASE_URL)).strip()
            or _DEFAULT_BASE_URL
        )
        self._api_key = str(self._config.get("api_key", "") or "")

        raw_tag = (
            str(self._config.get("container_tag", _DEFAULT_CONTAINER_TAG)).strip()
            or _DEFAULT_CONTAINER_TAG
        )
        identity = kwargs.get("agent_identity", "default") or "default"
        self._container_tag = _sanitize_tag(raw_tag.replace("{identity}", identity))

        self._auto_recall = bool(self._config["auto_recall"])
        self._auto_capture = bool(self._config["auto_capture"])
        self._max_recall_results = int(self._config["max_recall_results"])
        self._profile_frequency = int(self._config["profile_frequency"])
        self._api_timeout = float(self._config["api_timeout"])
        self._turn_count = 0

        agent_context = kwargs.get("agent_context", "")
        self._write_enabled = agent_context not in ("cron", "flush", "subagent")
        self._active = bool(self._base_url)
        self._client = (
            _MomoClient(self._base_url, self._api_timeout, api_key=self._api_key)
            if self._active
            else None
        )

    def on_turn_start(self, turn_number: int, message: str, **kwargs) -> None:
        self._turn_count = max(turn_number, 0)

    def system_prompt_block(self) -> str:
        if not self._active:
            return ""
        return "\n".join(
            [
                "# Momo",
                f"Active. Container: {self._container_tag}.",
                "Use momo_search, momo_store, momo_forget, and momo_profile for explicit memory operations.",
            ]
        )

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        if (
            not self._active
            or not self._auto_recall
            or not self._client
            or not query.strip()
        ):
            return ""
        try:
            profile = self._client.get_profile(self._container_tag, query=query[:200])
            include_profile = self._turn_count <= 1 or (
                self._turn_count % self._profile_frequency == 0
            )
            search_results = self._client.search_memories(
                query,
                self._container_tag,
                limit=self._max_recall_results,
            )
        except Exception:
            logger.debug("Momo prefetch failed", exc_info=True)
            return ""

        sections = []
        if include_profile:
            narrative = str(profile.get("narrative") or "").strip()
            if narrative:
                sections.append(f"## Profile Summary\n{narrative}")

            static_lines = []
            for item in profile.get("staticFacts") or []:
                content = item.get("content") if isinstance(item, dict) else str(item)
                if content:
                    static_lines.append(f"- {content}")
            if static_lines:
                sections.append(
                    "## User Profile (Persistent)\n"
                    + "\n".join(static_lines[: self._max_recall_results])
                )

            dynamic_lines = []
            for item in profile.get("dynamicFacts") or []:
                content = item.get("content") if isinstance(item, dict) else str(item)
                if content:
                    dynamic_lines.append(f"- {content}")
            if dynamic_lines:
                sections.append(
                    "## Recent Context\n"
                    + "\n".join(dynamic_lines[: self._max_recall_results])
                )

        memory_lines = []
        for item in search_results[: self._max_recall_results]:
            content = str(item.get("content") or "").strip()
            if not content:
                continue
            prefix_bits = []
            updated = _format_relative_time(str(item.get("updated_at") or ""))
            if updated:
                prefix_bits.append(f"[{updated}]")
            similarity = item.get("similarity")
            if similarity is not None:
                try:
                    prefix_bits.append(f"[{round(float(similarity) * 100)}%]")
                except Exception:
                    pass
            prefix = " ".join(prefix_bits)
            memory_lines.append(f"- {prefix} {content}".strip())
        if memory_lines:
            sections.append("## Relevant Memories\n" + "\n".join(memory_lines))

        if not sections:
            return ""

        intro = (
            "The following is background context from long-term memory. Use it silently when relevant. "
            "Do not force memories into the conversation."
        )
        return (
            f"<momo-context>\n{intro}\n\n" + "\n\n".join(sections) + "\n</momo-context>"
        )

    def sync_turn(
        self, user_content: str, assistant_content: str, *, session_id: str = ""
    ) -> None:
        if (
            not self._active
            or not self._auto_capture
            or not self._write_enabled
            or not self._client
        ):
            return

        clean_user = _clean_text_for_capture(user_content)
        clean_assistant = _clean_text_for_capture(assistant_content)
        if not clean_user or not clean_assistant:
            return
        if (
            len(clean_user) < _MIN_CAPTURE_LENGTH
            or len(clean_assistant) < _MIN_CAPTURE_LENGTH
        ):
            return
        if _is_trivial_message(clean_user):
            return

        content = (
            f"[role: user]\n{clean_user}\n[user:end]\n\n"
            f"[role: assistant]\n{clean_assistant}\n[assistant:end]"
        )
        metadata = {"source": "hermes", "type": "conversation_turn"}

        def _run() -> None:
            try:
                self._client.add_memory(
                    content,
                    self._container_tag,
                    memory_type="episode",
                    metadata=metadata,
                )
            except Exception:
                logger.debug("Momo sync_turn failed", exc_info=True)

        if self._sync_thread and self._sync_thread.is_alive():
            self._sync_thread.join(timeout=2.0)
        self._sync_thread = threading.Thread(target=_run, daemon=True, name="momo-sync")
        self._sync_thread.start()

    def on_memory_write(self, action: str, target: str, content: str) -> None:
        if not self._active or not self._write_enabled or not self._client:
            return
        if action != "add" or not (content or "").strip():
            return

        def _run() -> None:
            try:
                self._client.add_memory(
                    content.strip(),
                    self._container_tag,
                    memory_type="fact",
                    metadata={
                        "source": "hermes_memory",
                        "target": target,
                        "type": "explicit_memory",
                    },
                )
            except Exception:
                logger.debug("Momo on_memory_write failed", exc_info=True)

        if self._write_thread and self._write_thread.is_alive():
            self._write_thread.join(timeout=2.0)
        self._write_thread = threading.Thread(
            target=_run, daemon=False, name="momo-memory-write"
        )
        self._write_thread.start()

    def shutdown(self) -> None:
        for attr_name in ("_sync_thread", "_write_thread"):
            thread = getattr(self, attr_name, None)
            if thread and thread.is_alive():
                thread.join(timeout=5.0)
            setattr(self, attr_name, None)

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        return [STORE_SCHEMA, SEARCH_SCHEMA, FORGET_SCHEMA, PROFILE_SCHEMA]

    def _tool_store(self, args: Dict[str, Any]) -> str:
        content = str(args.get("content") or "").strip()
        if not content:
            return tool_error("content is required")
        memory_type = (
            str(args.get("type") or _detect_memory_type(content)).strip().lower()
        )
        if memory_type not in ("fact", "preference", "episode"):
            memory_type = _detect_memory_type(content)
        metadata = args.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}
        metadata.setdefault("source", "hermes_tool")
        metadata.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        try:
            result = self._client.add_memory(
                content,
                self._container_tag,
                memory_type=memory_type,
                metadata=metadata,
            )
        except Exception as exc:
            return tool_error(f"Failed to store memory: {exc}")

        preview = content[:80] + ("..." if len(content) > 80 else "")
        return json.dumps(
            {
                "saved": True,
                "id": result.get("memoryId", ""),
                "type": memory_type,
                "preview": preview,
                "container_tag": self._container_tag,
            }
        )

    def _tool_search(self, args: Dict[str, Any]) -> str:
        query = str(args.get("query") or "").strip()
        if not query:
            return tool_error("query is required")
        try:
            limit = max(1, min(20, int(args.get("limit", 5) or 5)))
        except Exception:
            limit = 5
        try:
            results = self._client.search_memories(
                query, self._container_tag, limit=limit
            )
        except Exception as exc:
            return tool_error(f"Search failed: {exc}")

        formatted = []
        for item in results:
            entry: dict[str, Any] = {
                "id": item.get("id", ""),
                "content": item.get("content", ""),
            }
            if item.get("similarity") is not None:
                try:
                    entry["similarity"] = round(float(item["similarity"]) * 100)
                except Exception:
                    pass
            if item.get("updated_at"):
                entry["updated_at"] = item["updated_at"]
            formatted.append(entry)
        return json.dumps(
            {
                "results": formatted,
                "count": len(formatted),
                "container_tag": self._container_tag,
            }
        )

    def _tool_forget(self, args: Dict[str, Any]) -> str:
        memory_id = str(args.get("id") or "").strip()
        query = str(args.get("query") or "").strip()
        if not memory_id and not query:
            return tool_error("Provide either id or query")
        try:
            if memory_id:
                result = self._client.forget_memory(memory_id)
                return json.dumps(
                    {
                        "forgotten": bool(result.get("forgotten", True)),
                        "id": result.get("memoryId", memory_id),
                    }
                )

            result = self._client.forget_by_query(query, self._container_tag)
            response = {
                "forgotten": bool(result.get("forgotten", False)),
                "id": result.get("memoryId", ""),
                "query": query,
            }
            return json.dumps(response)
        except Exception as exc:
            return tool_error(f"Forget failed: {exc}")

    def _tool_profile(self, args: Dict[str, Any]) -> str:
        query = str(args.get("query") or "").strip() or None
        try:
            profile = self._client.get_profile(self._container_tag, query=query)
        except Exception as exc:
            return tool_error(f"Profile failed: {exc}")

        narrative = str(profile.get("narrative") or "").strip()
        static_facts = [
            item.get("content")
            for item in profile.get("staticFacts") or []
            if isinstance(item, dict) and item.get("content")
        ]
        dynamic_facts = [
            item.get("content")
            for item in profile.get("dynamicFacts") or []
            if isinstance(item, dict) and item.get("content")
        ]
        sections = []
        if narrative:
            sections.append(f"## Profile Summary\n{narrative}")
        if static_facts:
            sections.append(
                "## User Profile (Persistent)\n"
                + "\n".join(f"- {item}" for item in static_facts)
            )
        if dynamic_facts:
            sections.append(
                "## Recent Context\n" + "\n".join(f"- {item}" for item in dynamic_facts)
            )
        return json.dumps(
            {
                "profile": "\n\n".join(sections),
                "narrative": narrative,
                "static_facts": static_facts,
                "dynamic_facts": dynamic_facts,
                "static_count": len(static_facts),
                "dynamic_count": len(dynamic_facts),
                "total_memories": profile.get("totalMemories", 0),
                "container_tag": profile.get("containerTag", self._container_tag),
            }
        )

    def handle_tool_call(self, tool_name: str, args: Dict[str, Any], **kwargs) -> str:
        if not self._active or not self._client:
            return tool_error("Momo is not configured")
        if tool_name == "momo_store":
            return self._tool_store(args)
        if tool_name == "momo_search":
            return self._tool_search(args)
        if tool_name == "momo_forget":
            return self._tool_forget(args)
        if tool_name == "momo_profile":
            return self._tool_profile(args)
        return tool_error(f"Unknown tool: {tool_name}")


def register(ctx):
    ctx.register_memory_provider(MomoMemoryProvider())
