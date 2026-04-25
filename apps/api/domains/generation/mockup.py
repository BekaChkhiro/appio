"""App Store-style mockup compositor.

Takes raw Playwright screenshots (iPhone 14 Pro Max viewport, 2×) and
composites them into device-framed PNGs suitable for template cards,
the landing page hero, and downloadable marketing assets.

Outputs:
- Individual framed screenshots (one per label)
- A composite "hero" image with 3 phones side-by-side

Uses Pillow. This is the first Pillow consumer in the project — icon.py
deliberately avoided it, but mockups need real raster compositing.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter

from .screenshot import ScreenshotResult

log = logging.getLogger(__name__)

__all__ = ["MockupError", "MockupResult", "compose_mockups"]

# ── Device frame dimensions ──────────────────────────────────────────
# The raw screenshot is 430×932 @ 2× = 860×1864 pixels.
# We draw a minimal iPhone frame around it.

_SCREEN_W = 860
_SCREEN_H = 1864

# Frame padding around the screen (in pixels at 2×)
_BEZEL_TOP = 80       # top bezel (status bar area + dynamic island)
_BEZEL_BOTTOM = 60    # bottom bezel (home indicator area)
_BEZEL_SIDE = 28      # left/right bezels
_CORNER_RADIUS = 90   # device corner radius (outer)
_SCREEN_RADIUS = 70   # screen corner radius (inner)

# Full device dimensions
_DEVICE_W = _SCREEN_W + 2 * _BEZEL_SIDE
_DEVICE_H = _SCREEN_H + _BEZEL_TOP + _BEZEL_BOTTOM

# Dynamic Island
_ISLAND_W = 248
_ISLAND_H = 72
_ISLAND_RADIUS = 36

# Shadow
_SHADOW_OFFSET = 24
_SHADOW_BLUR = 40
_SHADOW_COLOR = (0, 0, 0, 50)

# Composite hero: 3 phones with spacing
_HERO_PHONE_SCALE = 0.42  # scale each phone to ~42% for a wide composite
_HERO_SPACING = 60         # px between phones at final size
_HERO_PADDING = 80         # canvas padding


class MockupError(RuntimeError):
    """Raised when mockup compositing fails."""


@dataclass(frozen=True, slots=True)
class MockupResult:
    """One composited mockup image."""

    label: str
    png_bytes: bytes
    width: int
    height: int


def _round_corners(img: Image.Image, radius: int) -> Image.Image:
    """Apply rounded corners to an RGBA image using an alpha mask."""
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        [(0, 0), (img.width - 1, img.height - 1)],
        radius=radius,
        fill=255,
    )
    result = img.copy()
    result.putalpha(mask)
    return result


def _draw_device_frame(screenshot_bytes: bytes, *, dark_frame: bool = False) -> Image.Image:
    """Draw an iPhone frame around a raw screenshot.

    Args:
        screenshot_bytes: Raw PNG bytes from Playwright (860×1864).
        dark_frame: If True, use a dark (space black) frame colour.
                    If False, use a light (silver/titanium) frame.

    Returns:
        RGBA Image of the framed device with transparent background.
    """
    # Load screenshot
    screen = Image.open(io.BytesIO(screenshot_bytes)).convert("RGBA")
    if screen.size != (_SCREEN_W, _SCREEN_H):
        screen = screen.resize((_SCREEN_W, _SCREEN_H), Image.LANCZOS)

    # Round the screen corners
    screen = _round_corners(screen, _SCREEN_RADIUS)

    # Create device canvas (transparent)
    canvas = Image.new("RGBA", (_DEVICE_W, _DEVICE_H), (0, 0, 0, 0))

    # Draw device body (rounded rectangle)
    frame_color = (30, 30, 32, 255) if dark_frame else (210, 210, 215, 255)
    body = Image.new("RGBA", (_DEVICE_W, _DEVICE_H), (0, 0, 0, 0))
    body_draw = ImageDraw.Draw(body)
    body_draw.rounded_rectangle(
        [(0, 0), (_DEVICE_W - 1, _DEVICE_H - 1)],
        radius=_CORNER_RADIUS,
        fill=frame_color,
    )

    # Draw a subtle inner border for depth
    border_color = (255, 255, 255, 30) if dark_frame else (0, 0, 0, 20)
    body_draw.rounded_rectangle(
        [(2, 2), (_DEVICE_W - 3, _DEVICE_H - 3)],
        radius=_CORNER_RADIUS - 2,
        outline=border_color,
        width=2,
    )

    canvas = Image.alpha_composite(canvas, body)

    # Paste screen into frame
    screen_x = _BEZEL_SIDE
    screen_y = _BEZEL_TOP
    canvas.paste(screen, (screen_x, screen_y), screen)

    # Draw Dynamic Island
    island_x = (_DEVICE_W - _ISLAND_W) // 2
    island_y = _BEZEL_TOP - _ISLAND_H + 16  # partially overlaps screen top
    island = Image.new("RGBA", (_DEVICE_W, _DEVICE_H), (0, 0, 0, 0))
    island_draw = ImageDraw.Draw(island)
    island_draw.rounded_rectangle(
        [(island_x, island_y), (island_x + _ISLAND_W, island_y + _ISLAND_H)],
        radius=_ISLAND_RADIUS,
        fill=(0, 0, 0, 255),
    )
    canvas = Image.alpha_composite(canvas, island)

    # Draw home indicator bar at bottom
    indicator_w = 280
    indicator_h = 10
    indicator_x = (_DEVICE_W - indicator_w) // 2
    indicator_y = _DEVICE_H - _BEZEL_BOTTOM + 20
    indicator_color = (255, 255, 255, 80) if dark_frame else (0, 0, 0, 60)
    ind_draw = ImageDraw.Draw(canvas)
    ind_draw.rounded_rectangle(
        [(indicator_x, indicator_y), (indicator_x + indicator_w, indicator_y + indicator_h)],
        radius=indicator_h // 2,
        fill=indicator_color,
    )

    return canvas


def _add_shadow(device: Image.Image) -> Image.Image:
    """Add a soft drop shadow behind the device image."""
    # Expand canvas for shadow
    expand = _SHADOW_BLUR * 2 + _SHADOW_OFFSET
    w = device.width + expand * 2
    h = device.height + expand * 2

    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Create shadow from device alpha channel
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    # Draw a filled rounded rect matching device position + offset
    sx = expand + _SHADOW_OFFSET // 2
    sy = expand + _SHADOW_OFFSET
    shadow_draw.rounded_rectangle(
        [(sx, sy), (sx + device.width - 1, sy + device.height - 1)],
        radius=_CORNER_RADIUS,
        fill=_SHADOW_COLOR,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=_SHADOW_BLUR))

    canvas = Image.alpha_composite(canvas, shadow)

    # Paste device on top (centered, before shadow offset)
    dx = expand
    dy = expand
    canvas.paste(device, (dx, dy), device)

    return canvas


def _frame_screenshot(
    screenshot: ScreenshotResult,
) -> MockupResult:
    """Compose a single framed mockup from a screenshot."""
    is_dark = screenshot.label.startswith("dark")
    device = _draw_device_frame(screenshot.png_bytes, dark_frame=is_dark)
    framed = _add_shadow(device)

    buf = io.BytesIO()
    framed.save(buf, format="PNG", optimize=True)
    return MockupResult(
        label=f"mockup-{screenshot.label}",
        png_bytes=buf.getvalue(),
        width=framed.width,
        height=framed.height,
    )


def _compose_hero(
    screenshots: list[ScreenshotResult],
) -> MockupResult:
    """Compose a hero image: 3 phones side-by-side.

    Centre phone shows ``light-data``, left shows ``dark-data``,
    right shows ``light-empty``. If fewer than 3 screenshots are
    available, uses what's there.
    """
    # Preferred order for the hero composite
    preferred = ["dark-data", "light-data", "light-empty"]
    by_label = {s.label: s for s in screenshots}

    # Pick screenshots in preferred order, falling back to whatever is available
    picks: list[ScreenshotResult] = []
    for label in preferred:
        if label in by_label:
            picks.append(by_label[label])
    # Fill remaining from whatever we have
    for s in screenshots:
        if s not in picks and len(picks) < 3:
            picks.append(s)

    if not picks:
        raise MockupError("No screenshots to compose hero from")

    # Frame each phone
    frames: list[Image.Image] = []
    for s in picks:
        is_dark = s.label.startswith("dark")
        device = _draw_device_frame(s.png_bytes, dark_frame=is_dark)
        frames.append(device)

    # Scale phones down for the composite
    scaled: list[Image.Image] = []
    for frame in frames:
        new_w = int(frame.width * _HERO_PHONE_SCALE)
        new_h = int(frame.height * _HERO_PHONE_SCALE)
        scaled.append(frame.resize((new_w, new_h), Image.LANCZOS))

    phone_w = scaled[0].width
    phone_h = scaled[0].height

    # Canvas: all phones side by side with spacing + padding
    total_w = len(scaled) * phone_w + (len(scaled) - 1) * _HERO_SPACING + 2 * _HERO_PADDING
    total_h = phone_h + 2 * _HERO_PADDING

    canvas = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))

    x = _HERO_PADDING
    y = _HERO_PADDING
    for phone in scaled:
        canvas.paste(phone, (x, y), phone)
        x += phone_w + _HERO_SPACING

    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return MockupResult(
        label="hero-composite",
        png_bytes=buf.getvalue(),
        width=canvas.width,
        height=canvas.height,
    )


def compose_mockups(
    screenshots: list[ScreenshotResult],
) -> list[MockupResult]:
    """Compose App Store-style mockups from raw Playwright screenshots.

    Returns individual framed screenshots plus a hero composite image.
    Raises :class:`MockupError` on failure.
    """
    if not screenshots:
        raise MockupError("No screenshots provided")

    try:
        results: list[MockupResult] = []

        # Individual framed mockups
        for s in screenshots:
            results.append(_frame_screenshot(s))

        # Hero composite (3 phones side-by-side)
        results.append(_compose_hero(screenshots))

        return results
    except MockupError:
        raise
    except Exception as exc:
        raise MockupError(f"mockup compositing failed: {exc}") from exc
