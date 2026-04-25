"""Convex multi-tenant isolation scanner.

See ``docs/adr/001-convex-tenant-isolation.md`` for the rules. In short:
every ``ctx.db.query("table")`` call inside a ``convex/`` directory MUST be
chained with ``.withIndex("by_tenant…", q => q.eq("tenantId", …))``. Use of
``.filter(`` on the same chain is rejected because Convex evaluates filters
*after* the index scan, so a missing index restriction silently scans other
tenants' rows.

The scanner is heuristic — it does not parse TypeScript. Instead it isolates
each ``ctx.db.query(`` "statement" by walking forward until it hits the
matching outer-level statement terminator (``;`` or end of statement at
brace-depth 0) and inspects that span for the required substrings. False
positives are preferred over false negatives: a generated app should always
be allowed to fail closed and rely on the agent's auto-fix loop to add the
missing index call.

Performance: O(file size). On a typical generated project (a handful of
small ``.ts`` files in ``convex/``) the cost is sub-millisecond.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

__all__ = [
    "ConvexScanError",
    "ConvexScanFinding",
    "ConvexScanReport",
    "scan_convex_tenancy",
]

# Match the entry point of every database query expression. We anchor on
# ``ctx.db.query("...")`` so we don't false-positive on `query(...)`
# declarations or unrelated `.query(` method calls. Whitespace and newlines
# are allowed between segments because chained Convex calls are commonly
# written one method per line.
_DB_QUERY_RE = re.compile(
    r"""\bctx\s*\.\s*db\s*\.\s*query\s*\(\s*['"][A-Za-z_][\w]*['"]\s*\)""",
    re.DOTALL,
)

# Required: ``.withIndex("by_tenant…")`` somewhere in the chain. The index
# name MUST start with the literal ``by_tenant``; a composite name like
# ``by_tenant_and_completed`` is fine.
_WITH_INDEX_TENANT_RE = re.compile(
    r"""\.withIndex\s*\(\s*['"]by_tenant[A-Za-z0-9_]*['"]""",
)

# Forbidden anywhere in the chain: ``.filter(`` is bypassable (no index
# enforcement) and tends to be reached for instead of designing a composite
# index. Reject it so the agent uses an index instead.
_FILTER_RE = re.compile(r"""\.filter\s*\(""")


class ConvexScanError(ValueError):
    """Raised when :func:`scan_convex_tenancy` finds an isolation violation."""

    def __init__(self, findings: list[ConvexScanFinding]):
        self.findings = findings
        first = findings[0]
        super().__init__(
            f"{len(findings)} Convex tenant-isolation violation(s); first: "
            f"{first.path}:{first.line}: {first.reason}"
        )


@dataclass(frozen=True, slots=True)
class ConvexScanFinding:
    path: Path
    line: int
    reason: str
    snippet: str


@dataclass(slots=True)
class ConvexScanReport:
    files_scanned: int = 0
    findings: list[ConvexScanFinding] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.findings


def _iter_convex_files(project_dir: Path) -> Iterable[Path]:
    """Yield every ``.ts`` (and ``.js``) file under any ``convex/`` directory.

    We deliberately ignore generated artefacts under ``convex/_generated/``
    and helper modules that start with an underscore (``_helpers.ts``,
    ``_utils.ts``) — those are infrastructure files we ship and audit by
    code review, not user code.
    """
    for path in project_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in {".ts", ".js"}:
            continue
        parts = path.relative_to(project_dir).parts
        if "convex" not in parts:
            continue
        # Skip generated code and our own helper modules.
        if "_generated" in parts:
            continue
        if path.name.startswith("_"):
            continue
        # auth.config.ts contains no ctx.db calls but lives outside the rule
        # set — skip explicitly to avoid surprises if it ever does.
        if path.name == "auth.config.ts":
            continue
        yield path


def _statement_span(text: str, start: int) -> tuple[str, int]:
    """Return the substring of ``text`` from ``start`` up to the end of the
    enclosing statement, plus the absolute end offset.

    "End of statement" is the first ``;`` encountered at parenthesis-depth 0
    *and* brace-depth 0, or end of text. Strings (single, double, backtick)
    are skipped so a ``;`` inside a string literal doesn't terminate early.
    """
    paren_depth = 0
    brace_depth = 0
    bracket_depth = 0
    i = start
    n = len(text)
    while i < n:
        ch = text[i]

        # Skip string literals — including template literals (backticks)
        # which can contain ${...} expressions; we approximate by ignoring
        # the inner braces, which is fine because we just want statement
        # boundaries, not full parsing.
        if ch in {'"', "'", "`"}:
            quote = ch
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == quote:
                    i += 1
                    break
                i += 1
            continue

        # Skip line and block comments.
        if ch == "/" and i + 1 < n:
            nxt = text[i + 1]
            if nxt == "/":
                i = text.find("\n", i)
                if i == -1:
                    return text[start:n], n
                continue
            if nxt == "*":
                end = text.find("*/", i + 2)
                if end == -1:
                    return text[start:n], n
                i = end + 2
                continue

        if ch == "(":
            paren_depth += 1
        elif ch == ")":
            paren_depth = max(paren_depth - 1, 0)
        elif ch == "{":
            brace_depth += 1
        elif ch == "}":
            # An unbalanced closing brace ends the statement (handler body
            # close). Treat it as a terminator.
            if brace_depth == 0 and paren_depth == 0 and bracket_depth == 0:
                return text[start:i], i
            brace_depth = max(brace_depth - 1, 0)
        elif ch == "[":
            bracket_depth += 1
        elif ch == "]":
            bracket_depth = max(bracket_depth - 1, 0)
        elif ch == ";" and paren_depth == 0 and brace_depth == 0 and bracket_depth == 0:
            return text[start:i], i

        i += 1
    return text[start:n], n


def scan_convex_tenancy(
    project_dir: Path,
    *,
    raise_on_finding: bool = True,
) -> ConvexScanReport:
    """Scan ``convex/`` source for tenant-isolation violations.

    Returns a :class:`ConvexScanReport`. If ``raise_on_finding`` is true and
    any violation is found, a :class:`ConvexScanError` is raised whose
    ``.findings`` attribute carries the same list. If the project contains
    no ``convex/`` directory, the report is trivially clean.
    """
    project_dir = Path(project_dir)
    if not project_dir.is_dir():
        raise FileNotFoundError(f"project directory not found: {project_dir}")

    report = ConvexScanReport()

    for path in sorted(_iter_convex_files(project_dir)):
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            report.findings.append(
                ConvexScanFinding(
                    path=path.relative_to(project_dir),
                    line=0,
                    reason="unreadable",
                    snippet="",
                )
            )
            continue

        report.files_scanned += 1
        rel = path.relative_to(project_dir)

        # Pre-compute line offsets so we can map a character index to a
        # line number cheaply.
        line_starts = [0]
        for idx, ch in enumerate(text):
            if ch == "\n":
                line_starts.append(idx + 1)

        def line_of(offset: int) -> int:
            # bisect_right returns the insertion point; subtracting 1 gives
            # the index of the line whose start <= offset, and lines are
            # 1-indexed.
            from bisect import bisect_right
            return bisect_right(line_starts, offset)

        for match in _DB_QUERY_RE.finditer(text):
            span_text, span_end = _statement_span(text, match.start())
            lineno = line_of(match.start())
            snippet = " ".join(span_text.split())[:200]

            if not _WITH_INDEX_TENANT_RE.search(span_text):
                report.findings.append(
                    ConvexScanFinding(
                        path=rel,
                        line=lineno,
                        reason='missing .withIndex("by_tenant…") on ctx.db.query()',
                        snippet=snippet,
                    )
                )
                continue

            if _FILTER_RE.search(span_text):
                report.findings.append(
                    ConvexScanFinding(
                        path=rel,
                        line=lineno,
                        reason=".filter() not allowed on tenant query — use a composite index",
                        snippet=snippet,
                    )
                )

    if report.findings and raise_on_finding:
        raise ConvexScanError(report.findings)
    return report
