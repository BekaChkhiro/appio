"""Encrypted-at-rest helpers for Convex OAuth tokens (T3.6).

The encryption key lives in settings.convex_token_encryption_key and MUST be
set when convex_oauth_client_id is set (validated at startup via FastAPI
lifespan). Rotate by generating a new Fernet key and re-encrypting existing
rows; this module does not ship rotation yet (tracked as T3.6-followup).
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from apps.api.config import settings
from apps.api.core.exceptions import AppError


class CryptoConfigError(AppError):
    def __init__(self, detail: str = "Convex token encryption is not configured") -> None:
        super().__init__(detail=detail, status_code=503, error_code="CONVEX_CRYPTO_NOT_CONFIGURED")


def _fernet() -> Fernet:
    key = settings.convex_token_encryption_key
    if not key:
        raise CryptoConfigError()
    try:
        return Fernet(key.encode("utf-8") if isinstance(key, str) else key)
    except (ValueError, TypeError) as e:
        raise CryptoConfigError(f"Invalid CONVEX_TOKEN_ENCRYPTION_KEY: {e}") from e


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise CryptoConfigError("Failed to decrypt Convex token — key mismatch or corruption") from e
