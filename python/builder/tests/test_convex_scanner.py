"""Tests for the Convex tenant-isolation scanner."""

from __future__ import annotations

from pathlib import Path

import pytest

from appio_builder.convex_scanner import (
    ConvexScanError,
    scan_convex_tenancy,
)
from appio_builder.scanner import ScanError, scan_project


def _write(root: Path, rel: str, content: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Direct convex_scanner tests
# ---------------------------------------------------------------------------


def test_no_convex_dir_passes(tmp_path: Path) -> None:
    """Apps without a convex/ directory are trivially clean."""
    _write(tmp_path, "src/App.tsx", "export default () => <div/>;")
    report = scan_convex_tenancy(tmp_path)
    assert report.ok
    assert report.files_scanned == 0


def test_clean_tenant_query_passes(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "convex/items.ts",
        """
        import { tenantQuery } from "./_helpers";
        export const list = tenantQuery({
          handler: async (ctx) =>
            ctx.db
              .query("items")
              .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
              .collect(),
        });
        """,
    )
    report = scan_convex_tenancy(tmp_path)
    assert report.ok
    assert report.files_scanned == 1


def test_composite_by_tenant_index_passes(tmp_path: Path) -> None:
    """Index names that start with by_tenant_ are also accepted."""
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const open = tenantQuery({
          handler: async (ctx) =>
            ctx.db
              .query("items")
              .withIndex("by_tenant_and_completed", (q) =>
                q.eq("tenantId", ctx.tenantId).eq("completed", false))
              .collect(),
        });
        """,
    )
    report = scan_convex_tenancy(tmp_path)
    assert report.ok


def test_missing_with_index_rejected(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const list = tenantQuery({
          handler: async (ctx) => ctx.db.query("items").collect(),
        });
        """,
    )
    with pytest.raises(ConvexScanError) as exc:
        scan_convex_tenancy(tmp_path)
    assert "missing" in str(exc.value).lower()


def test_wrong_index_name_rejected(tmp_path: Path) -> None:
    """An index that doesn't start with by_tenant is treated as missing."""
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const list = tenantQuery({
          handler: async (ctx) =>
            ctx.db
              .query("items")
              .withIndex("by_user", (q) => q.eq("userId", ctx.tenantId))
              .collect(),
        });
        """,
    )
    with pytest.raises(ConvexScanError):
        scan_convex_tenancy(tmp_path)


def test_filter_on_tenant_query_rejected(tmp_path: Path) -> None:
    """Even with a tenant index, .filter() in the chain is rejected."""
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const list = tenantQuery({
          handler: async (ctx) =>
            ctx.db
              .query("items")
              .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
              .filter((q) => q.eq(q.field("completed"), false))
              .collect(),
        });
        """,
    )
    with pytest.raises(ConvexScanError) as exc:
        scan_convex_tenancy(tmp_path)
    assert ".filter" in str(exc.value)


def test_db_get_by_id_allowed(tmp_path: Path) -> None:
    """ctx.db.get(id) is opaque-id lookup, not tenant-scoped query."""
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const fetch = tenantMutation({
          handler: async (ctx, { id }) => {
            const item = await ctx.db.get(id);
            return item;
          },
        });
        """,
    )
    report = scan_convex_tenancy(tmp_path)
    assert report.ok


def test_underscore_helpers_skipped(tmp_path: Path) -> None:
    """convex/_helpers.ts is infrastructure we audit by code review."""
    _write(
        tmp_path,
        "convex/_helpers.ts",
        # Contains a bare ctx.db.query in some contrived snippet — would be
        # rejected if scanned, but helpers are deliberately skipped.
        'export const x = (ctx) => ctx.db.query("anything").collect();',
    )
    report = scan_convex_tenancy(tmp_path)
    assert report.ok
    assert report.files_scanned == 0


def test_generated_dir_skipped(tmp_path: Path) -> None:
    """convex/_generated/* is Convex-emitted, not user code."""
    _write(
        tmp_path,
        "convex/_generated/server.ts",
        'export const q = (ctx) => ctx.db.query("items").collect();',
    )
    report = scan_convex_tenancy(tmp_path)
    assert report.ok
    assert report.files_scanned == 0


def test_non_convex_files_ignored(tmp_path: Path) -> None:
    """A bare ctx.db.query in src/ is irrelevant — that's frontend code."""
    _write(
        tmp_path,
        "src/App.tsx",
        'const fake = (ctx) => ctx.db.query("items").collect();',
    )
    _write(tmp_path, "convex/.gitkeep", "")
    report = scan_convex_tenancy(tmp_path)
    assert report.ok
    assert report.files_scanned == 0


def test_multiple_violations_collected(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const a = tenantQuery({
          handler: async (ctx) => ctx.db.query("items").collect(),
        });
        export const b = tenantQuery({
          handler: async (ctx) => ctx.db.query("notes").collect(),
        });
        """,
    )
    report = scan_convex_tenancy(tmp_path, raise_on_finding=False)
    assert not report.ok
    assert len(report.findings) == 2


def test_string_with_semicolon_does_not_terminate_early(tmp_path: Path) -> None:
    """A `;` inside a string literal must not split the statement span."""
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const list = tenantQuery({
          handler: async (ctx) => {
            const note = "note;with;semicolons";
            return ctx.db
              .query("items")
              .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
              .collect();
          },
        });
        """,
    )
    report = scan_convex_tenancy(tmp_path)
    assert report.ok


# ---------------------------------------------------------------------------
# Integration: scan_project() folds Convex findings into its report
# ---------------------------------------------------------------------------


def test_scan_project_raises_convex_error_for_tenancy_violation(
    tmp_path: Path,
) -> None:
    """When ONLY Convex violations exist, scan_project raises ConvexScanError
    so callers can distinguish it from generic forbidden patterns."""
    _write(tmp_path, "src/App.tsx", "export default () => <div/>;")
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const list = tenantQuery({
          handler: async (ctx) => ctx.db.query("items").collect(),
        });
        """,
    )
    with pytest.raises(ConvexScanError):
        scan_project(tmp_path)


def test_scan_project_raises_scan_error_when_mixed_findings(
    tmp_path: Path,
) -> None:
    """If there is BOTH a forbidden pattern AND a Convex violation, the
    generic ScanError wins so the report shows everything in one place."""
    _write(tmp_path, "src/App.tsx", "const x = eval('1+1');")
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const list = tenantQuery({
          handler: async (ctx) => ctx.db.query("items").collect(),
        });
        """,
    )
    with pytest.raises(ScanError) as exc:
        scan_project(tmp_path)
    # Both kinds of finding are present in the aggregated report.
    findings = exc.value.findings
    assert any("eval" in f.pattern for f in findings)
    assert any("convex-tenancy" in f.pattern for f in findings)


def test_scan_project_passes_clean_convex_app(tmp_path: Path) -> None:
    _write(tmp_path, "src/App.tsx", "export default () => <div/>;")
    _write(
        tmp_path,
        "convex/items.ts",
        """
        export const list = tenantQuery({
          handler: async (ctx) =>
            ctx.db
              .query("items")
              .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
              .collect(),
        });
        """,
    )
    report = scan_project(tmp_path)
    assert report.ok
