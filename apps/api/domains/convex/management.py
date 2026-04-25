"""Convex Management API client (T3.9).

Provisions short-lived scratch deployments for tenant-scoped data migration
per ADR 007 §Data migration.
"""

from __future__ import annotations

import contextlib
import re
import time
from dataclasses import dataclass
from typing import Protocol

import httpx
import structlog

logger = structlog.stdlib.get_logger()

# Accepts `https://{name}.convex.cloud` (US / legacy) and
# `https://{name}.{region}.convex.cloud` (current, e.g. eu-west-1). `.site` is
# allowed because Convex's public HTTP-action endpoints live there. Validated
# against real Management API responses on 2026-04-21.
_DEPLOYMENT_URL_RE = re.compile(
    r"^https://[a-z0-9-]+(\.[a-z0-9-]+)?\.convex\.(cloud|site)$"
)


def _truncate_body(text: str, limit: int = 200) -> str:
    """Truncate + scrub a response body for inclusion in error messages.

    Defence-in-depth: if a misbehaving API ever reflects request headers back,
    the Authorization value could appear in response text. Strip any line
    containing "bearer" (case-insensitive).
    """
    lines = [
        ln for ln in text.splitlines()
        if "bearer" not in ln.lower() and "authorization" not in ln.lower()
    ]
    joined = " ".join(lines)
    return joined[:limit] + ("…" if len(joined) > limit else "")


@dataclass(frozen=True)
class ScratchDeployment:
    deployment_id: str
    deployment_url: str
    deploy_key: str  # Ephemeral; lives only for this publish job


class ConvexManagementError(RuntimeError):
    """Raised when the Convex Management API call fails."""


class ConvexManagementClient(Protocol):
    async def provision_scratch_deployment(self, *, label: str) -> ScratchDeployment: ...
    async def teardown_deployment(self, *, deployment_id: str) -> None: ...


