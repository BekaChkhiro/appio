"""Tests for the pre-build forbidden-pattern scanner."""

from __future__ import annotations

from pathlib import Path  # noqa: TC003

import pytest

from appio_builder.scanner import ScanError, scan_project


def _write(root: Path, rel: str, content: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_clean_project_passes(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "src/App.tsx",
        "export default function App() { return <div>hi</div>; }",
    )
    _write(tmp_path, "src/index.tsx", "import App from './App';")
    # index.html is in the trusted-filename allowlist (it ships from the
    # base template) so it's intentionally NOT counted in files_scanned.
    _write(tmp_path, "index.html", "<!doctype html><html></html>")
    report = scan_project(tmp_path)
    assert report.ok
    assert report.files_scanned == 2  # App.tsx + index.tsx, not index.html


def test_eval_call_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", "const x = eval('1+1');")
    with pytest.raises(ScanError) as exc:
        scan_project(tmp_path)
    assert "eval" in str(exc.value).lower()


def test_dangerously_set_inner_html_rejected(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "src/components/X.tsx",
        '<div dangerouslySetInnerHTML={{__html: "x"}} />',
    )
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_node_module_string_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", 'import fs from "fs";')
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_identifier_named_fs_is_allowed(tmp_path: Path) -> None:
    """``"fs"`` is forbidden as an import string but ``useFsSnapshot`` is fine."""
    _write(
        tmp_path,
        "src/App.tsx",
        "import { useFsSnapshot } from './hooks';\nconst f = useFsSnapshot();",
    )
    report = scan_project(tmp_path)
    assert report.ok


def test_trusted_filenames_skipped(tmp_path: Path) -> None:
    """Files in the trusted base template are never scanned."""
    # Each of these would otherwise trip a forbidden pattern.
    _write(tmp_path, "sw.js", "self.eval('whatever');")
    _write(tmp_path, "index.html", '<script type="module" src="x"></script>')
    _write(tmp_path, "package.json", '{"description":"use fs and eval"}')
    _write(tmp_path, "src/App.tsx", "export default () => <div/>;")
    report = scan_project(tmp_path)
    assert report.ok
    # Only App.tsx counts as scanned.
    assert report.files_scanned == 1


def test_javascript_uri_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", '<a href="javascript:alert(1)">x</a>')
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_collect_findings_without_raising(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", "eval('x'); document.write('y');")
    report = scan_project(tmp_path, raise_on_finding=False)
    assert not report.ok
    assert len(report.findings) >= 2


# --- T2.7: expanded patterns ---


def test_websocket_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", 'const ws = new WebSocket("wss://x.com");')
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_shared_array_buffer_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", "const buf = new SharedArrayBuffer(1024);")
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_xml_http_request_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", "const xhr = new XMLHttpRequest();")
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_http_fetch_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", "fetch('http://evil.com/data');")
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_https_fetch_allowed(tmp_path: Path) -> None:
    """HTTPS fetch is fine — only plain HTTP is rejected."""
    _write(tmp_path, "src/App.tsx", "// This is safe\nconst x = 1;")
    report = scan_project(tmp_path)
    assert report.ok


def test_api_key_leak_rejected(tmp_path: Path) -> None:
    fake_key = "sk_" + "live_abc123def456ghi789jkl012mno345pqr"
    _write(
        tmp_path,
        "src/App.tsx",
        f'const key = "{fake_key}";',
    )
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_aws_key_leak_rejected(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "src/App.tsx",
        'const key = "AKIAIOSFODNN7EXAMPLE";',
    )
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_service_worker_register_rejected(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "src/App.tsx",
        "navigator.serviceWorker.register('/my-sw.js');",
    )
    with pytest.raises(ScanError):
        scan_project(tmp_path)


def test_crypto_module_rejected(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", 'import crypto from "crypto";')
    with pytest.raises(ScanError):
        scan_project(tmp_path)
