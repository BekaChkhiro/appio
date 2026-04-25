# Prompt Engineering Test Suite (T3.4)

Automated end-to-end testing of the AI generation pipeline. Each test prompt is run through:

1. **Claude API** — generate a hybrid app spec from a natural language prompt
2. **JSON parse** — verify Claude returned valid JSON
3. **Pydantic validation** — validate the spec against `AppSpec` schema
4. **Code generation** — run `CodeGenerator` to produce a React project
5. **esbuild** — build with esbuild + Tailwind (local runner)
6. **Output validation** — check dist/ for required files and constraints
7. **Manifest validation** — verify manifest.json has required PWA fields
8. **Browser validation** (Playwright) — check HTML loads, no JS errors, not blank, mobile responsive

## Quick Start

```bash
# Full suite (requires ANTHROPIC_API_KEY + Node.js + Playwright)
ANTHROPIC_API_KEY=sk-... pytest tests/prompt_suite/ -v

# Single fixture
pytest tests/prompt_suite/ --prompt-id=todo-simple -v

# Skip esbuild (faster — tests Claude + codegen only)
pytest tests/prompt_suite/ --skip-esbuild -v

# Skip browser validation (no Playwright needed)
pytest tests/prompt_suite/ --skip-browser -v
```

## Results Dashboard

```bash
# View latest results
python -m tests.prompt_suite.report

# Compare latest with previous run
python -m tests.prompt_suite.report --compare
```

Results are saved as JSON in `tests/prompt_suite/results/`.

## Target

- **MVP**: 50% first-try success rate
- **Post-beta**: 70%+ first-try success rate

## Adding Test Prompts

Edit `fixtures.py` and add a new `PromptFixture`:

```python
PromptFixture(
    id="my-new-test",
    template="todo-list",
    prompt="Build a task manager with drag and drop",
    description="Tests complex interaction request",
    min_pages=1,
)
```

## CI

The suite runs automatically on changes to `packages/prompts/`, `packages/templates/`, or `python/codegen/`. See `.github/workflows/prompt-suite.yml`.
