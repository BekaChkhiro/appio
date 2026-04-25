"""Tests for the Fly Machines client + 6PN HTTP build dispatcher.

The dispatcher is the integration seam most likely to silently break:
the original implementation called a non-existent ``POST /machines/{id}/exec``
endpoint and would have failed only at deploy time. These tests pin the
URL contract and the JSON shape against an httpx ``MockTransport`` so the
dispatcher remains correct under refactor.
"""

from __future__ import annotations

import httpx
import pytest

from appio_builder.fly import (
    BuildDispatchResult,
    FlyError,
    MachinePool,
    dispatch_build_over_6pn,
    machine_internal_url,
)


def test_internal_url_format() -> None:
    url = machine_internal_url(machine_id="abc123", app_name="appio-builder")
    assert url == "http://abc123.vm.appio-builder.internal:8080/build"


def test_internal_url_custom_port() -> None:
    url = machine_internal_url(
        machine_id="m1", app_name="builder", port=9000
    )
    assert url == "http://m1.vm.builder.internal:9000/build"


def test_internal_url_validates_inputs() -> None:
    with pytest.raises(FlyError):
        machine_internal_url(machine_id="", app_name="x")
    with pytest.raises(FlyError):
        machine_internal_url(machine_id="x", app_name="")


def test_machine_pool_round_robin() -> None:
    pool = MachinePool(("a", "b", "c"))
    assert [pool.next() for _ in range(7)] == ["a", "b", "c", "a", "b", "c", "a"]
    assert pool.size == 3


def test_machine_pool_empty_rejected() -> None:
    with pytest.raises(FlyError):
        MachinePool(())


# ---------------------------------------------------------------------------
# dispatch_build_over_6pn — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dispatch_success() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["method"] = request.method
        captured["json"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "exit_code": 0,
                "stdout": "build complete: 5 files",
                "stderr": "",
                "dist_tar_b64": "ZmFrZS10YXI=",  # "fake-tar"
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        result = await dispatch_build_over_6pn(
            machine_id="m1",
            app_name="appio-builder",
            project_tar_b64="ZmFrZS1wcm9qZWN0",
            timeout_seconds=60,
            http_client=client,
        )

    assert isinstance(result, BuildDispatchResult)
    assert result.exit_code == 0
    assert result.dist_tar_b64 == "ZmFrZS10YXI="
    assert result.stdout == "build complete: 5 files"
    assert captured["method"] == "POST"
    assert "m1.vm.appio-builder.internal" in str(captured["url"])
    assert "ZmFrZS1wcm9qZWN0" in str(captured["json"])


@pytest.mark.asyncio
async def test_dispatch_build_failure_returns_nonzero_exit() -> None:
    """A failed esbuild is reported via exit_code, not an HTTP error."""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "exit_code": 1,
                "stdout": "",
                "stderr": "src/App.tsx: SyntaxError",
                "dist_tar_b64": "",
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await dispatch_build_over_6pn(
            machine_id="m1",
            app_name="appio-builder",
            project_tar_b64="x",
            timeout_seconds=60,
            http_client=client,
        )
    assert result.exit_code == 1
    assert "SyntaxError" in result.stderr
    assert result.dist_tar_b64 == ""


@pytest.mark.asyncio
async def test_dispatch_http_500_raises_fly_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="server crashed")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(FlyError, match="500"):
            await dispatch_build_over_6pn(
                machine_id="m1",
                app_name="appio-builder",
                project_tar_b64="x",
                timeout_seconds=60,
                http_client=client,
            )


@pytest.mark.asyncio
async def test_dispatch_invalid_json_raises() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="not json at all")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(FlyError, match="not valid JSON"):
            await dispatch_build_over_6pn(
                machine_id="m1",
                app_name="appio-builder",
                project_tar_b64="x",
                timeout_seconds=60,
                http_client=client,
            )


@pytest.mark.asyncio
async def test_dispatch_network_error_raises_fly_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no route to host")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(FlyError, match="dispatch failed"):
            await dispatch_build_over_6pn(
                machine_id="m1",
                app_name="appio-builder",
                project_tar_b64="x",
                timeout_seconds=60,
                http_client=client,
            )
