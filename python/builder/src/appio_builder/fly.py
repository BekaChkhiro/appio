"""Fly.io Machines REST API client + 6PN HTTP build dispatcher.

We use the **stop/restart** pattern, not create/destroy:

- Pre-warm a small pool of machines per region (configured via
  ``FLY_BUILDER_MACHINE_IDS``).
- For each build: ``start`` the chosen machine (~300ms wake), POST the
  payload to its in-image HTTP server over Fly's 6PN private network,
  ``stop`` it again so we only pay for stopped rootfs.

There is **no REST exec endpoint** on the Machines API (verified against
the official docs at fly.io/docs/machines/api/machines-resource — only
``create``, ``get``, ``list``, ``update``, ``start``, ``stop``,
``suspend``, ``delete``, leases, and ``cordon``/``uncordon`` exist). The
flyctl ``machine exec`` subcommand uses an SSH-over-WireGuard channel,
not a public REST endpoint, so we cannot use it from a server-side worker
without bringing up WireGuard locally.

The recommended pattern (and the one we implement) is:

1. Bake a tiny HTTP server into the builder image (``docker/builder/server.py``).
2. Have the server listen on ``fly-local-6pn:8080`` so it's only reachable
   over the org-private 6PN network.
3. Resolve the target machine via Fly's internal DNS:
   ``http://{machine_id}.vm.{app_name}.internal:8080/build``.
4. POST the project tarball; the server responds with the dist tarball.

The dispatcher therefore lives in two halves: this file owns the lifecycle
+ HTTP POST, and the in-image server owns build execution. Both are
covered by typed errors so the orchestrator can decide retry vs AutoFix.

References:
- https://fly.io/docs/machines/api/machines-resource/
- https://fly.io/docs/machines/api/working-with-machines-api/
- https://fly.io/blog/incoming-6pn-private-networks/
- https://fly.io/docs/networking/private-networking/
"""

from __future__ import annotations

import asyncio
import itertools
from collections.abc import Iterable  # noqa: TC003
from dataclasses import dataclass
from typing import Any

import httpx

__all__ = [
    "BuildDispatchResult",
    "FlyError",
    "FlyMachineClient",
    "MachinePool",
    "dispatch_build_over_6pn",
    "machine_internal_url",
]

_DEFAULT_BASE = "https://api.machines.dev/v1"


class FlyError(RuntimeError):
    """Raised when a Fly.io API call fails or a machine never reaches the
    expected state in time."""


@dataclass(frozen=True, slots=True)
class BuildDispatchResult:
    """Result of one HTTP build dispatch round trip."""

    machine_id: str
    exit_code: int
    stdout: str
    stderr: str
    dist_tar_b64: str


def machine_internal_url(
    *, machine_id: str, app_name: str, port: int = 8080
) -> str:
    """Build the 6PN internal URL for a specific machine.

    Fly's internal DNS resolves ``{machine_id}.vm.{app}.internal`` to the
    machine's 6PN IPv6 address. Only callers inside the same Fly
    organization (i.e. an API process running on Fly) can reach this
    hostname — if you need it from your laptop, you have to bring up the
    WireGuard tunnel first.
    """
    if not machine_id or not app_name:
        raise FlyError("machine_id and app_name are required")
    return f"http://{machine_id}.vm.{app_name}.internal:{port}/build"


