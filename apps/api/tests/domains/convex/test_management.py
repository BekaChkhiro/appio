"""Unit tests for the Convex Management API client (T3.9)."""

from __future__ import annotations

import json
import time
from unittest.mock import patch

import httpx
import pytest

from apps.api.domains.convex.management import (
    ConvexManagementError,
    FakeConvexManagementClient,
    HttpxConvexManagementClient,
    ScratchDeployment,
    _truncate_body,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json_response(data: dict[str, object], status_code: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        headers={"content-type": "application/json"},
        text=json.dumps(data),
    )


def _text_response(text: str, status_code: int = 200) -> httpx.Response:
    return httpx.Response(status_code=status_code, text=text)


class _SequentialTransport(httpx.AsyncBaseTransport):
    """Replay a fixed sequence of responses, recording sent requests."""

    def __init__(self, responses: list[httpx.Response]) -> None:
        self._responses = list(responses)
        self._idx = 0
        self.requests: list[httpx.Request] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        resp = self._responses[self._idx]
        self._idx += 1
        return resp


class _ErrorTransport(httpx.AsyncBaseTransport):
    """Always raises a given exception."""

    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        raise self._exc


def _make_client_with_transport(
    transport: httpx.AsyncBaseTransport,
) -> HttpxConvexManagementClient:
    client = HttpxConvexManagementClient(
        access_token="test-token",
        scratch_host_project_id="12345",
    )
    # Swap the internal transport for the mock
    client._http = httpx.AsyncClient(
        transport=transport,
        headers={"Authorization": "Bearer test-token"},
    )
    return client


# ---------------------------------------------------------------------------
# FakeConvexManagementClient (pre-existing tests, kept verbatim)
# ---------------------------------------------------------------------------

class TestFakeConvexManagementClient:
    @pytest.mark.asyncio
    async def test_provisions_unique_deployments(self) -> None:
        client = FakeConvexManagementClient()
        d1 = await client.provision_scratch_deployment(label="a")
        d2 = await client.provision_scratch_deployment(label="b")
        d3 = await client.provision_scratch_deployment(label="c")

        ids = {d1.deployment_id, d2.deployment_id, d3.deployment_id}
        urls = {d1.deployment_url, d2.deployment_url, d3.deployment_url}
        keys = {d1.deploy_key, d2.deploy_key, d3.deploy_key}

        assert len(ids) == 3
        assert len(urls) == 3
        assert len(keys) == 3
        assert client.live_deployments == [d1.deployment_id, d2.deployment_id, d3.deployment_id]

    @pytest.mark.asyncio
    async def test_teardown_removes_from_live_set(self) -> None:
        client = FakeConvexManagementClient()
        dep = await client.provision_scratch_deployment(label="test")
        assert dep.deployment_id in client.live_deployments

        await client.teardown_deployment(deployment_id=dep.deployment_id)
        assert dep.deployment_id not in client.live_deployments
        assert dep.deployment_id in client.teardown_calls

    @pytest.mark.asyncio
    async def test_fail_on_provision_raises(self) -> None:
        client = FakeConvexManagementClient(fail_on_provision=True)
        with pytest.raises(ConvexManagementError, match="fake: provision failed"):
            await client.provision_scratch_deployment(label="test")

        assert client.live_deployments == []

    @pytest.mark.asyncio
    async def test_fail_on_teardown_raises(self) -> None:
        client = FakeConvexManagementClient(fail_on_teardown=True)
        dep = await client.provision_scratch_deployment(label="test")

        with pytest.raises(ConvexManagementError, match="fake: teardown failed"):
            await client.teardown_deployment(deployment_id=dep.deployment_id)

        # Even on failure the call is recorded.
        assert dep.deployment_id in client.teardown_calls


# ---------------------------------------------------------------------------
# TestHttpxProvisionScratchDeployment
# ---------------------------------------------------------------------------

class TestHttpxProvisionScratchDeployment:
    @pytest.mark.asyncio
    async def test_happy_path_provisions_deployment_and_deploy_key(self) -> None:
        transport = _SequentialTransport([
            _json_response({
                "name": "scratch-abc",
                "deploymentUrl": "https://scratch-abc.convex.cloud",
                "id": "dep-1",
                "projectId": 12345,
                "createTime": "2024-01-01T00:00:00Z",
            }),
            _json_response({"deployKey": "prod:team|secret"}),
        ])
        client = _make_client_with_transport(transport)

        before = int(time.time() * 1000)
        result = await client.provision_scratch_deployment(label="test-label")
        after = int(time.time() * 1000)

        assert result == ScratchDeployment(
            deployment_id="scratch-abc",
            deployment_url="https://scratch-abc.convex.cloud",
            deploy_key="prod:team|secret",
        )

        # Assert create_deployment request body
        create_req = transport.requests[0]
        body = json.loads(create_req.content)
        assert body["type"] == "dev"
        assert body["reference"] == "test-label"
        # expiresAt should be roughly 1h from now (allow ±60s)
        expected_min = before + (3600 - 60) * 1000
        expected_max = after + (3600 + 60) * 1000
        assert expected_min <= body["expiresAt"] <= expected_max

    @pytest.mark.asyncio
    async def test_passes_bearer_token_header(self) -> None:
        transport = _SequentialTransport([
            _json_response({
                "name": "scratch-abc",
                "deploymentUrl": "https://scratch-abc.convex.cloud",
            }),
            _json_response({"deployKey": "prod:team|secret"}),
        ])
        client = _make_client_with_transport(transport)
        await client.provision_scratch_deployment(label="test-label")

        assert transport.requests[0].headers["Authorization"] == "Bearer test-token"

    @pytest.mark.asyncio
    async def test_create_deployment_failure_raises_convex_management_error(self) -> None:
        transport = _SequentialTransport([
            _json_response({"error": "invalid token"}, status_code=401),
        ])
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError) as exc_info:
            await client.provision_scratch_deployment(label="test-label")

        msg = str(exc_info.value)
        assert "401" in msg
        # Token must never appear in error messages
        assert "test-token" not in msg

    @pytest.mark.asyncio
    async def test_create_deployment_returns_invalid_url_raises(self) -> None:
        transport = _SequentialTransport([
            _json_response({
                "name": "scratch-abc",
                "deploymentUrl": "http://evil.example.com",
            }),
        ])
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError, match="unexpected deploymentUrl shape"):
            await client.provision_scratch_deployment(label="test-label")

    @pytest.mark.asyncio
    async def test_create_deployment_missing_fields_raises(self) -> None:
        transport = _SequentialTransport([
            _json_response({"deploymentUrl": "https://scratch-abc.convex.cloud"}),
        ])
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError, match="missing required fields"):
            await client.provision_scratch_deployment(label="test-label")

    @pytest.mark.asyncio
    async def test_deploy_key_failure_tears_down_orphan_deployment(self) -> None:
        transport = _SequentialTransport([
            _json_response({
                "name": "scratch-abc",
                "deploymentUrl": "https://scratch-abc.convex.cloud",
            }),
            _json_response({"error": "internal error"}, status_code=500),
            _text_response("", status_code=200),  # best-effort delete
        ])
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError) as exc_info:
            await client.provision_scratch_deployment(label="test-label")

        assert "500" in str(exc_info.value)
        # Three requests: create, key (fail), delete (cleanup)
        assert len(transport.requests) == 3
        delete_req = transport.requests[2]
        assert "/deployments/scratch-abc/delete" in str(delete_req.url)

    @pytest.mark.asyncio
    async def test_deploy_key_missing_in_response_tears_down_orphan(self) -> None:
        transport = _SequentialTransport([
            _json_response({
                "name": "scratch-abc",
                "deploymentUrl": "https://scratch-abc.convex.cloud",
            }),
            _json_response({"foo": "bar"}),  # no deployKey
            _text_response("", status_code=200),  # best-effort delete
        ])
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError, match="missing deployKey"):
            await client.provision_scratch_deployment(label="test-label")

        assert len(transport.requests) == 3
        delete_req = transport.requests[2]
        assert "/deployments/scratch-abc/delete" in str(delete_req.url)