class HttpxConvexManagementClient:
    """Real implementation — HTTP calls against https://api.convex.dev/v1/.

    Instantiate via ``get_management_client()`` or use as an async context
    manager::

        async with HttpxConvexManagementClient(...) as client:
            dep = await client.provision_scratch_deployment(label="job-123")

    For short-lived pipeline workers, letting GC reclaim the underlying
    ``httpx.AsyncClient`` is acceptable; call ``await client.aclose()``
    explicitly when possible.
    """

    def __init__(
        self,
        *,
        access_token: str,
        scratch_host_project_id: str,
        base_url: str = "https://api.convex.dev/v1",
    ) -> None:
        if not access_token:
            raise ValueError("access_token is required")
        if not scratch_host_project_id:
            raise ValueError("scratch_host_project_id is required")
        self._access_token = access_token
        self._scratch_host_project_id = scratch_host_project_id
        self._base_url = base_url.rstrip("/")
        self._http = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            headers={"Authorization": f"Bearer {access_token}"},
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> HttpxConvexManagementClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    async def provision_scratch_deployment(self, *, label: str) -> ScratchDeployment:
        """Create a dev-type deployment in Appio's scratch-host project with a
        1h TTL, then generate a deploy key for it.  Returns both bundled in
        ScratchDeployment.
        """
        # 1. Create deployment
        expires_at_ms = int((time.time() + 3600) * 1000)  # 1h TTL
        create_url = (
            f"{self._base_url}/projects/{self._scratch_host_project_id}/create_deployment"
        )
        try:
            resp = await self._http.post(
                create_url,
                json={
                    "type": "dev",
                    "reference": label,
                    "expiresAt": expires_at_ms,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            raise ConvexManagementError(
                f"Create deployment failed (HTTP {exc.response.status_code}): "
                f"{_truncate_body(exc.response.text)}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ConvexManagementError(
                f"Create deployment request failed: {type(exc).__name__}: {exc}"
            ) from exc

        deployment_name = data.get("name")
        deployment_url = data.get("deploymentUrl")
        if not deployment_name or not deployment_url:
            # If we got a name but not a URL (or vice versa), try to clean up.
            if deployment_name:
                await self._delete_deployment_best_effort(deployment_name)
            raise ConvexManagementError(
                "Create deployment response missing required fields (name, deploymentUrl)"
            )
        if not _DEPLOYMENT_URL_RE.fullmatch(deployment_url):
            # Real deployment was created but URL shape is unrecognised — don't
            # leak it.  Teardown is best-effort; if it fails the deployment's
            # expiresAt will let Convex reap it within 1h anyway.
            await self._delete_deployment_best_effort(deployment_name)
            raise ConvexManagementError(
                f"Create deployment returned an unexpected deploymentUrl shape: "
                f"{deployment_url!r}"
            )

        # 2. Generate deploy key for the new deployment
        key_url = f"{self._base_url}/deployments/{deployment_name}/create_deploy_key"
        try:
            resp = await self._http.post(key_url, json={"name": label})
            resp.raise_for_status()
            key_data = resp.json()
        except httpx.HTTPStatusError as exc:
            # We have an orphan deployment now — best-effort teardown, then raise.
            try:
                await self._delete_deployment_best_effort(deployment_name)
            except Exception:
                logger.error(
                    "orphan_scratch_after_key_failure",
                    deployment_name=deployment_name,
                )
            raise ConvexManagementError(
                f"Create deploy key failed (HTTP {exc.response.status_code}): "
                f"{_truncate_body(exc.response.text)}"
            ) from exc
        except httpx.HTTPError as exc:
            try:
                await self._delete_deployment_best_effort(deployment_name)
            except Exception:
                logger.error(
                    "orphan_scratch_after_key_failure",
                    deployment_name=deployment_name,
                )
            raise ConvexManagementError(
                f"Create deploy key request failed: {type(exc).__name__}: {exc}"
            ) from exc

        deploy_key = key_data.get("deployKey")
        if not deploy_key:
            try:
                await self._delete_deployment_best_effort(deployment_name)
            except Exception:
                logger.error(
                    "orphan_scratch_after_key_failure",
                    deployment_name=deployment_name,
                )
            raise ConvexManagementError(
                "Create deploy key response missing deployKey field"
            )

        logger.info(
            "scratch_deployment_provisioned",
            deployment_name=deployment_name,
            deployment_url=deployment_url,
            expires_at_ms=expires_at_ms,
            label=label,
        )
        return ScratchDeployment(
            deployment_id=deployment_name,  # use `name` as our canonical identifier
            deployment_url=deployment_url,
            deploy_key=deploy_key,
        )

    async def teardown_deployment(self, *, deployment_id: str) -> None:
        """Delete the deployment.  404 is treated as already-torn-down (success)."""
        url = f"{self._base_url}/deployments/{deployment_id}/delete"
        try:
            resp = await self._http.post(url)
            if resp.status_code == 404:
                logger.info(
                    "scratch_deployment_already_gone",
                    deployment_id=deployment_id,
                )
                return
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise ConvexManagementError(
                f"Delete deployment failed (HTTP {exc.response.status_code}): "
                f"{_truncate_body(exc.response.text)}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ConvexManagementError(
                f"Delete deployment request failed: {type(exc).__name__}: {exc}"
            ) from exc

        logger.info("scratch_deployment_torn_down", deployment_id=deployment_id)

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    async def _delete_deployment_best_effort(self, deployment_name: str) -> None:
        """Best-effort teardown for orphan cleanup paths.  Swallows all errors."""
        with contextlib.suppress(Exception):
            await self._http.post(
                f"{self._base_url}/deployments/{deployment_name}/delete",
                timeout=httpx.Timeout(5.0, connect=3.0),
            )


class FakeConvexManagementClient:
    """In-memory fake for tests. Tracks provision/teardown calls."""

    def __init__(
        self,
        *,
        fail_on_provision: bool = False,
        fail_on_teardown: bool = False,
    ) -> None:
        self._counter = 0
        self._provisioned: dict[str, ScratchDeployment] = {}
        self.teardown_calls: list[str] = []  # deployment_ids torn down
        self.fail_on_provision = fail_on_provision
        self.fail_on_teardown = fail_on_teardown

    async def provision_scratch_deployment(self, *, label: str) -> ScratchDeployment:
        if self.fail_on_provision:
            raise ConvexManagementError("fake: provision failed")
        self._counter += 1
        dep = ScratchDeployment(
            deployment_id=f"scratch-{self._counter}",
            deployment_url=f"https://scratch-{self._counter}.convex.cloud",
            deploy_key=f"prod:appio-scratch|fake-secret-{self._counter}",
        )
        self._provisioned[dep.deployment_id] = dep
        return dep

    async def teardown_deployment(self, *, deployment_id: str) -> None:
        self.teardown_calls.append(deployment_id)
        if self.fail_on_teardown:
            raise ConvexManagementError("fake: teardown failed")
        self._provisioned.pop(deployment_id, None)

    @property
    def live_deployments(self) -> list[str]:
        return list(self._provisioned.keys())


def get_management_client() -> HttpxConvexManagementClient:
    """Return a real management client using the platform access token from settings.

    Raises RuntimeError if CONVEX_PLATFORM_ACCESS_TOKEN or
    CONVEX_SCRATCH_HOST_PROJECT_ID are not configured.
    Inject FakeConvexManagementClient in tests instead of calling this.
    """
    from apps.api.config import settings

    token = settings.convex_platform_access_token
    project_id = settings.convex_scratch_host_project_id
    if not token:
        raise RuntimeError(
            "CONVEX_PLATFORM_ACCESS_TOKEN is not set. "
            "Generate one at dashboard.convex.dev/team/settings/access-tokens "
            "and set it in the environment, or inject FakeConvexManagementClient for tests."
        )
    if not project_id:
        raise RuntimeError(
            "CONVEX_SCRATCH_HOST_PROJECT_ID is not set. "
            "Create a dedicated scratch-host project in the Appio Convex team "
            "and set its numeric ID in the environment."
        )
    return HttpxConvexManagementClient(
        access_token=token,
        scratch_host_project_id=project_id,
    )
