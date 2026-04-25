"""Tests for build output validation."""

from __future__ import annotations

import os
from pathlib import Path  # noqa: TC003

import pytest

from appio_builder.validation import OutputValidationError, validate_output


def _make_minimal_dist(tmp_path: Path) -> Path:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html>", encoding="utf-8")
    (dist / "sw.js").write_text("self.x=1;", encoding="utf-8")
    (dist / "manifest.json").write_text('{"name":"x"}', encoding="utf-8")
    (dist / "app-abc123.js").write_text("console.log(1);", encoding="utf-8")
    return dist


def test_minimal_valid_output(tmp_path: Path) -> None:
    dist = _make_minimal_dist(tmp_path)
    result = validate_output(dist)
    assert result.file_count == 4
    assert result.total_bytes > 0
    rel_paths = {a.rel_path for a in result.artifacts}
    assert {"index.html", "sw.js", "manifest.json", "app-abc123.js"} == rel_paths


def test_missing_required_file(tmp_path: Path) -> None:
    dist = _make_minimal_dist(tmp_path)
    (dist / "manifest.json").unlink()
    with pytest.raises(OutputValidationError, match="missing required files"):
        validate_output(dist)


def test_disallowed_extension(tmp_path: Path) -> None:
    dist = _make_minimal_dist(tmp_path)
    (dist / "secret.exe").write_bytes(b"MZ\x00\x00")
    with pytest.raises(OutputValidationError, match="disallowed file type"):
        validate_output(dist)


def test_oversized_file(tmp_path: Path) -> None:
    dist = _make_minimal_dist(tmp_path)
    big = dist / "big.js"
    # Just over 5 MB.
    big.write_bytes(b"x" * (5 * 1024 * 1024 + 1))
    with pytest.raises(OutputValidationError, match="exceeds"):
        validate_output(dist)


def test_empty_file_rejected(tmp_path: Path) -> None:
    dist = _make_minimal_dist(tmp_path)
    (dist / "blank.js").write_bytes(b"")
    with pytest.raises(OutputValidationError, match="empty file"):
        validate_output(dist)


def test_symlink_rejected(tmp_path: Path) -> None:
    dist = _make_minimal_dist(tmp_path)
    target = dist / "real.js"
    target.write_text("console.log(1);", encoding="utf-8")
    link = dist / "link.js"
    try:
        os.symlink(target, link)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not supported on this platform")
    with pytest.raises(OutputValidationError, match="symlinks"):
        validate_output(dist)


def test_missing_dist_directory(tmp_path: Path) -> None:
    with pytest.raises(OutputValidationError, match="missing"):
        validate_output(tmp_path / "does-not-exist")


def test_content_types(tmp_path: Path) -> None:
    dist = _make_minimal_dist(tmp_path)
    (dist / "style.css").write_text("body{}", encoding="utf-8")
    (dist / "icon-512.svg").write_text("<svg/>", encoding="utf-8")
    result = validate_output(dist)
    by_path = {a.rel_path: a for a in result.artifacts}
    assert by_path["index.html"].content_type.startswith("text/html")
    assert by_path["style.css"].content_type.startswith("text/css")
    assert by_path["icon-512.svg"].content_type == "image/svg+xml"
    assert by_path["app-abc123.js"].content_type.startswith("application/javascript")
