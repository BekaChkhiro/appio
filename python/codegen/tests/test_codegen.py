"""End-to-end tests for the deterministic CodeGenerator (T2.2)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from appio_codegen import CodeGenerator, CodegenError, UnsafeContentError
from appio_shared.schemas import AppSpec

REPO_ROOT = Path(__file__).resolve().parents[3]
TEMPLATES_DIR = REPO_ROOT / "packages" / "templates"


def _theme() -> dict:
    return {
        "primary": "#10b981",
        "primaryLight": "#34d399",
        "background": "#f0fdf4",
        "surface": "#ffffff",
        "textPrimary": "#022c22",
        "textSecondary": "#6b7280",
    }


def _expense_spec() -> dict:
    """Convex-backed expense-tracker spec. JSX references `api.*` directly
    because the template's `constraints.storageBackend` is `"convex"` — see
    docs/adr/001-convex-tenant-isolation.md for the tenant pattern."""
    return {
        "template": "expense-tracker",
        "name": "My Budget",
        "theme": _theme(),
        "pages": [
            {
                "route": "/",
                "layout": "tabs",
                "title": "Home",
                "components": [
                    {
                        "type": "BalanceCard",
                        "props": [
                            {"key": "showTrend", "type": "boolean", "value": True}
                        ],
                    },
                    {
                        "type": "TransactionList",
                        "props": [
                            {"key": "groupBy", "type": "string", "value": "date"}
                        ],
                        "jsx": (
                            '<div className="space-y-2">'
                            "{(useQuery(api.transactions.listTransactions) ?? []).map(t => "
                            '<div key={t._id}>{t.description}</div>)}'
                            "</div>"
                        ),
                    },
                ],
            },
            {
                "route": "/stats",
                "layout": "tabs",
                "title": "Stats & Charts",  # contains '&' to test escape fix
                "components": [
                    {
                        "type": "MonthlySummary",
                        "props": [
                            {"key": "month", "type": "number", "value": 4},
                            {"key": "year", "type": "number", "value": 2026},
                        ],
                    }
                ],
            },
        ],
        "dataModel": [
            {
                "name": "transaction",
                "fields": [
                    {"name": "amount", "type": "number"},
                    {"name": "category", "type": "string"},
                ],
            }
        ],
    }


def _todo_spec() -> dict:
    """localStorage-backed todo-list spec. Kept as the reference fixture for
    the Zustand codegen path — the 4 feature templates are all Convex now,
    and the generator still has a non-Convex branch that we exercise here."""
    return {
        "template": "todo-list",
        "name": "My Tasks",
        "theme": {
            "primary": "#6366f1",
            "primaryLight": "#818cf8",
            "background": "#f8fafc",
            "surface": "#ffffff",
            "textPrimary": "#0f172a",
            "textSecondary": "#64748b",
        },
        "pages": [
            {
                "route": "/",
                "layout": "stack",
                "title": "Tasks",
                "components": [
                    {
                        "type": "TaskList",
                        "props": [
                            {"key": "showCompleted", "type": "boolean", "value": True}
                        ],
                        "jsx": (
                            '<div className="space-y-2">'
                            "{Stores.useTaskStore.getState().tasks.map(t => "
                            '<div key={t.id}>{t.title}</div>)}'
                            "</div>"
                        ),
                    },
                ],
            },
        ],
        "dataModel": [
            {
                "name": "task",
                "fields": [
                    {"name": "title", "type": "string"},
                    {"name": "completed", "type": "boolean"},
                ],
            }
        ],
    }


@pytest.fixture
def generator() -> CodeGenerator:
    return CodeGenerator(TEMPLATES_DIR)


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_generate_expense_tracker(generator: CodeGenerator, tmp_path: Path) -> None:
    """Convex template happy-path: expense-tracker materialises with Convex
    overlay + component files + wrapped index.tsx, and NO Zustand stores."""
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")

    # Files we expect from the base skeleton
    assert (out / "index.html").is_file()
    assert (out / "manifest.json").is_file()
    assert (out / "package.json").is_file()
    assert (out / "esbuild.config.mjs").is_file()
    assert (out / "sw.js").is_file()
    assert (out / "src" / "index.tsx").is_file()
    assert (out / "src" / "styles" / "global.css").is_file()
    # Base ships ConvexClientProvider; it must survive the overlay.
    assert (out / "src" / "ConvexClientProvider.tsx").is_file()

    # Convex overlay from the template — schema + domain file replace base's
    # placeholder items.ts. _helpers.ts + _generated/ flow through from base.
    assert (out / "convex" / "schema.ts").is_file()
    assert (out / "convex" / "transactions.ts").is_file()
    assert (out / "convex" / "_helpers.ts").is_file()
    assert (out / "convex" / "_generated" / "api.js").is_file()
    # Base's placeholder items.ts must NOT leak into a Convex template's output.
    assert not (out / "convex" / "items.ts").exists()

    # Files generated by codegen
    assert (out / "src" / "App.tsx").is_file()
    assert (out / "src" / "components" / "BalanceCard.tsx").is_file()
    assert (out / "src" / "components" / "TransactionList.tsx").is_file()
    assert (out / "src" / "components" / "MonthlySummary.tsx").is_file()

    # Zustand artefacts must be absent for Convex templates — components
    # reach data via `api.*`, not a stores barrel.
    assert not (out / "src" / "stores").exists(), (
        "Convex templates must not ship a src/stores/ tree"
    )


def test_index_html_has_theme_substitutions(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    html = (out / "index.html").read_text(encoding="utf-8")
    assert "{{PRIMARY_COLOR}}" not in html
    assert "{{APP_NAME}}" not in html
    assert "#10b981" in html
    assert "My Budget" in html
    # Install gate derives the app name from document.title, which is set
    # via the substituted <title> tag, so a stray {{APP_NAME_JSON}} would be
    # a regression.
    assert "{{APP_NAME_JSON}}" not in html
    assert "{{APP_INITIAL}}" not in html
    assert "<title>My Budget</title>" in html
    # ENTRY_JS / ENTRY_CSS placeholders MUST survive codegen — they're
    # filled in by the esbuild post-build step once hashed filenames exist.
    assert "{{ENTRY_JS}}" in html
    assert "{{ENTRY_CSS}}" in html


def test_manifest_json_is_filled(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    raw = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert raw["name"] == "My Budget"
    assert raw["theme_color"] == "#10b981"
    assert raw["background_color"] == "#f0fdf4"
    assert "{{APP_NAME}}" not in raw["name"]


def test_app_tsx_imports_components(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    app = (out / "src" / "App.tsx").read_text(encoding="utf-8")
    assert 'import BalanceCard from "./components/BalanceCard"' in app
    assert 'import TransactionList from "./components/TransactionList"' in app
    assert 'import MonthlySummary from "./components/MonthlySummary"' in app
    # Tabs nav present because layout is "tabs"
    assert "<nav" in app
    assert '"/stats"' in app


def test_app_tsx_does_not_html_escape_titles(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    """The title 'Stats & Charts' must NOT appear as 'Stats &amp; Charts'.

    JSX text content does not decode HTML entities — escaping it would render
    the entity literally to the user. Titles must be passed as JS string
    expressions instead.
    """
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    app = (out / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "&amp;" not in app, "renderer must not HTML-escape JSX text content"
    # The title should appear as a JS string literal inside JSX braces.
    assert '"Stats & Charts"' in app


def test_component_with_jsx_uses_provided_body(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    """Convex component: AI-supplied JSX referencing `api.*` + `useQuery`
    must round-trip verbatim into the generated component file."""
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    src = (out / "src" / "components" / "TransactionList.tsx").read_text(
        encoding="utf-8"
    )
    assert "useQuery(api.transactions.listTransactions)" in src
    assert "@ts-nocheck" in src  # AI-supplied JSX bypasses TS strict checks
    # Convex header must wire api / hook imports. Components reach data via
    # the typed function refs, not through a Zustand barrel.
    assert 'import { api } from "../../convex/_generated/api"' in src
    assert 'import { useQuery, useMutation } from "convex/react"' in src
    assert 'import * as Stores' not in src


def test_component_without_jsx_gets_stub(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    src = (out / "src" / "components" / "BalanceCard.tsx").read_text(
        encoding="utf-8"
    )
    assert "Placeholder for BalanceCard" in src


def test_component_props_rendered_as_object(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    """The PropEntry list must be reduced back to a JS object literal."""
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    src = (out / "src" / "components" / "MonthlySummary.tsx").read_text(
        encoding="utf-8"
    )
    assert '"month": 4' in src
    assert '"year": 2026' in src


def test_convex_index_tsx_wraps_with_provider(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    """`src/index.tsx` must mount `<App/>` inside `<ConvexClientProvider>` so
    `useQuery` / `useMutation` have a ConvexProvider ancestor. Without this,
    every component would throw at render time."""
    spec = AppSpec.model_validate(_expense_spec())
    out = generator.generate(spec, tmp_path / "build")
    index_tsx = (out / "src" / "index.tsx").read_text(encoding="utf-8")
    assert "ConvexClientProvider" in index_tsx
    assert "<App />" in index_tsx
    # The bare-App bootstrap from the base template must have been replaced,
    # not preserved alongside — otherwise the app would mount twice. The
    # `createRoot` symbol appears once in the import and once in the call,
    # so the invocation itself (`createRoot(...).render(`) is the better
    # canary.
    assert index_tsx.count("createRoot(document.getElementById") == 1


def test_generate_overwrites_existing_output(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    target = tmp_path / "build"
    target.mkdir()
    (target / "old.txt").write_text("stale")
    spec = AppSpec.model_validate(_expense_spec())
    generator.generate(spec, target)
    assert not (target / "old.txt").exists()
    assert (target / "src" / "App.tsx").is_file()


# ---------------------------------------------------------------------------
# localStorage (Zustand) path — todo-list is the remaining non-Convex template
# ---------------------------------------------------------------------------


def test_generate_todo_list_uses_zustand_stores(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    """localStorage templates keep the legacy stores pipeline intact:
    `src/stores/` is copied over + a barrel re-exports each store."""
    spec = AppSpec.model_validate(_todo_spec())
    out = generator.generate(spec, tmp_path / "build")

    # Base skeleton
    assert (out / "index.html").is_file()
    assert (out / "src" / "App.tsx").is_file()

    # Zustand stores + barrel present
    assert (out / "src" / "stores" / "taskStore.ts").is_file()
    barrel = (out / "src" / "stores" / "index.ts").read_text(encoding="utf-8")
    assert 'export * from "./taskStore"' in barrel

    # Convex overlay MUST NOT fire for a localStorage template — the
    # template has no convex/ dir, so base's placeholder items.ts is what
    # lives in the output.
    assert (out / "convex" / "items.ts").is_file()


def test_todo_list_component_imports_stores(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    """localStorage component header must wire `import * as Stores` so
    AI-supplied JSX can reach `Stores.useTaskStore`."""
    spec = AppSpec.model_validate(_todo_spec())
    out = generator.generate(spec, tmp_path / "build")
    src = (out / "src" / "components" / "TaskList.tsx").read_text(encoding="utf-8")
    assert 'import * as Stores from "../stores"' in src
    assert "useTaskStore" in src
    # Convex header must not leak into a localStorage build — otherwise
    # esbuild would hit an unresolved `../../convex/_generated/api` import.
    assert 'import { api } from "../../convex/_generated/api"' not in src


def test_todo_list_index_tsx_is_bare(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    """localStorage templates leave base's bare `<App/>` bootstrap alone —
    they don't need ConvexClientProvider."""
    spec = AppSpec.model_validate(_todo_spec())
    out = generator.generate(spec, tmp_path / "build")
    index_tsx = (out / "src" / "index.tsx").read_text(encoding="utf-8")
    assert "ConvexClientProvider" not in index_tsx
    assert "<App />" in index_tsx


