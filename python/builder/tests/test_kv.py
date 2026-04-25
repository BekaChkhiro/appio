"""Tests for the Cloudflare Workers KV client.

Locks in the URL contract verified against the official docs at
https://developers.cloudflare.com/kv/api/write-key-value-pairs/.
"""

from __future__ import annotations

import httpx
import pytest

from appio_builder.kv import KVClient, KVError


def _client_with_handler(handler) -> KVClient:
    """Build a KVClient whose httpx.AsyncClient is wired to a MockTransport.

    We replace ``_client`` *and* preserve the original auth headers — the
    constructor sets them on the real client, so a naive replacement
    would silently drop the Authorization header and let bugs slip
    through this test suite.
    """
    kv = KVClient(
        api_token="t",
        account_id="acc",
        namespace_id="ns",
    )
    original_headers = dict(kv._client.headers)  # type: ignore[attr-defined]
    kv._client = httpx.AsyncClient(  # type: ignore[attr-defined]
        transport=httpx.MockTransport(handler),
        headers=original_headers,
    )
    return kv


@pytest.mark.asyncio
async def test_put_version_pointer_url_and_body() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["method"] = request.method
        captured["body"] = request.content.decode()
        captured["auth"] = request.headers.get("Authorization")
        return httpx.Response(
            200,
            json={"success": True, "errors": [], "messages": [], "result": None},
        )

    kv = _client_with_handler(handler)
    await kv.put_version_pointer("app-123", 7)
    await kv.close()

    assert captured["method"] == "PUT"
    assert captured["url"] == (
        "https://api.cloudflare.com/client/v4/accounts/acc"
        "/storage/kv/namespaces/ns/values/app-123"
    )
    assert captured["body"] == "v7"
    assert captured["auth"] == "Bearer t"


@pytest.mark.asyncio
async def test_put_url_encodes_special_characters() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(200, json={"success": True})

    kv = _client_with_handler(handler)
    await kv.put_version_pointer("app id/with spaces", 1)
    await kv.close()

    # Spaces and slashes must be percent-encoded so they don't cut the path.
    assert "app%20id%2Fwith%20spaces" in str(captured["url"])


@pytest.mark.asyncio
async def test_get_returns_value() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="v3")

    kv = _client_with_handler(handler)
    value = await kv.get_version_pointer("app-1")
    await kv.close()
    assert value == "v3"


@pytest.mark.asyncio
async def test_get_404_returns_none() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text="not found")

    kv = _client_with_handler(handler)
    assert await kv.get_version_pointer("missing") is None
    await kv.close()


@pytest.mark.asyncio
async def test_put_invalid_version_rejected() -> None:
    kv = KVClient(api_token="t", account_id="acc", namespace_id="ns")
    with pytest.raises(KVError, match="version must be"):
        await kv.put_version_pointer("app-1", 0)
    await kv.close()


def test_constructor_requires_credentials() -> None:
    with pytest.raises(KVError):
        KVClient(api_token="", account_id="a", namespace_id="n")
    with pytest.raises(KVError):
        KVClient(api_token="t", account_id="", namespace_id="n")
    with pytest.raises(KVError):
        KVClient(api_token="t", account_id="a", namespace_id="")
