"""Authentication routes.

Delegated auth mode: identity is owned by the external IdP, so this module
exposes **only** ``/me``. Local email/password endpoints (login, register,
refresh, logout, password reset, magic link) are deliberately absent — see
``get_current_user`` in ``app/api/deps.py``, which validates IdP signatures and
would reject any token this backend minted. Leaving them mounted would also
mean an unauthenticated caller could create a local account, and the first such
account is auto-promoted to app-admin.
"""

import logging
from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.user import UserRead

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def get_current_user_info(current_user: CurrentUser) -> Any:
    """Get current authenticated user information."""
    return current_user
