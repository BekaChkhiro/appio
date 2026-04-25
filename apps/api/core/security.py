"""Firebase JWT verification.

Uses sync `def` (not async) so FastAPI runs it in a threadpool,
since firebase-admin.verify_id_token() is blocking.
"""

import structlog
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin.exceptions import FirebaseError

from apps.api.core.exceptions import UnauthorizedError

logger = structlog.stdlib.get_logger()

_bearer_scheme = HTTPBearer(auto_error=False)


class FirebaseUser:
    """Decoded Firebase JWT claims relevant to the app."""

    __slots__ = ("uid", "email", "name", "picture", "email_verified")

    def __init__(
        self,
        uid: str,
        email: str,
        name: str | None = None,
        picture: str | None = None,
        email_verified: bool = False,
    ) -> None:
        self.uid = uid
        self.email = email
        self.name = name
        self.picture = picture
        self.email_verified = email_verified


def verify_firebase_token(token: str) -> FirebaseUser:
    """Verify a Firebase ID token and return decoded claims.

    This is intentionally a sync function — firebase-admin uses blocking HTTP
    calls, and FastAPI will run sync dependencies in a threadpool automatically.
    """
    try:
        # check_revoked=False (default) — only validates JWT signature locally.
        # check_revoked=True adds a network round-trip to Firebase (3-5s) and should
        # only be used for sensitive operations (password change, payment).
        # Tokens expire after 1 hour anyway.
        decoded = firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise UnauthorizedError(detail="Token has expired")
    except (firebase_auth.InvalidIdTokenError, FirebaseError, ValueError) as exc:
        logger.warning("firebase_token_invalid", error=str(exc))
        raise UnauthorizedError(detail="Invalid authentication token")

    email = decoded.get("email")
    if not email:
        raise UnauthorizedError(detail="Token missing email claim")

    return FirebaseUser(
        uid=decoded["uid"],
        email=email,
        name=decoded.get("name"),
        picture=decoded.get("picture"),
        email_verified=decoded.get("email_verified", False),
    )


def get_firebase_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> FirebaseUser:
    """FastAPI dependency: extract and verify Firebase JWT from Authorization header.

    Sync def so FastAPI runs it in a threadpool (firebase-admin is blocking).
    """
    if credentials is None:
        raise UnauthorizedError(detail="Authentication required")
    return verify_firebase_token(credentials.credentials)
