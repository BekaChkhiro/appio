"""Pre-build code scanner.

The codegen sanitizer (``appio_codegen.sanitizer``) checks individual JSX
strings *before* they are written to disk. This module is the second line
of defence: it walks a *materialized* project directory and rejects it if
any source file contains a forbidden construct.

Why scan twice?

1. The codegen scanner only sees fields the AppSpec exposes — it can't
   catch patterns introduced by template files we ship ourselves
   (regression check).
2. Some attacks span multiple props (e.g. building an ``eval`` call piece
   by piece). A whole-file scan is the catch-all.
3. The forbidden-pattern list is shared with ``appio_shared.constants`` so
   that prompt engineering and the scanner stay in sync.

Performance: a typical generated project is < 30 small files. We read each
once with UTF-8 and scan in-memory; total cost is sub-millisecond.
"""

from __future__ import annotations

import re
from collections.abc import Iterable  # noqa: TC003
from dataclasses import dataclass, field
from pathlib import Path  # noqa: TC003

from appio_shared.constants import FORBIDDEN_PATTERNS

from .convex_scanner import (
    ConvexScanError,
    scan_convex_tenancy,
)

__all__ = ["ScanError", "ScanFinding", "ScanReport", "scan_project"]


# File extensions whose contents we scan. Binaries (icons, fonts) are skipped
# but their *presence* is still validated by ``validation.validate_output``.
_SCANNED_EXTENSIONS: frozenset[str] = frozenset(
    {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html", ".json", ".svg"}
)

# Files we never scan even if their extension matches — they are part of
# the trusted base template, not user-controlled. Note that user-supplied
# fragments substituted *into* these files (theme color, app name, etc.)
# are scanned upstream by ``appio_codegen.sanitizer.scan_string`` before
# they're ever written, so trusting the file by name is safe here.
_TRUSTED_FILENAMES: frozenset[str] = frozenset(
    {
        "sw.js",
        "esbuild.config.mjs",
        # index.html ships a literal <script type="module"> tag and a
        # serviceWorker registration block from the base template. Both
        # would otherwise trip _DANGEROUS_RE.
        "index.html",
        # Tailwind/PostCSS configs may use require() — Node config files
        # we own and ship verbatim.
        "postcss.config.js",
        "tailwind.config.js",
        # package.json is JSON metadata, not executable. The substring
        # scan would happily flag fields like ``"description": "use fs"``
        # which is meaningless.
        "package.json",
    }
)

# Regexes that complement the substring list. Substring matching is fast but
# noisy ("fs" inside the literal "useffs" would false-positive). The list
# below uses word boundaries / context to keep precision high.
_DANGEROUS_RE: tuple[re.Pattern[str], ...] = (
    re.compile(r"\beval\s*\("),
    re.compile(r"\bnew\s+Function\s*\("),
    re.compile(r"\bdangerouslySetInnerHTML\b"),
    re.compile(r"\binnerHTML\s*="),
    re.compile(r"\bouterHTML\s*="),
    re.compile(r"\bdocument\.write\b"),
    re.compile(r"\bdocument\.cookie\b"),
    re.compile(r"\bwindow\.location\b"),
    re.compile(r"\blocation\.(?:href|replace|assign)\s*="),
    re.compile(r"\bimportScripts\s*\("),
    re.compile(r"\b__proto__\b"),
    re.compile(r"\bconstructor\s*\["),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"vbscript\s*:", re.IGNORECASE),
    re.compile(r"data:text/html", re.IGNORECASE),
    re.compile(r"<\s*script\b", re.IGNORECASE),
    # Node-only modules: only flag inside string literals so the word "fs"
    # in identifiers like ``useFsSnapshot`` doesn't trip the scan.
    re.compile(r"""['"]child_process['"]"""),
    re.compile(r"""(?<![A-Za-z0-9_])['"]fs['"](?![A-Za-z0-9_])"""),
    re.compile(r"""(?<![A-Za-z0-9_])['"]net['"](?![A-Za-z0-9_])"""),
    re.compile(r"""(?<![A-Za-z0-9_])['"]path['"](?![A-Za-z0-9_])"""),
    # T2.7: expanded patterns
    re.compile(r"""(?<![A-Za-z0-9_])['"]crypto['"](?![A-Za-z0-9_])"""),
    re.compile(r"""(?<![A-Za-z0-9_])['"]os['"](?![A-Za-z0-9_])"""),
    re.compile(r"\bfetch\s*\(\s*['\"]http:", re.IGNORECASE),  # non-HTTPS fetch
    re.compile(r"\bnew\s+Worker\s*\("),
    re.compile(r"\bnew\s+SharedWorker\s*\("),
    re.compile(r"\bnavigator\.serviceWorker\.register\s*\("),  # user code must not register its own SW
    re.compile(r"\bXMLHttpRequest\b"),
    re.compile(r"\bsendBeacon\s*\("),
    re.compile(r"\bSharedArrayBuffer\b"),
    re.compile(r"\bAtomics\b"),
    re.compile(r"\bWebSocket\s*\("),
    # API key / secret leak detection
    re.compile(r"""(?:sk_live_|pk_live_|sk_test_|pk_test_)[A-Za-z0-9]{20,}"""),
    re.compile(r"""(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}"""),  # AWS access key IDs
)

