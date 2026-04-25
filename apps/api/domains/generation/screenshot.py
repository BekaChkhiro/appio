"""Headless-Chromium screenshot service for vision feedback loop.

Serves the agent's ``workspace/dist/`` over a local HTTP server on a
random port, opens it in headless Chromium at iPhone 14 Pro Max
viewport, and returns PNG bytes for several states (light/dark, with
and without sample data).

The screenshots are then handed to the vision-critique service which
asks Claude to grade the UI and propose targeted fixes.

This module is intentionally synchronous — Playwright's sync API is
simpler and we wrap the whole thing in ``asyncio.to_thread`` from the
agent service.
"""

from __future__ import annotations

import contextlib
import http.server
import logging
import socket
import socketserver
import threading
from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import sync_playwright

log = logging.getLogger(__name__)

__all__ = ["ScreenshotError", "ScreenshotResult", "capture_app_screenshots"]

# iPhone 14 Pro Max viewport — matches our Screen component's max-w-[430px]
# clamp and gives the agent's mobile-first design room to breathe.
_VIEWPORT_W = 430
_VIEWPORT_H = 932
_DEVICE_SCALE = 2

# Sample tasks/items injected into localStorage so screenshots show a
# populated state instead of just the empty state. Generic enough that
# most apps (todo, notes, habit tracker, etc.) will pick them up.
_SEED_LOCALSTORAGE_JS = """
() => {
  const sampleTasks = [
    { id: '1', text: 'Buy groceries', done: false, completed: false, isDone: false, title: 'Buy groceries' },
    { id: '2', text: 'Walk the dog', done: false, completed: false, isDone: false, title: 'Walk the dog' },
    { id: '3', text: 'Read a chapter', done: true, completed: true, isDone: true, title: 'Read a chapter' },
  ];
  // Try common store key patterns. Apps usually use one of these.
  const candidateKeys = Object.keys(localStorage);
  for (const key of candidateKeys) {
    try {
      const val = JSON.parse(localStorage.getItem(key));
      if (val && typeof val === 'object') {
        // If the existing shape contains an array under common names, replace it
        for (const arrayKey of ['tasks', 'items', 'todos', 'notes', 'habits', 'list', 'state']) {
          if (Array.isArray(val[arrayKey])) {
            val[arrayKey] = sampleTasks;
            localStorage.setItem(key, JSON.stringify(val));
          }
        }
        // If the value itself is an array, overwrite it
        if (Array.isArray(val)) {
          localStorage.setItem(key, JSON.stringify(sampleTasks));
        }
      }
    } catch {}
  }
  // Also seed under generic keys in case the app reads from one
  // we haven't thought of yet.
  ['tasks', 'todos', 'items'].forEach((k) => {
    if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(sampleTasks));
  });
}
"""


class ScreenshotError(RuntimeError):
    """Raised when screenshot capture fails."""


@dataclass(frozen=True, slots=True)
class ScreenshotResult:
    """One labelled screenshot of the deployed app."""

    label: str
    png_bytes: bytes


def _find_free_port() -> int:
    """Bind a temporary socket to find a free TCP port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@contextlib.contextmanager
def _serve_directory(directory: Path):
    """Run an HTTP server serving ``directory`` on a random port.

    Yields the base URL (``http://127.0.0.1:PORT``). Stops the server
    when the context exits, regardless of success/failure.
    """
    if not directory.is_dir():
        raise ScreenshotError(f"directory not found: {directory}")

    port = _find_free_port()

    handler_cls = type(
        "QuietHandler",
        (http.server.SimpleHTTPRequestHandler,),
        {
            "log_message": lambda *args, **kwargs: None,  # silence stderr spam
        },
    )

    # SimpleHTTPRequestHandler serves from cwd; we override `directory`
    # via the constructor (Python 3.7+).
    def handler(*args, **kwargs):
        return handler_cls(*args, directory=str(directory), **kwargs)

    server = socketserver.TCPServer(("127.0.0.1", port), handler)
    server.allow_reuse_address = True

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def capture_app_screenshots(
    workspace: Path,
    *,
    timeout_seconds: float = 30.0,
) -> list[ScreenshotResult]:
    """Capture a labelled set of screenshots of the agent's built app.

    Captures four states:

    1. ``light-empty`` — initial light-mode load (empty/default state)
    2. ``light-data``  — light mode with seeded sample data
    3. ``dark-empty``  — dark mode toggled, empty/default state
    4. ``dark-data``   — dark mode with seeded sample data

    Returns a list of :class:`ScreenshotResult` in that order. Raises
    :class:`ScreenshotError` if the screenshot pipeline fails — the
    caller should treat that as "skip vision critique, deploy as-is."
    """
    dist = workspace / "dist"
    if not dist.is_dir():
        raise ScreenshotError(f"workspace has no dist/ — did the build run?")

    results: list[ScreenshotResult] = []

    with _serve_directory(dist) as base_url:
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                try:
                    context = browser.new_context(
                        viewport={"width": _VIEWPORT_W, "height": _VIEWPORT_H},
                        device_scale_factor=_DEVICE_SCALE,
                    )
                    page = context.new_page()
                    page.set_default_timeout(int(timeout_seconds * 1000))

                    # 1) Light mode, empty
                    page.goto(base_url, wait_until="networkidle")
                    page.wait_for_timeout(500)
                    results.append(
                        ScreenshotResult(
                            "light-empty",
                            page.screenshot(full_page=False),
                        )
                    )

                    # 2) Light mode, with sample data
                    # Seed localStorage then reload
                    page.evaluate(_SEED_LOCALSTORAGE_JS)
                    page.reload(wait_until="networkidle")
                    page.wait_for_timeout(500)
                    results.append(
                        ScreenshotResult(
                            "light-data",
                            page.screenshot(full_page=False),
                        )
                    )

                    # 3) Dark mode, with data — toggle by adding the
                    # `dark` class on <html>, which is what the
                    # ThemeProvider does. Persist via localStorage.
                    page.evaluate(
                        "() => { document.documentElement.classList.add('dark');"
                        " try { localStorage.setItem('theme', 'dark'); } catch {} }"
                    )
                    page.wait_for_timeout(400)
                    results.append(
                        ScreenshotResult(
                            "dark-data",
                            page.screenshot(full_page=False),
                        )
                    )

                    # 4) Dark mode, empty (clear localStorage and reload)
                    page.evaluate("() => { localStorage.clear(); localStorage.setItem('theme', 'dark'); }")
                    page.reload(wait_until="networkidle")
                    page.wait_for_timeout(500)
                    results.append(
                        ScreenshotResult(
                            "dark-empty",
                            page.screenshot(full_page=False),
                        )
                    )

                finally:
                    browser.close()
        except Exception as exc:
            raise ScreenshotError(f"playwright capture failed: {exc}") from exc

    return results
