"""Momo memory plugin for Hermes Agent.

Self-hostable AI memory system with vector search, providing long-term memory
cross-session persistence for Hermes Agent.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent.memory_provider import MemoryProvider
from tools.registry import tool_error

logger = logging.getLogger(__name__)

# Default configuration values
_DEFAULT_BASE_URL = "http://localhost:3000"
_DEFAULT_CONTAINER_TAG = "hermes"
_DEFAULT_MAX_RECALL_RESULTS = 10
_DEFAULT_PROFILE_FREQUENCY = 50
_DEFAULT_AUTO_RECALL = True
_DEFAULT_AUTO_CAPTURE = True
_DEFAULT_API_TIMEOUT = 5.0

# Regex patterns
_TRIVIAL_RE = re.compile(
    r"^(ok|okay|thanks|thank you|got it|sure|yes|no|yep|nope|k|ty|thx|np|hi|hello)\.?$",
    re.IGNORECASE,
)
_CONTEXT_STRIP_RE = re.compile(
    r"<momo-context>[\s\S]*?</momo-context>\s*", re.DOTALL
)


def _default_config() -> dict:
    """Return default configuration."""
    return {
        "base_url": _DEFAULT_BASE_URL,
        "container_tag": _DEFAULT_CONTAINER_TAG,
        "auto_recall": _DEFAULT_AUTO_RECALL,
        "auto_capture": _DEFAULT_AUTO_CAPTURE,
        "max_recall_results": _DEFAULT_MAX_RECALL_RESULTS,
        "profile_frequency": _DEFAULT_PROFILE_FREQUENCY,
        "api_timeout": _DEFAULT_API_TIMEOUT,
    }


def _as_bool(value: Any, default: bool) -> bool:
    """Convert value to boolean."""
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
    """Sanitize container tag to valid format."""
    tag = re.sub(r"[^a-zA-Z0-9_-]", "_", raw or "")
    tag = re.sub(r"_+", "_", tag)
    return tag.strip("_") or _DEFAULT_CONTAINER_TAG


def _load_momo_config(hermes_home: str) -> dict:
    """Load Momo configuration from file and env vars."""
    config = _default_config()
    
    # Load from config file
    config_path = Path(hermes_home) / "momo.json"
    if config_path.exists():
        try:
            raw = json.loads(config_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                config.update({k: v for k, v in raw.items() if v is not None})
        except Exception:
            logger.debug("Failed to parse %s", config_path, exc_info=True)
    
    # Override with environment variables (highest priority)
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
        try:
            config["max_recall_results"] = max(1, min(20, int(os.getenv("MOMO_MAX_RECALL_RESULTS"))))
        except ValueError:
            pass
    if os.getenv("MOMO_PROFILE_FREQUENCY"):
        try:
            config["profile_frequency"] = max(1, min(500, int(os.getenv("MOMO_PROFILE_FREQUENCY"))))
        except ValueError:
            pass
    
    # Sanitize container tag
    config["container_tag"] = _sanitize_tag(config.get("container_tag", _DEFAULT_CONTAINER_TAG))
    
    # Ensure boolean types
    config["auto_recall"] = _as_bool(config.get("auto_recall"), _DEFAULT_AUTO_RECALL)
    config["auto_capture"] = _as_bool(config.get("auto_capture"), _DEFAULT_AUTO_CAPTURE)
    
    # Clamp numeric values
    try:
        config["max_recall_results"] = max(1, min(20, int(config.get("max_recall_results", _DEFAULT_MAX_RECALL_RESULTS))))
    except (ValueError, TypeError):
        config["max_recall_results"] = _DEFAULT_MAX_RECALL_RESULTS
    
    try:
        config["profile_frequency"] = max(1, min(500, int(config.get("profile_frequency", _DEFAULT_PROFILE_FREQUENCY))))
    except (ValueError, TypeError):
        config["profile_frequency"] = _DEFAULT_PROFILE_FREQUENCY
    
    try:
        config["api_timeout"] = max(0.5, min(15.0, float(config.get("api_timeout", _DEFAULT_API_TIMEOUT))))
    except (ValueError, TypeError):
        config["api_timeout"] = _DEFAULT_API_TIMEOUT
    
    return config


class MomoProvider(MemoryProvider):
    """Momo memory provider implementation for Hermes Agent."""

    @property
    def name(self) -> str:
        """Return provider name."""
        return "momo"

    def is_available(self) -> bool:
        """Check if Momo is configured and ready."""
        return True  # Config is validated on init

    def get_tool_schemas(self) -> List[Dict]:
        """Return tool schemas for Momo tools."""
        return self.get_tools()

    def __init__(self):
        self.config: Dict[str, Any] = {}
        self.api_key: Optional[str] = None
        self.container_tag: str = _DEFAULT_CONTAINER_TAG
        self.turn_count: int = 0
        self._session_memories: List[Dict] = []

    def initialize(self, session_id: str, **kwargs) -> None:
        """Initialize the Momo provider."""
        hermes_home = kwargs.get("hermes_home", "")
        profile = kwargs.get("agent_identity", "default")
        self.config = _load_momo_config(hermes_home)
        self.api_key = self.config.get("api_key")
        self.container_tag = self.config.get("container_tag", _DEFAULT_CONTAINER_TAG)

        # Resolve {identity} template in container tag
        if "{identity}" in self.container_tag:
            identity = profile if profile != "default" else "default"
            self.container_tag = self.container_tag.replace("{identity}", identity)

        logger.info(
            "Momo initialized: url=%s container=%s recall=%s capture=%s",
            self.config.get("base_url"),
            self.container_tag,
            self.config.get("auto_recall"),
            self.config.get("auto_capture"),
        )
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        timeout: Optional[float] = None,
    ) -> Optional[Dict]:
        """Make HTTP request to Momo API."""
        base_url = self.config.get("base_url", _DEFAULT_BASE_URL).rstrip("/")
        url = f"{base_url}{endpoint}"
        
        timeout = timeout or self.config.get("api_timeout", _DEFAULT_API_TIMEOUT)
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8") if data else None,
                headers=headers,
                method=method,
            )
            
            with urllib.request.urlopen(req, timeout=timeout) as response:
                response_data = response.read().decode("utf-8")
                if response_data:
                    return json.loads(response_data)
                return {}
                
        except urllib.error.HTTPError as e:
            logger.error("Momo API error: %s %s - %s", method, endpoint, e.code)
            try:
                error_body = e.read().decode("utf-8")
                logger.error("Error response: %s", error_body)
            except Exception:
                pass
            return None
        except Exception as e:
            logger.error("Momo request failed: %s %s - %s", method, endpoint, e)
            return None
    
    def get_prefetch_context(self, message: str) -> str:
        """Get context to inject before the agent turn (auto-recall)."""
        if not self.config.get("auto_recall", True):
            return ""
        
        self.turn_count += 1
        
        try:
            # Get user profile on first turn and every profile_frequency turns
            include_profile = (
                self.turn_count == 1 or
                self.turn_count % self.config.get("profile_frequency", _DEFAULT_PROFILE_FREQUENCY) == 0
            )
            
            profile_data = ""
            if include_profile:
                profile = self._fetch_profile()
                if profile:
                    profile_data = self._format_profile(profile)
            
            # Search for relevant memories
            search_results = self._search_memories(message)
            
            if not profile_data and not search_results:
                return ""
            
            context_parts = []
            if profile_data:
                context_parts.append(profile_data)
            if search_results:
                context_parts.append(search_results)
            
            context_body = '\n\n'.join(context_parts)
            return f"<momo-context>\n{context_body}\n</momo-context>\n\n"
            
        except Exception as e:
            logger.error("Failed to fetch Momo context: %s", e)
            return ""

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        """Recall relevant context for the upcoming turn (implements MemoryProvider interface)."""
        context_parts = []
        
        # Get memories if auto-recall is enabled
        if self.config.get("auto_recall", True):
            memory_context = self.get_prefetch_context(query)
            if memory_context:
                context_parts.append(memory_context)
        
        # Detect intent and inject tool hints
        intent_hint = self._detect_intent(query)
        if intent_hint:
            context_parts.append(f"<momo-hint>\n{intent_hint}\n</momo-hint>")
        
        return "\n\n".join(context_parts) if context_parts else ""

    def _fetch_profile(self) -> Optional[Dict]:
        """Fetch user profile from Momo."""
        data = {
            "containerTag": self.container_tag,
            "generateNarrative": True,
        }
        result = self._make_request("POST", "/api/v1/profile:compute", data)
        return result.get("data") if result else None
    
    def _format_profile(self, profile: Dict) -> str:
        """Format profile data for context injection."""
        lines = ["## Your Profile"]
        
        # Add narrative if available
        narrative = profile.get("narrative", "")
        if narrative:
            lines.append(f"\n{narrative}")
        
        # Add static facts
        facts = profile.get("staticFacts", [])
        if facts:
            lines.append("\n**Key Facts:**")
            for fact in facts[:10]:  # Limit to 10 facts
                content = fact.get("content", "") if isinstance(fact, dict) else str(fact)
                if content:
                    lines.append(f"- {content}")
        
        # Add dynamic facts
        dynamic = profile.get("dynamicFacts", [])
        if dynamic:
            lines.append("\n**Recent Activity:**")
            for fact in dynamic[:5]:  # Limit to 5 recent
                content = fact.get("content", "") if isinstance(fact, dict) else str(fact)
                if content:
                    lines.append(f"- {content}")
        
        return "\n".join(lines)
    
    def _search_memories(self, query: str) -> str:
        """Search memories and format results."""
        data = {
            "q": query,
            "containerTags": [self.container_tag],
            "scope": "memories",
            "limit": self.config.get("max_recall_results", _DEFAULT_MAX_RECALL_RESULTS),
        }
        
        result = self._make_request("POST", "/api/v1/search", data)
        if not result:
            return ""
        
        # Extract results from response envelope
        results_data = result.get("data", {}) if isinstance(result, dict) else {}
        results = results_data.get("results", []) if isinstance(results_data, dict) else []
        
        if not results:
            return ""
        
        lines = ["## Relevant Memories"]
        for item in results:
            if isinstance(item, dict):
                content = item.get("content", "")
                result_type = item.get("type", "memory")
                
                if content:
                    lines.append(f"- [{result_type}] {content}")
        
        return "\n".join(lines) if len(lines) > 1 else ""
    
    def _detect_intent(self, message: str) -> Optional[str]:
        """Detect user intent and return tool hint to inject."""
        msg_lower = message.lower().strip()
        
        # Store intentions - very broad matching
        # Single keywords or short phrases that suggest saving
        store_keywords = [
            r"\bremember\b",           # just "remember" anywhere
            r"\bdon't forget\b",
            r"\bkeep in mind\b",
            r"\bnote (that|this)\b",
            r"\bimportant\b",
            r"\bremind me\b",
            r"\bsave (this|that|it)\b",
            r"\bstore (this|that|it)\b",
            r"\bwrite (this|that) down\b",
            r"\bmake a note\b",
            r"\bfor future reference\b",
        ]
        for pattern in store_keywords:
            if re.search(pattern, msg_lower):
                return "💡 The user might want you to remember something. Consider using `momo_store` to save a memory."
        
        # Search intentions - single words or phrases suggesting recall
        search_keywords = [
            r"\bdid (i|we) (ever |already )?(say|tell|mention|discuss|talk about)",
            r"\bwhat (did|was|do) (i|we)\b",
            r"\bremind me\b",
            r"\bdo you remember\b",
            r"\bhave (i|we) (ever )?(mentioned|told|said|talked about)",
            r"\bwhat do you know\b",
            r"\btell me about\b",
            r"\blook up\b",
            r"\bfind (that|the|my|our|previous|earlier)\b",
            r"\bsearch (for|my|our)\b",
            r"\b(recall|recollect|retrieve)\b",  # explicit recall words
            r"\b(what|when|where|how) (was|did) (that|it)\b",
            r"\bthe other day\b",
            r"\bwe (talked|discussed) about\b",
        ]
        for pattern in search_keywords:
            if re.search(pattern, msg_lower):
                return "💡 The user might be asking about past information. Consider using `momo_search` to find relevant memories."
        
        # Profile intentions - single words or phrases suggesting profile view
        profile_keywords = [
            r"\bwhat do you know about me\b",
            r"\bshow me my profile\b",
            r"\b(show|view|get) (my |the )?profile\b",
            r"\bwhat have you learned( about me)?\b",
            r"\bsummarize what you know\b",
            r"\bwhat('s| is) my (user )?profile\b",
            r"\btell me what you know about me\b",
            r"\bmy (user )?profile\b",
            r"\bwhat (info|information) do you have\b",
        ]
        for pattern in profile_keywords:
            if re.search(pattern, msg_lower):
                return "💡 The user might want to see their profile. Consider using `momo_profile` to show what you know."
        
        return None

    def write_turn(self, user_message: str, assistant_message: str) -> None:
        """No-op: We use explicit storage only."""
        pass
    
    def flush(self) -> None:
        """Flush any pending writes. Momo API is synchronous, so no-op."""
        pass

    def get_tools(self) -> List[Dict]:
        """Return tool schemas for Momo tools (legacy compat)."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "momo_search",
                    "description": "Search your Momo memory for relevant information",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query for memories",
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum number of results (1-20)",
                                "minimum": 1,
                                "maximum": 20,
                                "default": 10,
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "momo_store",
                    "description": "Store a new memory in Momo",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "content": {
                                "type": "string",
                                "description": "The memory content to store",
                            },
                            "type": {
                                "type": "string",
                                "description": "Type of memory (fact, preference, episode)",
                                "enum": ["fact", "preference", "episode"],
                                "default": "fact",
                            },
                        },
                        "required": ["content"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "momo_forget",
                    "description": "Delete a memory from Momo by ID",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "memory_id": {
                                "type": "string",
                                "description": "The ID of the memory to delete",
                            },
                        },
                        "required": ["memory_id"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "momo_profile",
                    "description": "View your Momo memory profile",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
        ]
    
    def handle_tool_call(self, name: str, arguments: Dict) -> str:
        """Handle Momo tool calls."""
        try:
            if name == "momo_search":
                return self._tool_search(arguments)
            elif name == "momo_store":
                return self._tool_store(arguments)
            elif name == "momo_forget":
                return self._tool_forget(arguments)
            elif name == "momo_profile":
                return self._tool_profile()
            else:
                return tool_error(f"Unknown tool: {name}")
        except Exception as e:
            logger.error("Momo tool error: %s - %s", name, e)
            return tool_error(f"Tool failed: {e}")
    
    def _tool_search(self, arguments: Dict) -> str:
        """Handle momo_search tool."""
        query = arguments.get("query", "").strip()
        if not query:
            return tool_error("Query is required")
        
        limit = max(1, min(20, int(arguments.get("limit", 10))))
        
        data = {
            "q": query,
            "containerTags": [self.container_tag],
            "scope": "memories",
            "limit": limit,
        }
        
        result = self._make_request("POST", "/api/v1/search", data)
        
        if result is None:
            return "Failed to search memories. Check if Momo server is running."
        
        # Extract results from response envelope
        results_data = result.get("data", {}) if isinstance(result, dict) else {}
        results = results_data.get("results", []) if isinstance(results_data, dict) else []
        
        if not results:
            return f"No memories found for: {query}"
        
        lines = [f"Found {len(results)} result(s) for '{query}':\n"]
        for item in results:
            if isinstance(item, dict):
                content = item.get("content", "")
                result_type = item.get("type", "memory")
                memory_id = item.get("memoryId", item.get("documentId", "unknown"))
                
                if content:
                    lines.append(f"[{result_type}] {content}")
                    lines.append(f"  ID: {memory_id}\n")
        
        return "\n".join(lines)
    
    def _tool_store(self, arguments: Dict) -> str:
        """Handle momo_store tool."""
        content = arguments.get("content", "").strip()
        if not content:
            return tool_error("Content is required")
        
        memory_type = arguments.get("type", "fact")
        if memory_type not in ("fact", "preference", "episode"):
            memory_type = "fact"
        
        data = {
            "content": content,
            "containerTag": self.container_tag,
            "memoryType": memory_type,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "hermes_agent_tool",
            },
        }
        
        result = self._make_request("POST", "/api/v1/memories", data)
        
        if result is None:
            return "Failed to store memory. Check if Momo server is running."
        
        # Extract from response envelope
        result_data = result.get("data", {}) if isinstance(result, dict) else {}
        memory_id = result_data.get("memoryId", "unknown") if isinstance(result_data, dict) else "unknown"
        return f"Memory stored successfully. ID: {memory_id}"
    
    def _tool_forget(self, arguments: Dict) -> str:
        """Handle momo_forget tool."""
        memory_id = arguments.get("memory_id", "").strip()
        if not memory_id:
            return tool_error("Memory ID is required")
        
        endpoint = f"/api/v1/memories/{memory_id}"
        result = self._make_request("DELETE", endpoint)
        
        if result is None:
            return f"Failed to delete memory {memory_id}. It may not exist."
        
        return f"Memory {memory_id} deleted successfully."
    
    def _tool_profile(self) -> str:
        """Handle momo_profile tool."""
        profile = self._fetch_profile()
        
        if profile is None:
            return "Failed to fetch profile. Check if Momo server is running."
        
        lines = ["# Your Momo Profile\n"]
        
        # Narrative summary
        narrative = profile.get("narrative", "")
        if narrative:
            lines.append(f"*{narrative}*\n")
        
        # Static facts
        facts = profile.get("staticFacts", [])
        if facts:
            lines.append("## Key Facts")
            for fact in facts:
                content = fact.get("content", "") if isinstance(fact, dict) else str(fact)
                if content:
                    lines.append(f"- {content}")
            lines.append("")
        
        # Dynamic facts
        dynamic = profile.get("dynamicFacts", [])
        if dynamic:
            lines.append("## Recent Activity")
            for fact in dynamic:
                content = fact.get("content", "") if isinstance(fact, dict) else str(fact)
                if content:
                    lines.append(f"- {content}")
            lines.append("")
        
        # Container info
        total = profile.get("totalMemories", 0)
        lines.append(f"**Container:** {self.container_tag}")
        lines.append(f"**Total Memories:** {total}")
        lines.append(f"**Server:** {self.config.get('base_url')}")
        
        return "\n".join(lines)


