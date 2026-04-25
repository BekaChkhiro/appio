"""End-to-end smoke test for the AppSpec → CodeGenerator pipeline.

Sends a real prompt to Claude using the AppSpec JSON schema as the
``output_config.format``, validates the response with Pydantic, and
(optionally) runs the deterministic code generator on it.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    .venv/bin/python scripts/try_appspec.py "habit tracker for daily meditation"

Optional flags:
    --model claude-sonnet-4-6        # default
    --no-thinking                    # disable adaptive thinking
    --build /tmp/appio-smoke         # also run codegen and write the project
    --schema-only                    # print the schema and exit
    --max-tokens 8000

The script does NOT use ``messages.parse()`` — it sends the raw schema via
``output_config.format`` so ``pattern`` / ``const`` constraints reach Claude
intact (the SDK helper strips them).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Make the repo's Python packages importable without installing them.
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "python" / "shared" / "src"))
sys.path.insert(0, str(REPO_ROOT / "python" / "codegen" / "src"))

from anthropic import Anthropic  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from appio_codegen import (  # noqa: E402
    CodeGenerator,
    CodegenError,
    TemplateRegistry,
    UnsafeContentError,
)
from appio_shared.schemas import (  # noqa: E402
    SUPPORTED_TEMPLATES,
    AppSpec,
    app_spec_json_schema,
)


def build_system_prompt(templates_dir: Path) -> str:
    """Build a system prompt that lists every template's allowed components.

    This avoids the AutoFix-loop overhead caused by Claude inventing
    component names that don't exist in the chosen template's
    ``template.config.json``.
    """
    registry = TemplateRegistry(templates_dir)
    template_blocks: list[str] = []
    for tid in SUPPORTED_TEMPLATES:
        cfg = registry.get(tid)
        components = ", ".join(sorted(cfg.components))
        layouts = ", ".join(sorted(cfg.layouts))
        prop_lines = []
        for comp_name in sorted(cfg.components):
            schema = cfg.prop_schemas.get(comp_name)
            if schema:
                pieces = ", ".join(f"{k}:{v}" for k, v in schema.items())
                prop_lines.append(f"    {comp_name}({pieces})")
            else:
                prop_lines.append(f"    {comp_name}()")
        prop_block = "\n".join(prop_lines)
        template_blocks.append(
            f"### {tid} — {cfg.display_name}\n"
            f"{cfg.description}\n"
            f"Allowed component types: {components}\n"
            f"Allowed layouts: {layouts}\n"
            f"Component prop schemas:\n{prop_block}"
        )
    template_section = "\n\n".join(template_blocks)
    example_jsx = (
        '```jsx\n'
        '<div className="flex flex-col gap-2">\n'
        '  {[\n'
        '    { id: 1, title: "Buy groceries", done: false },\n'
        '    { id: 2, title: "Call Mom", done: true },\n'
        '    { id: 3, title: "Finish report", done: false },\n'
        '  ].map((t) => (\n'
        '    <div key={t.id} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">\n'
        '      <input type="checkbox" defaultChecked={t.done} '
        'className="w-5 h-5 accent-indigo-600" />\n'
        '      <span className={t.done ? "line-through text-gray-400" : "text-gray-900"}>'
        '{t.title}</span>\n'
        '    </div>\n'
        '  ))}\n'
        '</div>\n'
        '```'
    )
    return f"""\
You are Appio's app spec generator. Given a one-line user description, you
output a single JSON object that conforms exactly to the provided AppSpec
schema. The JSON is consumed by a deterministic code generator that turns
it into a React PWA, so structure matters more than prose.

# Templates

You MUST pick a template id from the enum and only use component types
listed under that template. Do not invent component names.

{template_section}

# Hard rules

1. `template` must be one of the enum values above.
2. `Component.type` must be in the chosen template's component list.
3. Every page route must be lowercase, start with `/`, and one page must
   use the root `/`. Routes must be unique.
4. Use `layout: "tabs"` on every page so a bottom tab bar is rendered.
5. `theme` colors must be `#RRGGBB` hex (e.g. `#10b981`).
6. At most 5 pages, at most 6 components per page.
7. Component `props` is a list of `{{key, type, value}}` objects, where
   `type` is one of `string | number | boolean | string_list` and `value`
   matches that type. Prop keys must be camelCase.
8. **Every component MUST include a `jsx` field** with a real, useful
   React JSX render body. Do NOT leave `jsx` empty or null. The body must:
   - Be a single root JSX element (wrap multiple children in a fragment).
   - Use Tailwind classes for styling. Available CSS variables map to
     classes like `bg-background`, `bg-surface`, `text-text-primary`,
     `text-text-secondary`, `text-primary`. Use neutral Tailwind colors
     (`bg-white`, `bg-gray-100`, `text-gray-900`) when in doubt.
   - Render meaningful, plausible static content (sample data is fine —
     hardcode an array of 3-5 example items inside the JSX).
   - May use `useState` for local interactivity (e.g. an Add button that
     pushes to a local list).
   - May reference `Stores` (a barrel re-export of every Zustand store
     in the template) but does not have to.
   - MUST NOT contain `<script>`, `eval(`, `new Function(`,
     `dangerouslySetInnerHTML`, `innerHTML`, `document.write`,
     `window.location`, or `javascript:`/`vbscript:`/`data:text/html`.
   - Should look like a finished mobile app screen, not a placeholder.
