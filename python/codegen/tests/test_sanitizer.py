"""Unit tests for the JSX sanitiser."""

from __future__ import annotations

import pytest

from appio_codegen.sanitizer import UnsafeContentError, scan_jsx, scan_string


def test_safe_jsx_passes() -> None:
    scan_jsx('<div className="p-4">{title}</div>')
    scan_jsx('<button onClick={() => setOpen(true)}>Open</button>')
    scan_jsx("")  # empty allowed
    scan_jsx(None)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "snippet",
    [
        '<div dangerouslySetInnerHTML={{__html: "x"}} />',
        '<a href="javascript:alert(1)">go</a>',
        "<script>alert(1)</script>",
        '{eval("alert(1)")}',
        '{new Function("return 1")()}',
        '{import("./x")}',
        "{document.write('x')}",
        "<div>{location.href = 'evil'}</div>",
        "<div>{__proto__.foo = 1}</div>",
    ],
)
def test_dangerous_jsx_rejected(snippet: str) -> None:
    with pytest.raises(UnsafeContentError):
        scan_jsx(snippet)


def test_unbalanced_braces_rejected() -> None:
    with pytest.raises(UnsafeContentError, match="unbalanced"):
        scan_jsx("<div>{{{{{{{{{{{</div>")


def test_scan_string_rejects_javascript_url() -> None:
    with pytest.raises(UnsafeContentError):
        scan_string("javascript:alert(1)", field="href")


def test_scan_string_allows_safe_text() -> None:
    scan_string("Hello world", field="title")
    scan_string("https://example.com/path", field="href")
    scan_string("", field="empty")
