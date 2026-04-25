"""JSX safety scanner for AI-generated component bodies.

The hybrid AppSpec lets Claude return raw JSX strings for component render
bodies. Those strings are injected into the generated React project verbatim,
which means they cross a trust boundary. This module is the gate: every JSX
field must pass :func:`scan_jsx` before the code generator writes it to disk.

The scanner is intentionally conservative — it errs on the side of refusing
suspicious input. The build step (esbuild) is the second line of defence;
the AutoFix loop will retry on a sanitizer rejection just like it would on
any other validation error.
"""

from __future__ import annotations

import re

from appio_shared.constants import FORBIDDEN_PATTERNS

__all__ = ["UnsafeContentError", "scan_jsx", "scan_string"]


class UnsafeContentError(ValueError):
    """Raised when generated content contains a forbidden construct."""


# Patterns we will not allow inside a JSX body, even though some are also
# present in :data:`appio_shared.constants.FORBIDDEN_PATTERNS`. We list them
# here as compiled regexes for the cases where a substring check would have
# false positives.
_DANGEROUS_RE = [
    re.compile(r"<\s*script\b", re.IGNORECASE),
    re.compile(r"</\s*script\s*>", re.IGNORECASE),
    re.compile(r"\bdangerouslySetInnerHTML\b"),
    re.compile(r"\beval\s*\("),
    re.compile(r"\bnew\s+Function\s*\("),
    re.compile(r"\bFunction\s*\("),
    re.compile(r"\bimport\s*\("),  # dynamic import — never needed in a JSX body
    re.compile(r"\brequire\s*\("),
    re.compile(r"\b__proto__\b"),
    re.compile(r"\bdocument\.write\b"),
    re.compile(r"\bdocument\.cookie\b"),
    re.compile(r"\bwindow\.location\b"),
    re.compile(r"\blocation\.(?:href|replace|assign)\b"),
    re.compile(r"\binnerHTML\b"),
    re.compile(r"\bouterHTML\b"),
    re.compile(r"\binsertAdjacentHTML\b"),
    re.compile(r"\bimportScripts\b"),
    re.compile(r"\bpostMessage\b"),
    re.compile(r"\bopener\b"),
    re.compile(r"\btop\."),
    re.compile(r"\bparent\."),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"vbscript\s*:", re.IGNORECASE),
    re.compile(r"data:text/html", re.IGNORECASE),
    # Node-only modules
    re.compile(r"['\"]child_process['\"]"),
    re.compile(r"['\"]fs['\"]"),
    re.compile(r"['\"]net['\"]"),
    re.compile(r"['\"]crypto['\"]"),
    # T2.7: expanded patterns
    re.compile(r"\bXMLHttpRequest\b"),
    re.compile(r"\bsendBeacon\s*\("),
    re.compile(r"\bSharedArrayBuffer\b"),
    re.compile(r"\bAtomics\b"),
    re.compile(r"\bWebSocket\s*\("),
    re.compile(r"\bfetch\s*\(\s*['\"]http:", re.IGNORECASE),
]


# Patterns handled more precisely by _DANGEROUS_RE regexes — skip them in the
# raw substring scan to avoid false positives on identifiers like
# ``useFsSnapshot``, ``internet``, ``desktop.``  etc.
_SUBSTRING_EXCLUSIONS: frozenset[str] = frozenset(
    {"fs", "net", "path", "constructor[", "top.", "parent."}
)


def scan_jsx(jsx: str, *, field: str = "jsx") -> None:
    """Validate a JSX render body. Raises :class:`UnsafeContentError` on failure.

    Checks performed:

    1. Substring check against :data:`appio_shared.constants.FORBIDDEN_PATTERNS`
       (excluding short patterns that are covered by regex).
    2. Regex check against :data:`_DANGEROUS_RE` (catches event-handler payloads,
       script tags, etc.).
    3. Balanced ``{`` / ``}`` and ``<`` / ``>`` heuristics — a wildly unbalanced
       JSX body is almost certainly malformed and will break esbuild anyway.
    """
    if not jsx:
        return

    for pattern in FORBIDDEN_PATTERNS:
        if pattern in _SUBSTRING_EXCLUSIONS:
            continue
        if pattern in jsx:
            raise UnsafeContentError(
                f"forbidden pattern {pattern!r} in {field}"
            )

    for regex in _DANGEROUS_RE:
        if regex.search(jsx):
            raise UnsafeContentError(
                f"forbidden construct matching {regex.pattern!r} in {field}"
            )

    # Balanced-brace heuristic: allow up to 8 difference; beyond that the
    # snippet is almost certainly broken.
    open_braces = jsx.count("{")
    close_braces = jsx.count("}")
    if abs(open_braces - close_braces) > 8:
        raise UnsafeContentError(
            f"unbalanced braces in {field} ({open_braces} open vs {close_braces} close)"
        )


def scan_string(value: str, *, field: str) -> None:
    """Validate an arbitrary string field (theme color, prop value, etc.)."""
    if not value:
        return
    lowered = value.strip().lower()
    if lowered.startswith(("javascript:", "vbscript:")):
        raise UnsafeContentError(f"unsafe URL scheme in {field}: {value!r}")
    if lowered.startswith("data:text/html"):
        raise UnsafeContentError(f"unsafe data: URL in {field}: {value!r}")
