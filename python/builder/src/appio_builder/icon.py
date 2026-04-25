"""Auto-generate a PWA app icon.

The spec calls for a "theme color + app initial" icon. We render it as an
SVG (no Pillow / no native deps) at the two manifest sizes Chrome and
Safari look for. SVG is fine for ``manifest.json`` icons in modern browsers,
and Cloudflare serves it with the right ``image/svg+xml`` content type.

Why not PNG?

- Pillow + libpng pulls in ~50MB of system libraries the builder image
  would otherwise not need.
- Modern PWA install dialogs (Chrome 93+, Safari 16+) accept SVG icons.
- The builder pipeline target is < 500ms — we shouldn't burn time
  rasterising on every build.
"""

from __future__ import annotations

import re

__all__ = ["generate_icon_svg", "icon_filename"]


_NON_LETTER = re.compile(r"[^A-Za-z0-9]")


def _initial(app_name: str) -> str:
    """Return a single-character initial in upper-case for ``app_name``.

    Falls back to ``"A"`` for empty / non-alphanumeric names.
    """
    cleaned = _NON_LETTER.sub("", app_name)
    if not cleaned:
        return "A"
    return cleaned[0].upper()


def _readable_text_color(hex_color: str) -> str:
    """Pick black or white text based on the perceived luminance of ``hex_color``.

    ``hex_color`` must be a 6-digit hex string with leading ``#``. Anything
    else falls back to white text — the AppSpec validator already enforces
    the format upstream so this is just defensive programming.
    """
    if len(hex_color) != 7 or not hex_color.startswith("#"):
        return "#FFFFFF"
    try:
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
    except ValueError:
        return "#FFFFFF"
    # Rec.601 luminance — good enough for "is this dark or light".
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#000000" if luminance > 0.6 else "#FFFFFF"


def generate_icon_svg(app_name: str, theme_color: str, size: int = 512) -> str:
    """Return an SVG document string for the given app.

    The SVG is a rounded square in ``theme_color`` with the app's initial
    centered in a contrasting colour. The font-size is hard-coded as a
    fraction of the canvas so it scales correctly when re-rasterised by
    the browser.
    """
    if size <= 0:
        raise ValueError(f"icon size must be positive, got {size}")
    initial = _initial(app_name)
    text_color = _readable_text_color(theme_color)
    radius = size // 8  # ~12.5% corner radius — matches Material/iOS feel
    font_size = int(size * 0.55)
    cx = size // 2
    cy = size // 2

    # XML-escape the initial defensively even though it's always [A-Z0-9].
    safe_initial = (
        initial.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {size} {size}" width="{size}" height="{size}">'
        f'<rect width="{size}" height="{size}" rx="{radius}" ry="{radius}" '
        f'fill="{theme_color}"/>'
        f'<text x="{cx}" y="{cy}" font-family="-apple-system,BlinkMacSystemFont,'
        f'\'Segoe UI\',Roboto,sans-serif" font-size="{font_size}" '
        f'font-weight="700" fill="{text_color}" text-anchor="middle" '
        f'dominant-baseline="central">{safe_initial}</text>'
        f"</svg>"
    )


def icon_filename(size: int) -> str:
    """Filename convention used by ``manifest.json`` and ``index.html``."""
    return f"icon-{size}.svg"