# ---------------------------------------------------------------------------
# Validation failures
# ---------------------------------------------------------------------------


def test_rejects_component_not_in_template(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    bad = _expense_spec()
    bad["pages"][0]["components"][0]["type"] = "NotARealComponent"
    spec = AppSpec.model_validate(bad)
    with pytest.raises(CodegenError, match="not part of template"):
        generator.generate(spec, tmp_path / "build")


def test_rejects_unsafe_jsx(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    bad = _expense_spec()
    bad["pages"][0]["components"][1]["jsx"] = (
        '<div dangerouslySetInnerHTML={{__html: "<script>alert(1)</script>"}} />'
    )
    spec = AppSpec.model_validate(bad)
    with pytest.raises(UnsafeContentError):
        generator.generate(spec, tmp_path / "build")


def test_rejects_unknown_prop(generator: CodeGenerator, tmp_path: Path) -> None:
    bad = _expense_spec()
    bad["pages"][0]["components"][0]["props"] = [
        {"key": "bogus", "type": "string", "value": "x"}
    ]
    spec = AppSpec.model_validate(bad)
    with pytest.raises(CodegenError, match="unknown prop"):
        generator.generate(spec, tmp_path / "build")


def test_rejects_wrong_prop_type(
    generator: CodeGenerator, tmp_path: Path
) -> None:
    bad = _expense_spec()
    # MonthlySummary.month should be number, not string
    bad["pages"][1]["components"][0]["props"] = [
        {"key": "month", "type": "string", "value": "April"},
        {"key": "year", "type": "number", "value": 2026},
    ]
    spec = AppSpec.model_validate(bad)
    with pytest.raises(CodegenError, match="expected type"):
        generator.generate(spec, tmp_path / "build")