# ---------------------------------------------------------------------------
# TestHttpxTeardownDeployment
# ---------------------------------------------------------------------------

class TestHttpxTeardownDeployment:
    @pytest.mark.asyncio
    async def test_happy_path_posts_delete(self) -> None:
        transport = _SequentialTransport([
            _text_response("", status_code=200),
        ])
        client = _make_client_with_transport(transport)

        # Should not raise
        await client.teardown_deployment(deployment_id="scratch-abc")

        assert len(transport.requests) == 1
        req = transport.requests[0]
        assert "/deployments/scratch-abc/delete" in str(req.url)

    @pytest.mark.asyncio
    async def test_404_treated_as_success(self) -> None:
        transport = _SequentialTransport([
            _text_response("not found", status_code=404),
        ])
        client = _make_client_with_transport(transport)

        # Should not raise
        await client.teardown_deployment(deployment_id="scratch-abc")

    @pytest.mark.asyncio
    async def test_500_raises_convex_management_error(self) -> None:
        transport = _SequentialTransport([
            _json_response({"error": "server error"}, status_code=500),
        ])
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError) as exc_info:
            await client.teardown_deployment(deployment_id="scratch-abc")

        assert "500" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_network_error_raises_convex_management_error(self) -> None:
        exc = httpx.ConnectError("connection refused")
        transport = _ErrorTransport(exc)
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError) as exc_info:
            await client.teardown_deployment(deployment_id="scratch-abc")

        assert "ConnectError" in str(exc_info.value)


