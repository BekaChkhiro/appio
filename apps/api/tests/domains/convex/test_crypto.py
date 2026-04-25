"""Unit tests for the Fernet-based token crypto helpers (T3.6)."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet


def _make_key() -> str:
    return Fernet.generate_key().decode("utf-8")


class TestEncryptDecryptRoundtrip:
    def test_roundtrip(self) -> None:
        key = _make_key()
        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key
            from apps.api.domains.convex.crypto import decrypt, encrypt

            plaintext = "my-secret-access-token"
            ciphertext = encrypt(plaintext)
            assert ciphertext != plaintext
            assert decrypt(ciphertext) == plaintext

    def test_different_plaintexts_produce_different_ciphertexts(self) -> None:
        key = _make_key()
        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key
            from apps.api.domains.convex.crypto import encrypt

            assert encrypt("token-a") != encrypt("token-b")

    def test_empty_key_raises_crypto_config_error(self) -> None:
        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = ""
            from apps.api.domains.convex.crypto import CryptoConfigError, encrypt

            with pytest.raises(CryptoConfigError):
                encrypt("anything")

    def test_invalid_key_raises_crypto_config_error(self) -> None:
        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = "not-a-valid-fernet-key"
            from apps.api.domains.convex.crypto import CryptoConfigError, encrypt

            with pytest.raises(CryptoConfigError):
                encrypt("anything")

    def test_wrong_key_on_decrypt_raises_crypto_config_error(self) -> None:
        key_a = _make_key()
        key_b = _make_key()

        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key_a
            from apps.api.domains.convex.crypto import encrypt
            ciphertext = encrypt("secret")

        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key_b
            from apps.api.domains.convex.crypto import CryptoConfigError, decrypt

            with pytest.raises(CryptoConfigError):
                decrypt(ciphertext)
