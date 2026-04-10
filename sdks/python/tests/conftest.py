"""Shared fixtures for the momo-sdk test suite."""

from __future__ import annotations

import pytest

from momo_sdk import AsyncMomoClient, MomoClient

BASE_URL = "http://test.momo.local"
API_KEY = "test-key-abc"


def _wrap(data: object) -> dict:
    return {"data": data}


# ---------------------------------------------------------------------------
# Sync client fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> MomoClient:
    return MomoClient(base_url=BASE_URL, api_key=API_KEY)


@pytest.fixture
def client_with_dct() -> MomoClient:
    return MomoClient(
        base_url=BASE_URL,
        api_key=API_KEY,
        default_container_tag="user-123",
    )


# ---------------------------------------------------------------------------
# Async client fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def async_client() -> AsyncMomoClient:
    return AsyncMomoClient(base_url=BASE_URL, api_key=API_KEY)


@pytest.fixture
def async_client_with_dct() -> AsyncMomoClient:
    return AsyncMomoClient(
        base_url=BASE_URL,
        api_key=API_KEY,
        default_container_tag="user-123",
    )