# Substring patterns from FORBIDDEN_PATTERNS that we deliberately *exclude*
# from the substring scan because they're handled more precisely above
# (avoiding false positives on identifiers like ``useFsSnapshot``).
_SUBSTRING_EXCLUSIONS: frozenset[str] = frozenset(
    {"fs", "net", "path", "constructor[", "top.", "parent."}
)


class ScanError(ValueError):
    """Raised when :func:`scan_project` finds a forbidden construct."""

    def __init__(self, findings: list[ScanFinding]):
        self.findings = findings
        first = findings[0]
        super().__init__(
            f"{len(findings)} forbidden pattern(s) found; first: "
            f"{first.path}:{first.line}: {first.pattern!r}"
        )


@dataclass(frozen=True, slots=True)
class ScanFinding:
    path: Path
    line: int
    pattern: str
    snippet: str


@dataclass(slots=True)
class ScanReport:
    files_scanned: int = 0
    findings: list[ScanFinding] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.findings


def scan_project(
    project_dir: Path,
    *,
    extensions: Iterable[str] | None = None,
    raise_on_finding: bool = True,
) -> ScanReport:
    """Recursively scan ``project_dir`` for forbidden patterns.

    Parameters
    ----------
    project_dir:
        Root of the generated React project (the directory that contains
        ``index.html``, ``src/`` etc.).
    extensions:
        Override the default set of scanned file extensions. Pass ``None``
        for the built-in default.
    raise_on_finding:
        If ``True`` (default) raise :class:`ScanError` when any finding is
        produced. If ``False`` the report is returned with ``ok=False`` and
        a populated ``findings`` list — useful for tests and dry runs.
    """
    project_dir = Path(project_dir)
    if not project_dir.is_dir():
        raise FileNotFoundError(f"project directory not found: {project_dir}")

    allowed_ext = frozenset(extensions) if extensions is not None else _SCANNED_EXTENSIONS
    report = ScanReport()
    substr_patterns = [
        p for p in FORBIDDEN_PATTERNS if p not in _SUBSTRING_EXCLUSIONS
    ]

    for path in sorted(project_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix not in allowed_ext:
            continue
        if path.name in _TRUSTED_FILENAMES:
            continue

        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            # Treat as a finding — anything we can't read is suspicious in a
            # generated project.
            report.findings.append(
                ScanFinding(
                    path=path.relative_to(project_dir),
                    line=0,
                    pattern="<unreadable>",
                    snippet="",
                )
            )
            continue

        report.files_scanned += 1
        rel = path.relative_to(project_dir)

        for lineno, line in enumerate(text.splitlines(), start=1):
            for needle in substr_patterns:
                if needle in line:
                    report.findings.append(
                        ScanFinding(
                            path=rel,
                            line=lineno,
                            pattern=needle,
                            snippet=line.strip()[:200],
                        )
                    )
            for regex in _DANGEROUS_RE:
                if regex.search(line):
                    report.findings.append(
                        ScanFinding(
                            path=rel,
                            line=lineno,
                            pattern=regex.pattern,
                            snippet=line.strip()[:200],
                        )
                    )

    # Convex tenant-isolation check is folded into the same pipeline so
    # callers don't need to remember a second scanner. Findings are surfaced
    # as ScanFindings with a synthetic pattern label, then the Convex error
    # is re-raised separately so downstream code can distinguish "forbidden
    # pattern" from "tenancy violation" if needed.
    convex_report = scan_convex_tenancy(project_dir, raise_on_finding=False)
    for cf in convex_report.findings:
        report.findings.append(
            ScanFinding(
                path=cf.path,
                line=cf.line,
                pattern=f"convex-tenancy: {cf.reason}",
                snippet=cf.snippet,
            )
        )

    if report.findings and raise_on_finding:
        if convex_report.findings and not report.findings[: -len(convex_report.findings)]:
            # Only Convex violations — preserve the dedicated error type so
            # callers can branch on isinstance.
            raise ConvexScanError(convex_report.findings)
        raise ScanError(report.findings)
    return report
