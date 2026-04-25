"""Deterministic React project generator (T2.2).

Pipeline:
    1. Validate the :class:`AppSpec` against the loaded template config
       (component types whitelist, prop schemas, page/component caps).
    2. Run the JSX sanitiser on every component body.
    3. Materialise the project: copy ``base/`` skeleton, overlay the
       template's stores/styles, write generated ``App.tsx``, component
       files, ``index.html``, ``manifest.json``, and ``package.json``.

The result is a self-contained directory the builder worker can hand to
``esbuild + @tailwindcss/postcss`` without further preprocessing.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from appio_shared.schemas import (  # noqa: TC001
    AppSpec,
    BooleanProp,
    Component,
    NumberProp,
    StringListProp,
    StringProp,
)

from .renderer import (
    render_app_tsx,
    render_component_tsx,
    render_index_html,
    render_manifest_json,
    render_package_json,
)
from .sanitizer import UnsafeContentError, scan_jsx, scan_string
from .templates import TemplateConfig, TemplateRegistry

__all__ = ["CodeGenerator", "CodegenError", "UnsafeContentError"]


class CodegenError(ValueError):
    """Raised when an :class:`AppSpec` violates a template-specific constraint."""


class CodeGenerator:
    """Assembles a React project from a hybrid app spec and a template skeleton."""

    def __init__(self, templates_dir: Path):
        self.registry = TemplateRegistry(Path(templates_dir))

    # ------------------------------------------------------------------ public

    def generate(self, spec: AppSpec, output_dir: Path) -> Path:
        """Generate a complete React project at ``output_dir``.

        Returns the (resolved) output path. Existing contents at the target
        path are removed first — callers should pass a unique build directory.
        """
        template = self.registry.get(spec.template)

        self._validate_against_template(spec, template)
        self._sanitize(spec)

        output_dir = Path(output_dir).resolve()
        if output_dir.exists():
            shutil.rmtree(output_dir)
        output_dir.mkdir(parents=True)

        self._materialize(spec, template, output_dir)
        return output_dir

    # ------------------------------------------------------------------ validation

    @staticmethod
    def _validate_against_template(spec: AppSpec, template: TemplateConfig) -> None:
        if len(spec.pages) > template.max_pages:
            raise CodegenError(
                f"spec has {len(spec.pages)} pages, template "
                f"{template.id!r} allows at most {template.max_pages}"
            )

        for page in spec.pages:
            if page.layout not in template.layouts:
                raise CodegenError(
                    f"layout {page.layout!r} not allowed by template "
                    f"{template.id!r} (allowed: {sorted(template.layouts)})"
                )
            if len(page.components) > template.max_components_per_page:
                raise CodegenError(
                    f"page {page.route!r} has {len(page.components)} components, "
                    f"template {template.id!r} allows at most "
                    f"{template.max_components_per_page}"
                )
            for comp in page.components:
                if comp.type not in template.components:
                    raise CodegenError(
                        f"component type {comp.type!r} is not part of template "
                        f"{template.id!r}; allowed: {sorted(template.components)}"
                    )
                _check_component_props(comp, template)

    @staticmethod
    def _sanitize(spec: AppSpec) -> None:
        scan_string(spec.name, field="name")
        for page in spec.pages:
            if page.title:
                scan_string(page.title, field=f"page[{page.route}].title")
            for idx, comp in enumerate(page.components):
                jsx_field = f"page[{page.route}].components[{idx}].jsx"
                if comp.jsx is not None:
                    scan_jsx(comp.jsx, field=jsx_field)
                for prop in comp.props:
                    field_path = (
                        f"page[{page.route}].components[{idx}].props.{prop.key}"
                    )
                    if isinstance(prop, StringProp):
                        scan_string(prop.value, field=field_path)
                    elif isinstance(prop, StringListProp):
                        for j, item in enumerate(prop.value):
                            scan_string(item, field=f"{field_path}[{j}]")

    # ------------------------------------------------------------------ filesystem

    def _materialize(
        self,
        spec: AppSpec,
        template: TemplateConfig,
        output_dir: Path,
    ) -> None:
        base_dir = self.registry.base_dir()
        if not base_dir.is_dir():
            raise FileNotFoundError(f"base template missing: {base_dir}")

        is_convex = template.storage_backend == "convex"

        # 1. Copy base skeleton (index.html, sw.js, manifest.json, package.json,
        #    esbuild.config.mjs, src/index.tsx, src/styles/global.css,
        #    src/ConvexClientProvider.tsx, convex/_helpers.ts + _generated/,
        #    ...).
        _copy_tree(base_dir, output_dir)

        # 2. Overlay the template-specific src/ tree. For localStorage
        #    templates this is where Zustand stores land. We deliberately do
        #    NOT copy the template's App.tsx — the generator writes its own.
        #    For Convex templates we additionally skip src/stores/ since the
        #    generated components consume `api.*` directly; any residual
        #    store files would be dead code.
        template_src = template.template_dir / "src"
        if template_src.is_dir():
            skip_dirs = {"stores"} if is_convex else set()
            _copy_tree_with_dir_skip(
                template_src,
                output_dir / "src",
                skip_filenames={"App.tsx"},
                skip_dirnames=skip_dirs,
            )

        # 2b. Convex templates: overlay the template's convex/ over base's.
        #     The template ships schema.ts + per-table query/mutation files
        #     (notes.ts, habits.ts, etc.). Those REPLACE base's placeholder
        #     schema.ts and items.ts. _helpers.ts + auth.config.ts +
        #     _generated/ from base are preserved unless the template
        #     explicitly overrides them.
        if is_convex:
            template_convex = template.template_dir / "convex"
            if template_convex.is_dir():
                # Remove base's placeholder items.ts — replaced by the
                # template's own table files.
                (output_dir / "convex" / "items.ts").unlink(missing_ok=True)
                _copy_tree(template_convex, output_dir / "convex")

        # 3. Write generated files.
        index_html_path = output_dir / "index.html"
        manifest_path = output_dir / "manifest.json"
        package_path = output_dir / "package.json"
        app_tsx_path = output_dir / "src" / "App.tsx"
        components_dir = output_dir / "src" / "components"
        index_tsx_path = output_dir / "src" / "index.tsx"

        index_html_path.write_text(
            render_index_html(index_html_path.read_text(encoding="utf-8"), spec),
            encoding="utf-8",
        )
        manifest_path.write_text(
            render_manifest_json(manifest_path.read_text(encoding="utf-8"), spec),
            encoding="utf-8",
        )
        package_path.write_text(
            render_package_json(package_path.read_text(encoding="utf-8"), spec),
            encoding="utf-8",
        )

        components_dir.mkdir(parents=True, exist_ok=True)
        # Replace any .gitkeep so the directory carries real files only.
        (components_dir / ".gitkeep").unlink(missing_ok=True)

        instances_by_type: dict[str, list[Component]] = {}
        for page in spec.pages:
            for comp in page.components:
                instances_by_type.setdefault(comp.type, []).append(comp)
        for comp_type, instances in instances_by_type.items():
            (components_dir / f"{comp_type}.tsx").write_text(
                render_component_tsx(
                    comp_type, instances, storage_backend=template.storage_backend
                ),
                encoding="utf-8",
            )

        app_tsx_path.write_text(render_app_tsx(spec), encoding="utf-8")

        if is_convex:
            # Wrap <App/> in <ConvexClientProvider> so queries/mutations work.
            # Base's index.tsx renders <App/> bare; rewriting is safer than
            # trying to string-patch a user-editable file.
            index_tsx_path.write_text(_CONVEX_INDEX_TSX, encoding="utf-8")
        else:
            # localStorage templates: write Zustand stores barrel.
            stores_index_path = output_dir / "src" / "stores" / "index.ts"
            _write_stores_barrel(stores_index_path)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _check_component_props(comp: Component, template: TemplateConfig) -> None:
    schema = template.prop_schemas.get(comp.type)
    if schema is None:
        return  # No schema constraint for this component
    for prop in comp.props:
        expected = schema.get(prop.key)
        if expected is None:
            raise CodegenError(
                f"component {comp.type!r} has unknown prop {prop.key!r}; "
                f"allowed: {sorted(schema)}"
            )
        if not _prop_type_matches(prop, expected):
            raise CodegenError(
                f"component {comp.type!r} prop {prop.key!r} expected type "
                f"{expected!r}, got {type(prop).__name__}={prop.value!r}"
            )


def _prop_type_matches(prop: object, expected: str) -> bool:
    if expected == "string":
        return isinstance(prop, StringProp)
    if expected == "number":
        return isinstance(prop, NumberProp)
    if expected == "boolean":
        return isinstance(prop, BooleanProp)
    if expected in ("string[]", "string_list"):
        return isinstance(prop, StringListProp)
    # Unknown expected type — accept anything (template config error, not user
    # input error). Be permissive rather than failing the build.
    return True


def _copy_tree(
    src: Path,
    dst: Path,
    *,
    skip_filenames: set[str] | None = None,
) -> None:
    skip = skip_filenames or set()
    dst.mkdir(parents=True, exist_ok=True)
    for entry in src.iterdir():
        if entry.name in skip:
            continue
        target = dst / entry.name
        if entry.is_dir():
            _copy_tree(entry, target, skip_filenames=None)
        else:
            shutil.copy2(entry, target)


def _copy_tree_with_dir_skip(
    src: Path,
    dst: Path,
    *,
    skip_filenames: set[str] | None = None,
    skip_dirnames: set[str] | None = None,
) -> None:
    """Like :func:`_copy_tree` but can skip whole subdirectories by name.

    Used by the Convex path to skip ``src/stores/`` when overlaying a
    template's ``src/`` tree (Convex templates still carry Zustand stores as
    legacy shims until the registry migrates fully; skipping them keeps the
    generated app free of unused modules).
    """
    files_skip = skip_filenames or set()
    dirs_skip = skip_dirnames or set()
    dst.mkdir(parents=True, exist_ok=True)
    for entry in src.iterdir():
        if entry.is_dir() and entry.name in dirs_skip:
            continue
        if entry.name in files_skip:
            continue
        target = dst / entry.name
        if entry.is_dir():
            _copy_tree(entry, target, skip_filenames=None)
        else:
            shutil.copy2(entry, target)


# Replacement src/index.tsx for Convex templates — wraps <App/> in
# <ConvexClientProvider> so `useQuery` / `useMutation` resolve. The base
# template's own index.tsx renders <App/> bare (for localStorage apps); we
# overwrite it verbatim rather than text-patch to stay resilient to base
# template churn.
_CONVEX_INDEX_TSX = """\
// AUTO-GENERATED by appio_codegen — do not edit by hand.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexClientProvider>
      <App />
    </ConvexClientProvider>
  </React.StrictMode>
);
"""


def _write_stores_barrel(path: Path) -> None:
    """Generate a ``stores/index.ts`` that re-exports every store file in the
    directory. Component bodies use ``import * as Stores from '../stores'``
    so they can reach any hook the template provides without us having to
    know its exact name."""
    stores_dir = path.parent
    stores_dir.mkdir(parents=True, exist_ok=True)

    re_exports: list[str] = []
    for entry in sorted(stores_dir.iterdir()):
        if entry.suffix != ".ts" or entry.name == "index.ts":
            continue
        re_exports.append(f'export * from "./{entry.stem}";')

    content = "// AUTO-GENERATED by appio_codegen — do not edit by hand.\n"
    if re_exports:
        content += "\n".join(re_exports) + "\n"
    else:
        content += "export {};\n"
    path.write_text(content, encoding="utf-8")
