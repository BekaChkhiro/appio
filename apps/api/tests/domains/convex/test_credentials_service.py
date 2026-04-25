"""Unit tests for the Convex deploy-key credentials service (T3.8 Phase 2).

All DB calls use AsyncMock — no real DB connection required.
Pattern: _make_db_with_sequence mirrors test_oauth_service.py.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from cryptography.fernet import Fernet  # noqa: TCH002

# ── helpers ───────────────────────────────────────────────────────────────────


def _fernet_key() -> str:
    return Fernet.generate_key().decode("utf-8")


def _make_app(app_id: uuid.UUID, user_id: uuid.UUID) -> MagicMock:
    app = MagicMock()
    app.id = app_id
    app.user_id = user_id
    app.slug = "my-app"
    return app


def _make_db_with_sequence(returns: list) -> AsyncMock:
    """DB whose execute() returns values from `returns` in order."""
    db = AsyncMock()
    results = []
    for val in returns:
        r = MagicMock()
        r.scalar_one_or_none.return_value = val
        r.scalar_one.return_value = val
        results.append(r)
    db.execute = AsyncMock(side_effect=results)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.delete = AsyncMock()
    return db


def _make_credentials_row(
    app_id: uuid.UUID,
    user_id: uuid.UUID,
    deploy_key_encrypted: str = "encrypted-key",
    deployment_url: str = "https://happy-animal-123.convex.cloud",
    team_slug: str = "my-team",
    last_used_at: datetime | None = None,
) -> MagicMock:
    row = MagicMock()
    row.app_id = app_id
    row.created_by_user_id = user_id
    row.deploy_key_encrypted = deploy_key_encrypted
    row.deployment_url = deployment_url
    row.team_slug = team_slug
    row.last_used_at = last_used_at
    return row


_VALID_KEY = "prod:my-team|supersecretvalue123"
_VALID_URL = "https://happy-animal-123.convex.cloud"


# ── store_credentials ─────────────────────────────────────────────────────────


class TestStoreCredentials:
    @pytest.mark.asyncio
    async def test_happy_path_new_row(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)

        # sequence: app lookup → no existing credentials row
        db = _make_db_with_sequence([app, None])

        key = _fernet_key()
        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key

            from apps.api.domains.convex.credentials_service import store_credentials

            row = await store_credentials(
                db,
                app_id=app_id,
                user_id=user_id,
                deploy_key=_VALID_KEY,
                deployment_url=_VALID_URL,
            )

        db.add.assert_called_once()
        db.flush.assert_awaited_once()
        assert row is not None

    @pytest.mark.asyncio
    async def test_upsert_on_repaste(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        existing = _make_credentials_row(app_id, user_id)

        # sequence: app lookup → existing credentials row
        db = _make_db_with_sequence([app, existing])

        key = _fernet_key()
        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key

            from apps.api.domains.convex.credentials_service import store_credentials

            row = await store_credentials(
                db,
                app_id=app_id,
                user_id=user_id,
                deploy_key=_VALID_KEY,
                deployment_url=_VALID_URL,
            )

        # Update path: add should NOT be called, flush should be
        db.add.assert_not_called()
        db.flush.assert_awaited_once()
        assert row is existing
        assert existing.deployment_url == _VALID_URL
        assert existing.team_slug == "my-team"

    @pytest.mark.asyncio
    async def test_rejects_non_owner_with_not_found(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()

        # App lookup returns None (not owned by user)
        db = _make_db_with_sequence([None])

        from apps.api.core.exceptions import NotFoundError
        from apps.api.domains.convex.credentials_service import store_credentials

        with pytest.raises(NotFoundError):
            await store_credentials(
                db,
                app_id=app_id,
                user_id=user_id,
                deploy_key=_VALID_KEY,
                deployment_url=_VALID_URL,
            )

    @pytest.mark.asyncio
    async def test_rejects_malformed_deploy_key(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        db = _make_db_with_sequence([app])

        from apps.api.core.exceptions import AppError
        from apps.api.domains.convex.credentials_service import store_credentials

        with pytest.raises(AppError) as exc_info:
            await store_credentials(
                db,
                app_id=app_id,
                user_id=user_id,
                deploy_key="not-a-valid-key",
                deployment_url=_VALID_URL,
            )

        assert exc_info.value.error_code == "INVALID_CREDENTIALS"
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_malformed_url(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        db = _make_db_with_sequence([app])

        from apps.api.core.exceptions import AppError
        from apps.api.domains.convex.credentials_service import store_credentials

        with pytest.raises(AppError) as exc_info:
            await store_credentials(
                db,
                app_id=app_id,
                user_id=user_id,
                deploy_key=_VALID_KEY,
                deployment_url="https://example.com/not-convex",
            )

        assert exc_info.value.error_code == "INVALID_CREDENTIALS"
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_dev_prefix_key(self) -> None:
        """deploy key must start with prod:, not dev:."""
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        db = _make_db_with_sequence([app])

        from apps.api.core.exceptions import AppError
        from apps.api.domains.convex.credentials_service import store_credentials

        with pytest.raises(AppError) as exc_info:
            await store_credentials(
                db,
                app_id=app_id,
                user_id=user_id,
                deploy_key="dev:my-team|secret",
                deployment_url=_VALID_URL,
            )

        assert exc_info.value.error_code == "INVALID_CREDENTIALS"

    @pytest.mark.asyncio
    async def test_accepts_convex_site_url(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        db = _make_db_with_sequence([app, None])

        key = _fernet_key()
        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key

            from apps.api.domains.convex.credentials_service import store_credentials

            row = await store_credentials(
                db,
                app_id=app_id,
                user_id=user_id,
                deploy_key=_VALID_KEY,
                deployment_url="https://happy-animal.convex.site",
            )

        assert row is not None

    def test_parses_team_slug_from_key(self) -> None:
        from apps.api.domains.convex.credentials_service import _validate_deploy_key

        slug = _validate_deploy_key("prod:acme-corp|thesecret")
        assert slug == "acme-corp"


# ── get_credentials_status ────────────────────────────────────────────────────


class TestGetCredentialsStatus:
    @pytest.mark.asyncio
    async def test_returns_false_when_no_row(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)

        db = _make_db_with_sequence([app, None])

        from apps.api.domains.convex.credentials_service import get_credentials_status

        status = await get_credentials_status(db, app_id=app_id, user_id=user_id)

        assert status.has_credentials is False
        assert status.deployment_url is None
        assert status.team_slug is None

    @pytest.mark.asyncio
    async def test_returns_true_with_url_when_set(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        row = _make_credentials_row(app_id, user_id)

        db = _make_db_with_sequence([app, row])

        from apps.api.domains.convex.credentials_service import get_credentials_status

        status = await get_credentials_status(db, app_id=app_id, user_id=user_id)

        assert status.has_credentials is True
        assert status.deployment_url == row.deployment_url
        assert status.team_slug == row.team_slug

    @pytest.mark.asyncio
    async def test_rejects_non_owner(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()

        db = _make_db_with_sequence([None])  # app lookup returns None

        from apps.api.core.exceptions import NotFoundError
        from apps.api.domains.convex.credentials_service import get_credentials_status

        with pytest.raises(NotFoundError):
            await get_credentials_status(db, app_id=app_id, user_id=user_id)

    @pytest.mark.asyncio
    async def test_includes_last_used_at(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        ts = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
        row = _make_credentials_row(app_id, user_id, last_used_at=ts)

        db = _make_db_with_sequence([app, row])

        from apps.api.domains.convex.credentials_service import get_credentials_status

        status = await get_credentials_status(db, app_id=app_id, user_id=user_id)

        assert status.last_used_at == ts


# ── delete_credentials ────────────────────────────────────────────────────────


class TestDeleteCredentials:
    @pytest.mark.asyncio
    async def test_removes_row(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)
        row = _make_credentials_row(app_id, user_id)

        db = _make_db_with_sequence([app, row])

        from apps.api.domains.convex.credentials_service import delete_credentials

        await delete_credentials(db, app_id=app_id, user_id=user_id)

        db.delete.assert_awaited_once_with(row)
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_idempotent_when_no_row(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id, user_id)

        db = _make_db_with_sequence([app, None])

        from apps.api.domains.convex.credentials_service import delete_credentials

        # Should not raise
        await delete_credentials(db, app_id=app_id, user_id=user_id)

        db.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_rejects_non_owner(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()

        db = _make_db_with_sequence([None])

        from apps.api.core.exceptions import NotFoundError
        from apps.api.domains.convex.credentials_service import delete_credentials

        with pytest.raises(NotFoundError):
            await delete_credentials(db, app_id=app_id, user_id=user_id)


# ── load_credentials_for_publish ─────────────────────────────────────────────


class TestLoadCredentialsForPublish:
    @pytest.mark.asyncio
    async def test_decrypts_correctly(self) -> None:
        app_id = uuid.uuid4()
        user_id = uuid.uuid4()

        key = _fernet_key()
        fernet = Fernet(key.encode())
        encrypted = fernet.encrypt(_VALID_KEY.encode()).decode()

        row = _make_credentials_row(
            app_id,
            user_id,
            deploy_key_encrypted=encrypted,
            deployment_url=_VALID_URL,
        )
        db = _make_db_with_sequence([row])

        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key

            from apps.api.domains.convex.credentials_service import load_credentials_for_publish

            deploy_key, deployment_url = await load_credentials_for_publish(
                db, app_id=app_id
            )

        assert deploy_key == _VALID_KEY
        assert deployment_url == _VALID_URL

    @pytest.mark.asyncio
    async def test_raises_app_error_404_when_no_row(self) -> None:
        app_id = uuid.uuid4()
        db = _make_db_with_sequence([None])

        from apps.api.core.exceptions import AppError
        from apps.api.domains.convex.credentials_service import load_credentials_for_publish

        with pytest.raises(AppError) as exc_info:
            await load_credentials_for_publish(db, app_id=app_id)

        assert exc_info.value.status_code == 404
        assert exc_info.value.error_code == "CREDENTIALS_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_bumps_last_used_at(self) -> None:
        app_id = uuid.uuid4()
        user_id = uuid.uuid4()

        key = _fernet_key()
        fernet = Fernet(key.encode())
        encrypted = fernet.encrypt(_VALID_KEY.encode()).decode()

        row = _make_credentials_row(
            app_id,
            user_id,
            deploy_key_encrypted=encrypted,
            last_used_at=None,
        )
        db = _make_db_with_sequence([row])

        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key

            from apps.api.domains.convex.credentials_service import load_credentials_for_publish

            await load_credentials_for_publish(db, app_id=app_id)

        # last_used_at should be set to a recent datetime
        assert row.last_used_at is not None
        assert isinstance(row.last_used_at, datetime)

    @pytest.mark.asyncio
    async def test_encryption_round_trip(self) -> None:
        """store then load returns the same plaintext key."""
        app_id = uuid.uuid4()
        user_id = uuid.uuid4()
        app = _make_app(app_id, user_id)

        key = _fernet_key()

        stored_row_container: list = []

        class _CapturingDB:
            """DB mock that captures the added row so we can feed it back."""

            def __init__(self) -> None:
                self._call_count = 0
                self.flush = AsyncMock()
                self.delete = AsyncMock()

            def add(self, row: object) -> None:
                stored_row_container.append(row)

            async def execute(self, _stmt: object) -> MagicMock:
                self._call_count += 1
                r = MagicMock()
                if self._call_count == 1:
                    # app lookup in store_credentials
                    r.scalar_one_or_none.return_value = app
                elif self._call_count == 2:
                    # existing credentials lookup in store_credentials
                    r.scalar_one_or_none.return_value = None
                elif self._call_count == 3:
                    # lookup in load_credentials_for_publish
                    r.scalar_one_or_none.return_value = stored_row_container[0] if stored_row_container else None
                return r

        db = _CapturingDB()

        with patch("apps.api.domains.convex.crypto.settings") as mock_settings:
            mock_settings.convex_token_encryption_key = key

            from apps.api.domains.convex.credentials_service import (
                load_credentials_for_publish,
                store_credentials,
            )

            await store_credentials(
                db,  # type: ignore[arg-type]
                app_id=app_id,
                user_id=user_id,
                deploy_key=_VALID_KEY,
                deployment_url=_VALID_URL,
            )

            assert len(stored_row_container) == 1
            recovered_key, recovered_url = await load_credentials_for_publish(
                db,  # type: ignore[arg-type]
                app_id=app_id,
            )

        assert recovered_key == _VALID_KEY
        assert recovered_url == _VALID_URL
