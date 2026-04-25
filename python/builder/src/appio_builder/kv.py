"""Cloudflare Workers KV client.

The Worker that serves ``*.appiousercontent.com`` reads the current
version pointer for each app from a KV namespace:

    KV[app_id] -> "v{N}"

After a successful R2 upload the orchestrator atomically swaps this
pointer so the next request hits the new version. KV is eventually
consistent (~60s globally) — that's fine because the URL clients see
already includes a content-hash for static assets.

We hit the Cloudflare REST API directly via httpx; the KV namespace API
is small enough that pulling in cloudflare-python would be overkill.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

import httpx

__all__ = ["KVClient", "KVError"]


class KVError(RuntimeError):
    """Raised on Cloudflare KV API failures."""


@dataclass(frozen=True, slots=True)
class _KVConfig:
    api_token: str
    account_id: str
    namespace_id: str


class KVClient:
    """Async client for the Cloudflare Workers KV REST API."""

    def __init__(
        self,
        *,
        api_token: str,
        account_id: str,
        namespace_id: str,
        timeout: float = 15.0,
    ):
        if not (api_token and account_id and namespace_id):
            raise KVError(
                "KV requires CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, "
                "and CLOUDFLARE_KV_NAMESPACE_ID"
            )
        self._config = _KVConfig(
            api_token=api_token,
            account_id=account_id,
            namespace_id=namespace_id,
        )
        self._base_url = (
            f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
            f"/storage/kv/namespaces/{namespace_id}"
        )
        self._client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=timeout,
        )

    async def __aenter__(self) -> KVClient:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------ ops

    async def put_version_pointer(self, app_id: str, version: int) -> None:
        """Set ``KV[app_id] = "v{version}"``.

        Raises :class:`KVError` if the API call fails. The pointer value is
        a plain string; the Worker parses ``v{N}`` and concatenates it
        into the R2 object key.
        """
        if version < 1:
            raise KVError(f"version must be >= 1, got {version}")
        if not app_id:
            raise KVError("app_id is required")

        value = f"v{version}"
        url = f"{self._base_url}/values/{quote(app_id, safe='')}"
        # KV PUT takes a raw body — text/plain is the conventional content type.
        response = await self._client.put(
            url,
            content=value.encode("utf-8"),
            headers={"Content-Type": "text/plain"},
        )
        self._raise_for_status(response, op=f"put {app_id}")

    async def get_version_pointer(self, app_id: str) -> str | None:
        """Read the current pointer for ``app_id`` or ``None`` if unset."""
        url = f"{self._base_url}/values/{quote(app_id, safe='')}"
        response = await self._client.get(url)
        if response.status_code == 404:
            return None
        self._raise_for_status(response, op=f"get {app_id}")
        return response.text

    async def delete_version_pointer(self, app_id: str) -> None:
        """Remove the pointer entirely (used when an app is deleted)."""
        url = f"{self._base_url}/values/{quote(app_id, safe='')}"
        response = await self._client.delete(url)
        if response.status_code == 404:
            return
        self._raise_for_status(response, op=f"delete {app_id}")

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _raise_for_status(response: httpx.Response, *, op: str) -> None:
        if response.is_success:
            return
        raise KVError(
            f"Cloudflare KV {op} failed: "
            f"{response.status_code} {response.text[:500]}"
        )
