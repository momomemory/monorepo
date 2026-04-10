"""Shared transport utilities used by both sync and async clients.

The sync transport wraps ``httpx.Client``; the async transport wraps
``httpx.AsyncClient``.  URL building, auth resolution, envelope
unwrapping, and error normalisation are centralised here so the two
surfaces stay in lockstep.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypeVar

import httpx

from ._errors import _STATUS_TO_CODE, ErrorCode, MomoError

if TYPE_CHECKING:
    from ._types import MomoClientConfig, RequestOptions

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Helpers shared by both sync + async
# ---------------------------------------------------------------------------


def _build_url(base_url: str, path: str) -> str:
    return base_url.rstrip("/") + "/" + path.lstrip("/")


def _merge_headers(
    config: MomoClientConfig,
    auth_value: str | None,
    per_request: dict[str, str] | None,
) -> dict[str, str]:
    headers: dict[str, str] = {
        "Accept": "application/json",
        **config.extra_headers,
    }
    if auth_value:
        headers["Authorization"] = f"Bearer {auth_value}"
    if per_request:
        headers.update(per_request)
    return headers


def _resolve_timeout(
    config: MomoClientConfig,
    per_request: float | httpx.Timeout | None,
) -> float | httpx.Timeout | None:
    if per_request is not None:
        return per_request
    return config.timeout


def _parse_envelope(
    response: httpx.Response,
    method: str,
    path: str,
    *,
    include_meta: bool = False,
) -> Any:
    """Unwrap the ``{ "data": ... }`` envelope, raising MomoError on failure."""
    if response.status_code == 204:
        return None

    try:
        body = response.json()
    except Exception as exc:
        if not response.is_success:
            raise MomoError.from_status(
                response.status_code,
                message=response.text or f"Request failed with status {response.status_code}",
                path=path,
                method=method,
            ) from exc
        return None

    if not response.is_success:
        error_payload = body.get("error") if isinstance(body, dict) else None
        if isinstance(error_payload, dict):
            raw_code = error_payload.get("code", "")
            code: ErrorCode = (
                raw_code
                if raw_code
                in (
                    "invalid_request",
                    "unauthorized",
                    "not_found",
                    "conflict",
                    "internal_error",
                    "not_implemented",
                )
                else _STATUS_TO_CODE.get(response.status_code, "internal_error")
            )
            raise MomoError(
                status=response.status_code,
                code=code,
                message=error_payload.get(
                    "message", f"Request failed with status {response.status_code}"
                ),
                path=path,
                method=method,
            )
        raise MomoError.from_status(
            response.status_code,
            message=str(body) if body else None,
            path=path,
            method=method,
        )

    if isinstance(body, dict) and "data" in body:
        if include_meta:
            return {
                "data": body["data"],
                "meta": body.get("meta"),
            }
        return body["data"]
    return body


def _parse_model(raw: Any, model_cls: type[T]) -> T:
    """Parse a raw dict into a Pydantic model instance."""
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(raw)  # type: ignore[return-value]
    return model_cls(**raw)  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Sync transport
# ---------------------------------------------------------------------------


class SyncTransport:
    """Thin wrapper around ``httpx.Client`` that handles auth, envelope
    unwrapping, and error normalisation."""

    _client: httpx.Client
    _config: MomoClientConfig
    _owned: bool  # whether we created the client (and should close it)

    def __init__(self, config: MomoClientConfig) -> None:
        self._config = config
        if config.http_client is not None:
            self._client = config.http_client
            self._owned = False
        else:
            self._client = httpx.Client(timeout=config.timeout)
            self._owned = True

    # -- raw httpx client access ------------------------------------------

    @property
    def raw(self) -> httpx.Client:
        return self._client

    # -- auth resolution --------------------------------------------------

    def _get_auth(self) -> str | None:
        if self._config.api_key:
            return self._config.api_key
        if self._config.get_api_key is not None:
            result = self._config.get_api_key()
            # If the callable returned a coroutine, the user passed an async
            # callable to a sync client — fail loudly.
            import inspect

            if inspect.isawaitable(result):
                raise TypeError(
                    "get_api_key returned a coroutine but MomoClient is synchronous. "
                    "Use AsyncMomoClient instead."
                )
            return result  # type: ignore[return-value]
        return None

    # -- request ----------------------------------------------------------

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        content: bytes | None = None,
        data: dict[str, Any] | None = None,
        files: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
        include_meta: bool = False,
    ) -> Any:
        url = _build_url(self._config.base_url, path)
        auth = self._get_auth()
        headers = _merge_headers(self._config, auth, options.headers if options else None)
        timeout = _resolve_timeout(self._config, options.timeout if options else None)

        response = self._client.request(
            method=method,
            url=url,
            params=params,
            json=json,
            content=content,
            data=data,
            files=files,
            headers=headers,
            timeout=timeout,
        )
        return _parse_envelope(response, method, path, include_meta=include_meta)

    # -- lifecycle --------------------------------------------------------

    def close(self) -> None:
        if self._owned:
            self._client.close()

    def __enter__(self) -> SyncTransport:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


# ---------------------------------------------------------------------------
# Async transport
# ---------------------------------------------------------------------------


class AsyncTransport:
    """Thin wrapper around ``httpx.AsyncClient`` matching the sync API."""

    _client: httpx.AsyncClient
    _config: MomoClientConfig
    _owned: bool

    def __init__(self, config: MomoClientConfig) -> None:
        self._config = config
        if config.async_http_client is not None:
            self._client = config.async_http_client
            self._owned = False
        else:
            self._client = httpx.AsyncClient(timeout=config.timeout)
            self._owned = True

    @property
    def raw(self) -> httpx.AsyncClient:
        return self._client

    async def _get_auth(self) -> str | None:
        if self._config.api_key:
            return self._config.api_key
        if self._config.get_api_key is not None:
            import inspect

            result = self._config.get_api_key()
            if inspect.isawaitable(result):
                return await result
            return result  # type: ignore[return-value]
        return None

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        content: bytes | None = None,
        data: dict[str, Any] | None = None,
        files: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
        include_meta: bool = False,
    ) -> Any:
        url = _build_url(self._config.base_url, path)
        auth = await self._get_auth()
        headers = _merge_headers(self._config, auth, options.headers if options else None)
        timeout = _resolve_timeout(self._config, options.timeout if options else None)

        response = await self._client.request(
            method=method,
            url=url,
            params=params,
            json=json,
            content=content,
            data=data,
            files=files,
            headers=headers,
            timeout=timeout,
        )
        return _parse_envelope(response, method, path, include_meta=include_meta)

    async def close(self) -> None:
        if self._owned:
            await self._client.aclose()

    async def __aenter__(self) -> AsyncTransport:
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()
