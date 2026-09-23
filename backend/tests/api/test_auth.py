# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals
"""Tests for authentication routes."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

ServiceMock = AsyncMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_user_service
from app.core.config import settings
from app.main import app
from app.api.deps import get_redis
from app.api.deps import get_db_session


class MockUser:
    """Mock user for testing."""

    def __init__(
        self,
        id=None,
        email="test@example.com",
        full_name="Test User",
        is_active=True,
        role="user",
    ):
        self.id = id or uuid4()
        self.email = email
        self.full_name = full_name
        self.is_active = is_active
        self.role = role
        self.hashed_password = "hashed"
        self.avatar_url = None
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)


@pytest.fixture
def mock_user() -> MockUser:
    """Create a mock user."""
    return MockUser()


@pytest.fixture
def mock_user_service(mock_user: MockUser) -> MagicMock:
    """Create a mock user service."""
    service = MagicMock()
    service.authenticate = ServiceMock(return_value=mock_user)
    service.register = ServiceMock(return_value=mock_user)
    service.get_by_id = ServiceMock(return_value=mock_user)
    service.get_by_email = ServiceMock(return_value=mock_user)
    return service


@pytest.fixture
async def client_with_mock_service(
    mock_user_service: MagicMock,
    mock_redis: MagicMock,
    mock_db_session,
) -> AsyncClient:
    """Client with mocked user service."""
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_local_credential_endpoints_are_not_generated(client: AsyncClient):
    """Delegated auth must not expose local login/registration.

    Regression guard for the escalation this replaced: an unauthenticated caller
    could POST /auth/register, and UserService.register auto-promotes the first
    account to app-admin — which SQLAdmin then accepts on a local password.
    """
    for path in ("auth/login", "auth/register", "auth/refresh", "auth/logout"):
        response = await client.post(f"{settings.API_V1_STR}/{path}", json={})
        assert response.status_code == 404, f"{path} is still reachable"


@pytest.mark.anyio
async def test_get_current_user(
    client_with_mock_service: AsyncClient,
    mock_user: MockUser,
    mock_user_service: MagicMock,
):
    """Test getting current user info."""
    # Override get_current_user to return mock user
    app.dependency_overrides[get_current_user] = lambda: mock_user

    response = await client_with_mock_service.get(
        f"{settings.API_V1_STR}/auth/me",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == mock_user.email
