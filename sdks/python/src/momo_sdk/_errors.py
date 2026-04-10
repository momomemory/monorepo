from __future__ import annotations

from typing import Literal

ErrorCode = Literal[
    "invalid_request",
    "unauthorized",
    "not_found",
    "conflict",
    "internal_error",
    "not_implemented",
]

_STATUS_TO_CODE: dict[int, ErrorCode] = {
    400: "invalid_request",
    401: "unauthorized",
    403: "unauthorized",
    404: "not_found",
    409: "conflict",
    501: "not_implemented",
}


class MomoError(Exception):
    """Raised when the Momo API returns an error response."""

    status: int
    code: ErrorCode
    path: str | None
    method: str | None

    def __init__(
        self,
        *,
        status: int,
        code: ErrorCode | None = None,
        message: str,
        path: str | None = None,
        method: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code or _STATUS_TO_CODE.get(status, "internal_error")
        self.path = path
        self.method = method

    @classmethod
    def from_status(
        cls,
        status: int,
        *,
        message: str | None = None,
        path: str | None = None,
        method: str | None = None,
    ) -> MomoError:
        code: ErrorCode = _STATUS_TO_CODE.get(status, "internal_error")
        return cls(
            status=status,
            code=code,
            message=message or f"Request failed with status {status}",
            path=path,
            method=method,
        )

    def __repr__(self) -> str:
        return (
            f"MomoError(status={self.status!r}, code={self.code!r}, "
            f"message={str(self)!r}, path={self.path!r})"
        )
