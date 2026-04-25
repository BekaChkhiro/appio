"""Tests for the dist tarball unpacker.

Locks in the Python 3.14 fix (extractall must use ``filter='data'``) and
the path-traversal / non-regular-file rejection.
"""

from __future__ import annotations

import base64
import io
import tarfile
from pathlib import Path  # noqa: TC003

import pytest

from appio_builder.fly import FlyError
from appio_builder.orchestrator import _unpack_dist


def _make_tar(entries: dict[str, bytes]) -> str:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, content in entries.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(content)
            tar.addfile(info, io.BytesIO(content))
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_unpack_round_trips_simple_dist(tmp_path: Path) -> None:
    project = tmp_path / "p"
    project.mkdir()
    payload = _make_tar(
        {
            "dist/index.html": b"<!doctype html>",
            "dist/sw.js": b"self.x=1;",
        }
    )
    dist = _unpack_dist(payload, project)
    assert dist == project / "dist"
    assert (dist / "dist" / "index.html").read_bytes() == b"<!doctype html>"
    assert (dist / "dist" / "sw.js").read_bytes() == b"self.x=1;"


def test_unpack_rejects_path_traversal(tmp_path: Path) -> None:
    project = tmp_path / "p"
    project.mkdir()
    payload = _make_tar({"../escape.txt": b"oops"})
    with pytest.raises(FlyError, match="path-traversal"):
        _unpack_dist(payload, project)


def test_unpack_rejects_symlink_member(tmp_path: Path) -> None:
    project = tmp_path / "p"
    project.mkdir()
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        info = tarfile.TarInfo(name="link")
        info.type = tarfile.SYMTYPE
        info.linkname = "/etc/passwd"
        tar.addfile(info)
    payload = base64.b64encode(buf.getvalue()).decode("ascii")
    with pytest.raises(FlyError, match="non-regular tar entry"):
        _unpack_dist(payload, project)


def test_unpack_empty_payload_rejected(tmp_path: Path) -> None:
    project = tmp_path / "p"
    project.mkdir()
    with pytest.raises(FlyError, match="empty stdout"):
        _unpack_dist("", project)


def test_unpack_invalid_base64_rejected(tmp_path: Path) -> None:
    project = tmp_path / "p"
    project.mkdir()
    with pytest.raises(FlyError, match="not valid base64"):
        _unpack_dist("not!!!valid!!!base64", project)
