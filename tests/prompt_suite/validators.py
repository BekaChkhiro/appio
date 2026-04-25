"""Playwright-based validators for built PWA output (T3.4).

These validators load the built ``dist/index.html`` in a real browser
and check that the page renders correctly:

- No JavaScript console errors
- Page is not blank (has visible DOM content)
- manifest.json is valid and well-formed
- Viewport is mobile-responsive (375px width)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

__all__ = [
    "BrowserValidationResult",
    "validate_manifest",
    "validate_with_browser",
]


@dataclass
class BrowserValidationResult:
    """Result of browser-based validation."""

    html_loads: bool
    no_js_errors: bool
    not_blank: bool
    mobile_responsive: bool
    js_errors: list[str]
    visible_text_length: int
    error: str | None = None

    @property
    def passed(self) -> bool:
        return (
            self.html_loads
            and self.no_js_errors
            and self.not_blank
            and self.mobile_responsive
        )


def validate_manifest(dist_dir: Path) -> tuple[bool, str | None]:
    """Validate that manifest.json exists and has required PWA fields.

    Returns (passed, error_message).
    """
    manifest_path = dist_dir / "manifest.json"
    if not manifest_path.is_file():
        return False, "manifest.json not found in dist/"

    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return False, f"manifest.json is not valid JSON: {exc}"

    required_fields = ["name", "short_name", "start_url", "display", "icons"]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return False, f"manifest.json missing required fields: {missing}"

    if not isinstance(data.get("icons"), list) or len(data["icons"]) == 0:
        return False, "manifest.json has no icons"

    if data.get("display") not in ("standalone", "fullscreen", "minimal-ui"):
        return False, f"manifest.json display must be standalone/fullscreen/minimal-ui, got {data.get('display')!r}"

    return True, None


def validate_with_browser(dist_dir: Path) -> BrowserValidationResult:
    """Load the built PWA in Playwright and validate it renders correctly.

    Requires ``playwright`` to be installed. If Playwright is not
    available, returns a result with ``error`` set and all checks False.
    """
    index_path = dist_dir / "index.html"
    if not index_path.is_file():
        return BrowserValidationResult(
            html_loads=False,
            no_js_errors=False,
            not_blank=False,
            mobile_responsive=False,
            js_errors=[],
            visible_text_length=0,
            error="index.html not found in dist/",
        )

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return BrowserValidationResult(
            html_loads=False,
            no_js_errors=False,
            not_blank=False,
            mobile_responsive=False,
            js_errors=[],
            visible_text_length=0,
            error="playwright not installed — run: pip install playwright && playwright install chromium",
        )

    js_errors: list[str] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # ── Mobile viewport (iPhone SE width) ──────────────────────
            context = browser.new_context(
                viewport={"width": 375, "height": 667},
                device_scale_factor=2,
            )
            page = context.new_page()

            # Collect JS errors
            page.on("pageerror", lambda exc: js_errors.append(str(exc)))

            # Load the page from local file
            file_url = f"file://{index_path.resolve()}"
            response = page.goto(file_url, wait_until="networkidle", timeout=15000)

            html_loads = response is not None and response.ok

            # Wait a moment for React to hydrate
            page.wait_for_timeout(2000)

            # Check if page has visible content
            visible_text = page.evaluate(
                "() => document.body ? document.body.innerText.trim() : ''"
            )
            visible_text_length = len(visible_text)
            not_blank = visible_text_length > 10

            # Check that the body has rendered children (not just empty divs)
            has_content = page.evaluate(
                "() => {"
                "  const root = document.getElementById('root') || document.body;"
                "  return root.children.length > 0 && root.innerHTML.length > 50;"
                "}"
            )
            not_blank = not_blank or has_content

            # Check mobile responsiveness: no horizontal overflow
            mobile_responsive = page.evaluate(
                "() => document.documentElement.scrollWidth <= 375"
            )

            browser.close()

            return BrowserValidationResult(
                html_loads=html_loads,
                no_js_errors=len(js_errors) == 0,
                not_blank=not_blank,
                mobile_responsive=mobile_responsive,
                js_errors=js_errors[:10],  # Cap at 10
                visible_text_length=visible_text_length,
            )

    except Exception as exc:
        return BrowserValidationResult(
            html_loads=False,
            no_js_errors=False,
            not_blank=False,
            mobile_responsive=False,
            js_errors=js_errors[:10],
            visible_text_length=0,
            error=f"Playwright error: {exc}",
        )