# ---------------------------------------------------------------------------
# TestHttpxSecurityAndValidation
# ---------------------------------------------------------------------------

class TestHttpxSecurityAndValidation:
    def test_missing_access_token_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="access_token"):
            HttpxConvexManagementClient(
                access_token="",
                scratch_host_project_id="12345",
            )

    def test_missing_project_id_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="scratch_host_project_id"):
            HttpxConvexManagementClient(
                access_token="tok",
                scratch_host_project_id="",
            )

    def test_truncate_body_strips_authorization_echo(self) -> None:
        result = _truncate_body("Error: Authorization: Bearer leaked-token")
        assert "leaked-token" not in result

    def test_truncate_body_strips_bearer_lines(self) -> None:
        result = _truncate_body("line1\nBearer some-secret\nline3")
        assert "some-secret" not in result
        assert "line1" in result
        assert "line3" in result

    def test_truncate_body_respects_limit(self) -> None:
        long_text = "a" * 300
        result = _truncate_body(long_text, limit=200)
        # 200 chars + ellipsis
        assert len(result) <= 202
        assert result.endswith("…")

    @pytest.mark.asyncio
    async def test_error_messages_never_contain_access_token(self) -> None:
        # Transport echoes the Authorization header value in the body
        auth_echo_body = "Authorization: Bearer test-token reflected in error"
        transport = _SequentialTransport([
            _text_response(auth_echo_body, status_code=500),
        ])
        client = _make_client_with_transport(transport)

        with pytest.raises(ConvexManagementError) as exc_info:
            await client.provision_scratch_deployment(label="test-label")

        assert "test-token" not in str(exc_info.value)


# ---------------------------------------------------------------------------
# TestGetManagementClient
# ---------------------------------------------------------------------------

class TestGetManagementClient:
    def test_raises_when_token_missing(self) -> None:
        from apps.api.domains.convex.management import get_management_client

        with patch("apps.api.config.settings") as mock_settings:
            mock_settings.convex_platform_access_token = ""
            mock_settings.convex_scratch_host_project_id = "12345"
            with pytest.raises(RuntimeError, match="CONVEX_PLATFORM_ACCESS_TOKEN"):
                get_management_client()

    def test_raises_when_project_id_missing(self) -> None:
        from apps.api.domains.convex.management import get_management_client

        with patch("apps.api.config.settings") as mock_settings:
            mock_settings.convex_platform_access_token = "x"
            mock_settings.convex_scratch_host_project_id = ""
            with pytest.raises(RuntimeError, match="CONVEX_SCRATCH_HOST_PROJECT_ID"):
                get_management_client()
