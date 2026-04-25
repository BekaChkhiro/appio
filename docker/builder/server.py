#!/usr/bin/env python3
"""In-image build server for the Appio builder.

Listens on ``fly-local-6pn:8080`` (so it's reachable only from inside the
Fly organization private network) and exposes a single endpoint:

    POST /build
        request:  { "project_tar_b64": "<tar.gz of project>" }
        response: { "exit_code": int,
                    "stdout": str,
                    "stderr": str,
                    "dist_tar_b64": "<tar.gz of dist/>" }

For each request the server:

1. Decodes the project tarball into a fresh ``/workspace`` subtree.
2. Runs ``nsjail --config /build/nsjail.cfg -- node /build/base/esbuild.config.mjs``
   with ``/workspace`` as the working directory (no network, RO FS, mem/CPU
   limits enforced by nsjail).
3. If ``/workspace/dist`` exists, tar+base64-encodes it for the response.
4. Wipes ``/workspace`` so the next request starts clean.

Implementation notes:

- Uses only the Python stdlib so the image stays slim (base ``node:20-slim``
  ships ``python3`` already; we just need to add the script, no pip).
- Single-threaded ``HTTPServer`` is fine: builds are serialized per
  machine anyway, and the warm pool gives us horizontal concurrency.
- 60 s build timeout matches the orchestrator's contract; longer requests
  are killed and reported as ``exit_code: 124`` (the conventional value
  for timeouts).
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import shutil
import socket
import subprocess
import sys
import tarfile
from http.server import BaseHTTPRequestHandler, HTTPServer

WORKDIR = "/workspace"
NSJAIL_CONFIG = "/build/nsjail.cfg"
ESBUILD_SCRIPT = "/build/base/esbuild.config.mjs"
NODE_BIN = "/usr/local/bin/node"
NSJAIL_BIN = "/usr/bin/nsjail"
DEFAULT_PORT = 8080
BUILD_TIMEOUT_SECONDS = 60
MAX_REQUEST_BYTES = 16 * 1024 * 1024  # 16 MiB — generated projects are tiny

log = logging.getLogger("appio-builder")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)


def _wipe_workdir() -> None:
    if not os.path.isdir(WORKDIR):
        os.makedirs(WORKDIR, exist_ok=True)
        return
    for entry in os.listdir(WORKDIR):
        path = os.path.join(WORKDIR, entry)
        try:
            if os.path.islink(path) or os.path.isfile(path):
                os.unlink(path)
            elif os.path.isdir(path):
                shutil.rmtree(path)
        except OSError as exc:
            log.warning("failed to clean %s: %s", path, exc)


def _unpack_project(b64: str) -> None:
    raw = base64.b64decode(b64, validate=True)
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
        for member in tar.getmembers():
            if not (member.isfile() or member.isdir()):
                raise ValueError(
                    f"refusing to extract non-regular tar entry: {member.name}"
                )
            target = os.path.realpath(os.path.join(WORKDIR, member.name))
            if not target.startswith(os.path.realpath(WORKDIR) + os.sep) and target != os.path.realpath(WORKDIR):
                raise ValueError(
                    f"refusing path-traversal entry: {member.name}"
                )
        # Python 3.12+ requires an explicit filter; "data" is the safe
        # default per PEP 706 and matches our pre-validation above.
        tar.extractall(WORKDIR, filter="data")


def _pack_dist() -> str:
    dist_dir = os.path.join(WORKDIR, "dist")
    if not os.path.isdir(dist_dir):
        return ""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz", compresslevel=6) as tar:
        tar.add(dist_dir, arcname="dist")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _run_nsjail() -> tuple[int, str, str]:
    """Run esbuild inside nsjail. Returns (exit_code, stdout, stderr)."""
    cmd = [
        NSJAIL_BIN,
        "--config", NSJAIL_CONFIG,
        "--cwd", WORKDIR,
        "--",
        NODE_BIN, ESBUILD_SCRIPT,
    ]
    try:
        completed = subprocess.run(  # noqa: S603 — controlled args
            cmd,
            capture_output=True,
            text=True,
            timeout=BUILD_TIMEOUT_SECONDS,
            check=False,
        )
        return completed.returncode, completed.stdout, completed.stderr
    except subprocess.TimeoutExpired as exc:
        return (
            124,
            (exc.stdout or "") if isinstance(exc.stdout, str) else "",
            f"build timed out after {BUILD_TIMEOUT_SECONDS}s",
        )
    except FileNotFoundError as exc:
        return -1, "", f"failed to launch nsjail: {exc}"


class BuildHandler(BaseHTTPRequestHandler):
    server_version = "AppioBuilder/1.0"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        log.info("%s - %s", self.address_string(), format % args)

    def _send_json(self, status: int, body: dict[str, object]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802 — http.server convention
        if self.path == "/health":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 — http.server convention
        if self.path != "/build":
            self._send_json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "invalid Content-Length"})
            return

        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._send_json(
                413,
                {"error": f"request body must be 1..{MAX_REQUEST_BYTES} bytes"},
            )
            return

        try:
            body = self.rfile.read(length)
            payload = json.loads(body)
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"error": f"invalid JSON: {exc}"})
            return

        project_b64 = payload.get("project_tar_b64")
        if not isinstance(project_b64, str) or not project_b64:
            self._send_json(400, {"error": "missing project_tar_b64"})
            return

        _wipe_workdir()
        try:
            _unpack_project(project_b64)
        except (ValueError, tarfile.TarError, base64.binascii.Error) as exc:
            self._send_json(
                400,
                {
                    "exit_code": 65,
                    "stdout": "",
                    "stderr": f"failed to unpack project: {exc}",
                    "dist_tar_b64": "",
                },
            )
            return

        exit_code, stdout, stderr = _run_nsjail()
        dist_b64 = ""
        if exit_code == 0:
            try:
                dist_b64 = _pack_dist()
            except (OSError, tarfile.TarError) as exc:
                exit_code = 65
                stderr = (stderr + f"\nfailed to pack dist: {exc}").strip()

        self._send_json(
            200,
            {
                "exit_code": exit_code,
                "stdout": stdout[:65536],
                "stderr": stderr[:65536],
                "dist_tar_b64": dist_b64,
            },
        )

        _wipe_workdir()


def _resolve_bind_host() -> str:
    """Bind to ``fly-local-6pn`` if it resolves, else ``::``.

    On Fly Machines this hostname is added to ``/etc/hosts`` and points at
    the machine's 6PN address. Outside Fly (local docker run) it doesn't
    exist; falling back to ``::`` (all interfaces) keeps the image testable.
    """
    try:
        socket.getaddrinfo("fly-local-6pn", None)
        return "fly-local-6pn"
    except socket.gaierror:
        return "::"


def main() -> int:
    bind_host = _resolve_bind_host()
    port = int(os.environ.get("APPIO_BUILDER_PORT", str(DEFAULT_PORT)))

    # IPv6-capable HTTPServer
    class V6Server(HTTPServer):
        address_family = socket.AF_INET6

    server = V6Server((bind_host, port), BuildHandler)
    log.info("appio-builder listening on [%s]:%d", bind_host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("shutting down")
    return 0


if __name__ == "__main__":
    sys.exit(main())