class FlyMachineClient:
    """Thin async wrapper over the Fly Machines REST API.

    Reuses a single :class:`httpx.AsyncClient` per instance — callers should
    use ``async with FlyMachineClient(...) as client:`` so the connection
    pool is closed cleanly.
    """

    def __init__(
        self,
        api_token: str,
        app_name: str,
        *,
        base_url: str = _DEFAULT_BASE,
        timeout: float = 30.0,
    ):
        if not api_token:
            raise FlyError("FLY_API_TOKEN is required")
        if not app_name:
            raise FlyError("Fly app name is required")
        self._app_name = app_name
        self._base_url = f"{base_url.rstrip('/')}/apps/{app_name}"
        self._client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    async def __aenter__(self) -> FlyMachineClient:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    @property
    def app_name(self) -> str:
        return self._app_name

    # ------------------------------------------------------------------ lifecycle

    async def get_machine(self, machine_id: str) -> dict[str, Any]:
        response = await self._client.get(f"{self._base_url}/machines/{machine_id}")
        self._raise_for_status(response, "get_machine")
        return response.json()

    async def start_machine(self, machine_id: str) -> dict[str, Any]:
        """Start a stopped machine. Returns immediately; pair with
        :meth:`wait_for_state` to block until ready."""
        response = await self._client.post(
            f"{self._base_url}/machines/{machine_id}/start"
        )
        self._raise_for_status(response, "start_machine")
        return response.json()

    async def stop_machine(self, machine_id: str) -> dict[str, Any]:
        response = await self._client.post(
            f"{self._base_url}/machines/{machine_id}/stop"
        )
        self._raise_for_status(response, "stop_machine")
        return response.json()

    async def wait_for_state(
        self,
        machine_id: str,
        state: str,
        *,
        timeout_seconds: float = 30.0,
        poll_interval: float = 0.1,
    ) -> None:
        """Poll the machine until it reaches ``state`` or the timeout fires.

        Fly does expose a ``GET /machines/{id}/wait?state=...`` endpoint with
        a 60 s hard cap, but it returns 408 when the machine is already in
        the requested state — error-prone for the warm-pool case where a
        machine may already be ``started`` from a previous build. Polling
        ``GET /machines/{id}`` is simpler and gives us tight control over
        the per-build latency budget.
        """
        deadline = asyncio.get_event_loop().time() + timeout_seconds
        while True:
            machine = await self.get_machine(machine_id)
            if machine.get("state") == state:
                return
            if asyncio.get_event_loop().time() >= deadline:
                raise FlyError(
                    f"machine {machine_id} did not reach state {state!r} "
                    f"within {timeout_seconds}s (last state: "
                    f"{machine.get('state')!r})"
                )
            await asyncio.sleep(poll_interval)

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _raise_for_status(response: httpx.Response, op: str) -> None:
        if response.is_success:
            return
        raise FlyError(
            f"Fly Machines API {op} failed: "
            f"{response.status_code} {response.text[:500]}"
        )


# ---------------------------------------------------------------------------
# 6PN HTTP build dispatcher
# ---------------------------------------------------------------------------


async def dispatch_build_over_6pn(
    *,
    machine_id: str,
    app_name: str,
    project_tar_b64: str,
    timeout_seconds: int,
    port: int = 8080,
    http_client: httpx.AsyncClient | None = None,
) -> BuildDispatchResult:
    """POST a project tarball to the in-image build server and return the result.

    The expected JSON contract (implemented by ``docker/builder/server.py``):

    Request::

        POST http://{machine_id}.vm.{app}.internal:8080/build
        Content-Type: application/json
        { "project_tar_b64": "<base64 tar.gz>" }

    Response (success)::

        200 OK
        { "exit_code": 0, "stdout": "...", "stderr": "...",
          "dist_tar_b64": "<base64 tar.gz of dist/>" }

    Response (build failure)::

        200 OK
        { "exit_code": 1, "stdout": "...", "stderr": "esbuild error...",
          "dist_tar_b64": "" }

    HTTP-level failures (machine unreachable, server crashed, request body
    too large) raise :class:`FlyError`. The orchestrator's caller maps a
    non-zero exit_code to ``LocalRunnerError`` so the AutoFix path is
    identical to the local runner.
    """
    url = machine_internal_url(machine_id=machine_id, app_name=app_name, port=port)
    payload = {"project_tar_b64": project_tar_b64}

    own_client = http_client is None
    client = http_client or httpx.AsyncClient(timeout=timeout_seconds + 10)
    try:
        try:
            response = await client.post(url, json=payload, timeout=timeout_seconds + 10)
        except httpx.HTTPError as exc:
            raise FlyError(
                f"build dispatch failed for machine {machine_id} at {url}: {exc}"
            ) from exc
    finally:
        if own_client:
            await client.aclose()

    if not response.is_success:
        raise FlyError(
            f"build server returned {response.status_code} for machine "
            f"{machine_id}: {response.text[:500]}"
        )

    try:
        body = response.json()
    except ValueError as exc:
        raise FlyError(
            f"build server response is not valid JSON: {response.text[:200]}"
        ) from exc

    return BuildDispatchResult(
        machine_id=machine_id,
        exit_code=int(body.get("exit_code", -1)),
        stdout=str(body.get("stdout", "")),
        stderr=str(body.get("stderr", "")),
        dist_tar_b64=str(body.get("dist_tar_b64", "")),
    )


class MachinePool:
    """Round-robin selector over a fixed set of pre-warmed machine IDs.

    The pool itself is just a counter — the orchestrator is responsible for
    handling the start/stop lifecycle. Concurrency caveat: this class is
    *not* thread-safe; Dramatiq workers should keep one pool per process.
    """

    def __init__(self, machine_ids: Iterable[str]):
        ids = tuple(machine_ids)
        if not ids:
            raise FlyError(
                "FLY_BUILDER_MACHINE_IDS is empty — pre-warm at least one "
                "machine before enabling the Fly runner"
            )
        self._ids = ids
        self._cycle = itertools.cycle(ids)

    def next(self) -> str:
        return next(self._cycle)

    @property
    def size(self) -> int:
        return len(self._ids)
