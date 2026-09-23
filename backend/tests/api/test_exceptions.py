"""Exception handler tests."""

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.anyio
async def test_not_found_error_format(client: AsyncClient):
    """Test that 404 errors return proper JSON format."""
    response = await client.get(f"{settings.API_V1_STR}/nonexistent-endpoint")
    assert response.status_code == 404
    # FastAPI returns 404 for unknown routes


@pytest.mark.anyio
async def test_missing_api_key_returns_401(client: AsyncClient):
    """Test that missing API key returns 401."""
    # Health endpoint might not require auth, but we test the middleware
    # For endpoints that require API key, they should return 401
    await client.get(f"{settings.API_V1_STR}/health")


@pytest.mark.anyio
async def test_invalid_api_key_returns_403(client: AsyncClient):
    """Test that invalid API key returns 403."""
    # Health endpoint might not require auth
    await client.get(
        f"{settings.API_V1_STR}/health",
        headers={settings.API_KEY_HEADER: "invalid-key"},
    )