9. `dataModel` is a list of entities. Each entity has a camelCase `name`
   and a list of `{{name, type}}` fields. Field types: `string | number |
   boolean | date | json | string_list`.
10. App `name` must match `^[A-Za-z0-9][A-Za-z0-9 \\-_'!&]{{0,49}}$`.
11. Entity and prop key names must match `^[a-z][A-Za-z0-9]{{0,39}}$`.

# Example JSX body (TaskList for a todo app)

{example_jsx}

Respond with the JSON object only — no commentary, no markdown fences.
"""


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "prompt",
        nargs="?",
        default="A minimalist habit tracker for daily meditation with streaks",
        help="One-line user description of the app",
    )
    p.add_argument("--model", default="claude-sonnet-4-6")
    p.add_argument("--max-tokens", type=int, default=8000)
    p.add_argument(
        "--no-thinking",
        action="store_true",
        help="Disable adaptive thinking (faster, cheaper, lower quality)",
    )
    p.add_argument(
        "--build",
        type=Path,
        default=None,
        help="Run the code generator on the response and write to this directory",
    )
    p.add_argument(
        "--schema-only",
        action="store_true",
        help="Print the JSON schema we would send to Claude, then exit",
    )
    p.add_argument(
        "--save-spec",
        type=Path,
        default=None,
        help="Write the validated AppSpec JSON to this file",
    )
    return p


def main() -> int:
    args = build_arg_parser().parse_args()

    schema = app_spec_json_schema()

    if args.schema_only:
        print(json.dumps(schema, indent=2))
        return 0

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print(
            "ERROR: ANTHROPIC_API_KEY is not set. Run `export "
            "ANTHROPIC_API_KEY=sk-ant-...` first.",
            file=sys.stderr,
        )
        return 2

    client = Anthropic(api_key=api_key)

    system_prompt = build_system_prompt(REPO_ROOT / "packages" / "templates")
    request_kwargs: dict = {
        "model": args.model,
        "max_tokens": args.max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": args.prompt}],
        "output_config": {
            "format": {"type": "json_schema", "schema": schema},
        },
    }
    if not args.no_thinking:
        request_kwargs["thinking"] = {"type": "adaptive"}

    print(f"→ model={args.model}", file=sys.stderr)
    print(f"→ thinking={'adaptive' if not args.no_thinking else 'off'}", file=sys.stderr)
    print(f"→ prompt={args.prompt!r}", file=sys.stderr)
    print("→ calling Claude...", file=sys.stderr)

    try:
        response = client.messages.create(**request_kwargs)
    except Exception as e:  # noqa: BLE001
        print(f"\nAPI ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        return 3

    # Pull the JSON text out of the response (skip thinking blocks).
    text_block = next(
        (b for b in response.content if getattr(b, "type", None) == "text"), None
    )
    if text_block is None:
        print("ERROR: response contained no text block", file=sys.stderr)
        print(response.model_dump_json(indent=2)[:2000], file=sys.stderr)
        return 4

    raw_json = text_block.text
    print("\n=== Raw Claude JSON ===", file=sys.stderr)
    try:
        parsed = json.loads(raw_json)
        print(json.dumps(parsed, indent=2)[:4000])
    except json.JSONDecodeError:
        print(raw_json[:4000])
        print("\nERROR: response was not valid JSON", file=sys.stderr)
        return 5

    print("\n=== Pydantic validation ===", file=sys.stderr)
    try:
        spec = AppSpec.model_validate(parsed)
    except ValidationError as e:
        print(f"VALIDATION FAILED:\n{e}", file=sys.stderr)
        return 6

    print(
        f"OK: template={spec.template} name={spec.name!r} "
        f"pages={len(spec.pages)} components="
        f"{sum(len(p.components) for p in spec.pages)} "
        f"entities={len(spec.data_model)}",
        file=sys.stderr,
    )

    # Token / usage info
    usage = getattr(response, "usage", None)
    if usage is not None:
        print(
            f"→ usage: input={getattr(usage, 'input_tokens', '?')} "
            f"output={getattr(usage, 'output_tokens', '?')}",
            file=sys.stderr,
        )

    if args.save_spec:
        args.save_spec.write_text(
            json.dumps(spec.model_dump(by_alias=True), indent=2),
            encoding="utf-8",
        )
        print(f"→ saved spec to {args.save_spec}", file=sys.stderr)

    if args.build:
        print(f"\n=== Running CodeGenerator → {args.build} ===", file=sys.stderr)
        gen = CodeGenerator(REPO_ROOT / "packages" / "templates")
        try:
            out = gen.generate(spec, args.build)
        except (CodegenError, UnsafeContentError) as e:
            print(f"CODEGEN FAILED: {type(e).__name__}: {e}", file=sys.stderr)
            return 7
        print(f"OK: generated React project at {out}", file=sys.stderr)
        files = sorted(p.relative_to(out) for p in out.rglob("*") if p.is_file())
        print(f"→ {len(files)} files written", file=sys.stderr)
        for f in files[:30]:
            print(f"   {f}", file=sys.stderr)
        if len(files) > 30:
            print(f"   ... and {len(files) - 30} more", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
